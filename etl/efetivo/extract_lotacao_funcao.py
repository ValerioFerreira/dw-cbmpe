# requirements:
# openpyxl
# requests
"""Extração da Lotação/Função a partir do QOD publicado (DPlaG) — diz qual
função cada militar ocupa, em qual seção e em qual unidade.

    python etl/efetivo/extract_lotacao_funcao.py                  # baixa do link publicado
    python etl/efetivo/extract_lotacao_funcao.py caminho.xlsx     # usa um arquivo local

O QUE MUDOU EM 2026-08-26 (e por que importa)
---------------------------------------------
Até aqui a função vinha da aba DIST_FUNCOES da "Repercussão Financeira"
(CPPA): uma coluna de TEXTO LIVRE por militar, casada contra o organograma
por 3 camadas de heurística em cascata (catálogo -> substring -> rollup na
árvore do QOD parseada de outro xlsx). Cobria 716 militares, 26,9% do
efetivo, em 14 unidades.

O QOD publicado resolve isso na origem, porque traz DUAS abas ligadas por
chave estrangeira de verdade:

    QOD_CONSOLIDADA.CÓDIGO  ->  QOD_FUNCOES.ID_FUNCAO

Ou seja: quem ocupa a função aponta para a função pelo ID, não pelo nome.
Não sobra nada para adivinhar no par militar->função — 2.744 de 2.775
linhas trazem CÓDIGO e 100% delas resolvem. São 2.372 militares (89,2% do
efetivo) em 45 unidades, contra 716 em 14.

O que ainda precisa ser casado é OUTRA coisa, um nível acima: a SEÇÃO do
QOD contra a DIVISÃO do organograma do app (SUBSETORES, em
src/data/organograma.js). O QOD é mais fino que o organograma — ele lista
"Seção de Tesouraria - STes", que no organograma está dentro de "Divisão
Administrativa - DA", sem a seção aparecer. Ver resolver_divisoes abaixo.

Como a Repercussão Financeira também dava ANTIGUIDADE, PORTARIA, BGE e
FUNÇÃO DE:, e a QOD_CONSOLIDADA dá as quatro, ela fica INTEIRAMENTE
substituída para este fim (a planilha continua existindo para o cálculo
financeiro, que não é assunto deste script).

CHAVE DE JUNÇÃO E FONTE DA UNIDADE
----------------------------------
Junção com o efetivo por MATRÍCULA. A unidade (OME) de cada militar
continua vindo de src/data/real/efetivo_lista.json (Pecúlio/Neon, já
reconciliado com o organograma) — a coluna UNIDADE da QOD_CONSOLIDADA é
usada só como fallback e para avisar divergência, nunca como fonte
primária. Assim a contagem por unidade continua batendo com o efetivo
mostrado no resto do app.

FUNÇÃO vs ENCARGO
-----------------
O catálogo separa 1.397 FUNÇÕES de 426 ENCARGOS. Encargo é acúmulo: vem
com ID_FUNCAO_VINCULADA apontando para a função que a pessoa já ocupa
(ex. o Chefe da Secretaria acumula o Núcleo de Assistência Social). Hoje
87 militares aparecem com função E encargo, e 10 só com encargo.

Contar as duas linhas na lotação da seção duplicaria esses 87. Então:
por_unidade_divisao/por_unidade_secao contam só FUNÇÃO — mais o encargo de
quem NÃO tem nenhuma função lançada, para que ninguém desapareça da
contagem. por_matricula guarda tudo, com o campo "tipo", porque na ficha
do militar o encargo é informação legítima.
"""
import io
import json
import re
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[2]
ORGANOGRAMA_JS = ROOT / "src" / "data" / "organograma.js"
EFETIVO_LISTA_JSON = ROOT / "src" / "data" / "real" / "efetivo_lista.json"
OUT_JSON = ROOT / "src" / "data" / "real" / "lotacao_funcao.json"

# QOD publicado pela DPlaG ("publicar na web" do Google Sheets). Mesmo
# mecanismo já usado em etl/windmill/dw/raw_planilhas.py.
URL_QOD = (
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vRLXuwu8Q9WIe3OBC7A5CC_95t6yj"
    "niWITLEg-8OD09-ytRjV-Yphb7Pcbze7Gd5MZmhbk1r7riO0Dn/pub?output=xlsx"
)

ABA_CATALOGO = "QOD_FUNCOES"
ABA_OCUPACAO = "QOD_CONSOLIDADA"

# QOD_FUNCOES (0-based)
F_ID, F_TIPO, F_VINCULADA, F_OME_COMPLETA = 0, 1, 2, 4
F_OME, F_LOCALIDADE, F_SECAO, F_FUNCAO = 5, 6, 7, 8
F_ORDEM, F_ATIVO = 10, 18

# QOD_CONSOLIDADA (0-based)
C_ANTIGUIDADE, C_UNIDADE, C_MATRICULA, C_POSTO = 1, 2, 3, 4
C_NOME, C_CURSOS, C_FUNCAO_DE, C_PORTARIA, C_BGE, C_CODIGO = 5, 6, 8, 9, 10, 11

TIPO_FUNCAO = "FUNÇÃO"

# De-para da coluna UNIDADE da QOD_CONSOLIDADA -> sigla do organograma. Só
# vale como fallback (matrícula não achada no Pecúlio) e para avisos.
DE_PARA_UNIDADE_FALLBACK = {
    "gcg": "GCG", "gsg": "GSG", "ajg": "AJG", "cpp": "CPP", "cpo": "CPO",
    "ci": "CI", "cint": "CINT", "cman": "CMAN", "ceao": "CEAO", "cefd": "CEFD",
    "ccs": "CCS", "aeci": "AECI", "abmg": "ABMG", "dim": "DIM", "diesp": "DIESP",
    "dgo": "DGO", "dgp": "DGP", "djd": "DJD", "dvp": "DVP", "dtic": "DTIC",
    "dplag": "DPLAG", "dlog": "DLOG", "df": "DF", "das": "DAS", "deip": "DEIP",
    "gbi": "GBI", "gbs": "GBS", "gbaph": "GBAPH", "gbmar": "GBMar",
    "diinter 1": "DINTER I", "diinter 2": "DINTER II",
    "cat rmr recife": "CAT/RMR", "cat zona da mata carpina": "CAT/ZM",
    "cat agreste caruaru": "CAT/AG", "cat sertao petrolina": "CAT/SE",
    "1 gb vitoria": "1º GB", "2 gb caruaru": "2º GB", "3 gb serra talhada": "3º GB",
    "4 gb petrolina": "4º GB", "5 gb salgueiro": "5º GB", "6 gb garanhuns": "6º GB",
    "7 gb carpina": "7º GB", "9 gb": "9º GB",
    # CPPA é OME própria na fonte mas setor vinculado da DGP no organograma
    # (mesmo tratamento de extract_efetivo.py, OME_SETOR_VINCULADO).
    "cppa": "DGP",
}

# Prefixos que resolvem o topo da unidade, onde o texto não cita o nome da
# divisão. Os três primeiros olham a FUNÇÃO ("Comandante Geral"); os dois
# últimos olham a SEÇÃO, e existem porque o QOD chama a caixa de topo de
# "Chefia do Centro de X" / "Gabinete do Comando Geral", que o organograma
# chama simplesmente de "Chefia".
PREFIXOS_COMANDO = [
    (re.compile(r"^subcomand"), "subcomand"),
    (re.compile(r"^comand"), "comand"),
    (re.compile(r"^diretor"), "diretor"),
    (re.compile(r"^chefia\b"), "chefia"),
    (re.compile(r"^gabinete do (sub)?comando"), "chefia"),
]

# Cargo que É a unidade, não uma divisão dela: Comandante Geral,
# Subcomandante Geral, Diretor. Se a unidade não tiver uma divisão própria
# para o cargo (GCG não tem "Comando"; GSG não tem "Subcomando"), ele fica
# SEM divisão de propósito — deixar cair na regra da seção jogaria o
# Subcomandante Geral dentro da "Chefia" do GSG, que é a vaga (única) do
# Chefe do Gabinete.
CARGO_DE_TOPO = re.compile(r"^(comandante|subcomandante|diretor)")

# ...mas só quando a SEÇÃO também é a caixa de topo da unidade. Sem esta
# checagem, "Comandante da 1ª SATec" e "Comandante do 1º Grupo de Combate a
# Incêndio" também casariam com ^comand e cairiam no "Comando" da unidade —
# vaga única do comandante do batalhão, que assim aparecia com 4, 27, 51
# pessoas.
SECAO_DE_TOPO = re.compile(r"^(comando|subcomando|gabinete|chefia|diretoria)\b")

# Divisões de vaga única — só as regras explícitas de prefixo podem
# preenchê-las, nunca substring genérica nem rollup. Sem isso, "Secretaria
# e Ajudância do Comando" batia em "Comando" por conter a palavra solta, e
# apareciam mais pessoas que o previsto=1.
DIVISOES_SINGULARES = {"comando", "subcomando", "diretoria", "chefia"}

# Para o relatorio de chefia duplicada: seccao administrativa + cargo de chefe.
SECAO_ADMINISTRATIVA = re.compile(
    r"^(sec|div|nuc|secretaria|gabinete|chefia|diretoria|assessoria)")
CHEFIA = re.compile(r"^(chefe|diretor)")


def contem_palavra(maior, menor):
    if not menor or not maior:
        return False
    return re.search(r"\b" + re.escape(menor) + r"\b", maior) is not None


def normalizar(s):
    s = str(s or "").strip()
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.lower()
    s = s.replace("divisao", "div").replace("secao", "sec").replace("nucleo", "nuc")
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def _bloco_js(nome):
    texto = ORGANOGRAMA_JS.read_text(encoding="utf-8")
    abre = texto.index("{", texto.index("const " + nome + " = {"))
    profundidade = 0
    bloco = ""
    for i in range(abre, len(texto)):
        profundidade += (texto[i] == "{") - (texto[i] == "}")
        if profundidade == 0:
            bloco = texto[abre:i + 1]
            break
    bloco = re.sub(r"^\s*//.*$", "", bloco, flags=re.MULTILINE)
    bloco = bloco.replace("'", '"')
    return json.loads(re.sub(r",(\s*[\]}])", r"\1", bloco))


def carregar_subsetores():
    return _bloco_js("SUBSETORES")


def carregar_arvore_filhos():
    return _bloco_js("ARVORE")


def divisoes_da_sigla(sigla, subsetores, arvore):
    filhos = set(arvore.get(sigla, []))
    return [re.sub(r"^↳\s*", "", item)
            for item in subsetores.get(sigla, []) if item not in filhos]


def variantes_divisao(titulo):
    partes = re.split(r"\s*-\s*", titulo)
    formas = {titulo}
    if len(partes) >= 2:
        formas.add(partes[-1])
        formas.add(" - ".join(partes[:-1]))
    # "1ª SBI/GBI (Jaboatão)" -> "1ª SBI" e "1ª SATec (Carpina)" -> "1ª SATec":
    # o QOD nomeia a seção sem a cidade, o organograma com.
    formas.add(re.sub(r"\s*/\s*\S+\s*\([^)]*\)\s*$", "", titulo))
    formas.add(re.sub(r"\s*\([^)]*\)\s*$", "", titulo))
    return {normalizar(f) for f in formas if normalizar(f)}


def casar_divisao(texto, divisoes):
    """Casa um título (seção do QOD, ou o nome da função) contra as divisões
    do organograma. Devolve o nome como está em SUBSETORES, ou None."""
    core = normalizar(texto)
    if not core:
        return None
    candidatos = [(d, variantes_divisao(d)) for d in divisoes]

    melhores = []
    for divisao, variantes in candidatos:
        if normalizar(divisao) in DIVISOES_SINGULARES:
            continue
        for v in variantes:
            if len(v) >= 4 and (contem_palavra(core, v) or contem_palavra(v, core)):
                melhores.append((len(v), divisao))
    if melhores:
        melhores.sort(reverse=True)
        return melhores[0][1]

    # Cargo de topo da unidade: a função não cita o nome da divisão, só o
    # cargo ("Comandante Geral", "Diretor de Logística"). Testado depois do
    # casamento literal e antes do fuzzy, porque é bem mais preciso.
    for padrao, prefixo in PREFIXOS_COMANDO:
        if padrao.match(core):
            for divisao, variantes in candidatos:
                if any(v.startswith(prefixo) for v in variantes):
                    return divisao
    m = re.match(r"^chefe d[oae]\s+(.+)$", core)
    if m and len(m.group(1)) <= 6:
        for divisao, variantes in candidatos:
            if any(v.startswith("chefia") for v in variantes):
                return divisao

    # Sobreposição de palavras — cobre "Transporte, Serviços e Telemática"
    # vs "Transporte, Serviços Gerais e Telemática" (uma palavra a mais no
    # meio quebra a contenção literal, mas o conjunto ainda bate).
    alvo_tokens = set(core.split())
    melhores = []
    for divisao, variantes in candidatos:
        if normalizar(divisao) in DIVISOES_SINGULARES:
            continue
        for v in variantes:
            v_tokens = set(v.split())
            if len(v_tokens) < 2:
                continue
            menor = min(len(alvo_tokens), len(v_tokens))
            razao = len(alvo_tokens & v_tokens) / menor if menor else 0
            if razao >= 0.7:
                melhores.append((razao, len(v), divisao))
    if melhores:
        melhores.sort(reverse=True)
        return melhores[0][2]
    return None


OME_ALIAS = {
    "ajg": "AJG", "diesp": "DIESP", "cat rmr": "CAT/RMR", "dinter 1": "DINTER I",
    "dinter ii": "DINTER II", "cat ser": "CAT/SE", "dlog": "DLOG", "dplag": "DPLAG",
    "gsg": "GSG", "cint": "CINT", "cman": "CMAN", "cppa": "DGP",
}


def unidade_pai(ome, siglas_validas):
    """Sigla do organograma para a coluna OME do catálogo. Seções operacionais
    vêm como "1ª SB/4º GB" — a unidade-mãe é a parte depois da última barra."""
    ome = str(ome or "").strip()
    chave = normalizar(ome)
    if chave in OME_ALIAS:
        return OME_ALIAS[chave]
    if ome in siglas_validas:
        return ome
    if "/" in ome:
        parte = ome.rsplit("/", 1)[-1].strip()
        if parte in siglas_validas:
            return parte
    return ome


def baixar(url):
    import requests
    resposta = requests.get(url, timeout=120)
    resposta.raise_for_status()
    return io.BytesIO(resposta.content)


def carregar_catalogo(origem, subsetores, arvore, siglas_validas):
    """QOD_FUNCOES -> {ID_FUNCAO: {...}}, já com a divisão do organograma
    resolvida para cada função."""
    wb = openpyxl.load_workbook(origem, data_only=True)
    faltando = {ABA_CATALOGO, ABA_OCUPACAO} - set(wb.sheetnames)
    if faltando:
        raise SystemExit("abas ausentes na planilha: %s (tem %s)"
                         % (sorted(faltando), wb.sheetnames))

    catalogo = {}
    for r in wb[ABA_CATALOGO].iter_rows(min_row=2, values_only=True):
        if not r[F_ID]:
            continue
        ome = str(r[F_OME] or "").strip()
        catalogo[str(r[F_ID]).strip()] = {
            "tipo": str(r[F_TIPO] or "").strip(),
            "vinculada": str(r[F_VINCULADA]).strip() if r[F_VINCULADA] else None,
            "ome": ome,
            "omeCompleta": str(r[F_OME_COMPLETA] or "").strip() or None,
            "localidade": str(r[F_LOCALIDADE] or "").strip() or None,
            "secao": str(r[F_SECAO] or "").strip(),
            "funcao": str(r[F_FUNCAO] or "").strip(),
            "sigla": unidade_pai(ome, siglas_validas),
            "ordem": float(r[F_ORDEM] or 0),
            "ativo": str(r[F_ATIVO] or "").strip().upper() != "NÃO",
        }
    resolver_divisoes(catalogo, subsetores, arvore)
    canonico = deduplicar(catalogo)
    return catalogo, canonico, wb


def deduplicar(catalogo):
    """{id repetido: id canonico} para funcoes lancadas mais de uma vez.

    O catalogo repete a MESMA funcao (mesma OME, mesma secao, mesmo nome) em
    linhas diferentes: 219 triplas duplicadas, 224 linhas a mais. Em 108 delas
    o cargo e de chefia ou comando -- "Chefe do Nucleo de Comunicacao Social"
    aparece duas vezes no GCG, tres vezes na DVP, quatro na CAT/SER. Cargo de
    chefia e um por secao por definicao, entao cada repetida e uma vaga
    fantasma: quem contar linha de catalogo conta o mesmo cargo duas vezes.

    A canonica e a de menor ORDEM_EXIBICAO (a primeira no documento). As
    outras passam a apontar para ela, e o arquivo final grava uma so.
    """
    por_tripla = {}
    for chave, item in sorted(catalogo.items(), key=lambda kv: kv[1]["ordem"]):
        tripla = (item["ome"], item["secao"], item["funcao"])
        por_tripla.setdefault(tripla, []).append(chave)
    return {
        repetida: ids[0]
        for ids in por_tripla.values() if len(ids) > 1
        for repetida in ids[1:]
    }


def resolver_divisoes(catalogo, subsetores, arvore):
    """Preenche catalogo[id]["divisao"] com a divisão do organograma, ou None.

    O QOD é UM NÍVEL MAIS FINO que o organograma do app: ele lista "Seção de
    Tesouraria - ST", que no organograma não existe — lá ela está dentro de
    "Divisão Administrativa - DA". Casar direto resolve 65% das funções; o
    resto fica com divisao=None e aparece só em por_unidade_secao, com o
    nome exato que o QOD dá.

    Por que não completar os outros 35% por heurística. A tentativa óbvia é
    usar a ORDEM_EXIBICAO: o QOD é lido de cima para baixo, então a seção
    herdaria a última divisão aberta acima dela. Isso sobe a atribuição de
    65% para 91% — e foi medido, não suposto. Mas a conferência contra o
    efetivo PREVISTO por divisão (etl/efetivo/extract_previsto_divisoes.py,
    que parseia a árvore numerada do QOD original) reprova o resultado:

        só casamento direto   1.701 funções atribuídas,  9 divisões acima
                              do previsto, 22 pessoas sobrando
        + rollup por ordem    2.370 funções atribuídas, 28 divisões acima
                              do previsto, 115 pessoas sobrando

    O caso que revela o furo: no 1º GB a ORDEM põe SICT e SEO (6 funções)
    logo depois do bloco da Secretaria e ANTES da linha que abre a Divisão
    de Operações, então as seis vão para a Secretaria — que tem 4 vagas
    previstas no total. O documento não é uma árvore linear confiável.

    669 atribuições a mais não pagam 93 pessoas na divisão errada: número
    errado num painel é pior que número ausente. Para fechar os 35% que
    faltam sem adivinhar, o caminho é um de-para seção -> divisão, ou o QOD
    original com a numeração hierárquica (1., 1.1., 1.1.1.) que o
    extract_previsto_divisoes.py já sabe ler.
    """
    for item in catalogo.values():
        sigla = item["sigla"]
        divisoes = divisoes_da_sigla(sigla, subsetores, arvore)
        if not divisoes:
            item["divisao"] = None
            continue
        # Seção que é sub-OME própria (ex. "1ª SB/1º GB") casa pelo NOME DA
        # OME — o comandante da SB pertence à caixa da SB, não ao "Comando"
        # do GB, que é a vaga única do comandante do batalhão.
        if item["ome"] != sigla:
            item["divisao"] = casar_divisao(item["ome"], divisoes)
            continue
        # Cargo que É a unidade: resolvido pelo nome da FUNÇÃO ("Comandante
        # Geral"), nunca pelo da seção — senão o Subcomandante Geral cairia
        # na "Chefia" do GSG, que é a vaga do Chefe do Gabinete. Pode dar
        # None de propósito (o GCG não tem divisão "Comando").
        if (SECAO_DE_TOPO.match(normalizar(item["secao"]))
                and CARGO_DE_TOPO.match(normalizar(item["funcao"]))):
            item["divisao"] = casar_divisao(item["funcao"], divisoes)
            continue
        item["divisao"] = casar_divisao(item["secao"], divisoes)


def carregar_ome_por_matricula():
    dados = json.loads(EFETIVO_LISTA_JSON.read_text(encoding="utf-8"))
    mapa = {r["matricula"]: sigla
            for sigla, registros in dados["por_unidade"].items()
            for r in registros if r.get("matricula")}
    return mapa, dados


def main():
    local = next((a for a in sys.argv[1:] if not a.startswith("-")), None)
    origem = local or baixar(URL_QOD)
    print("Fonte: " + (local or URL_QOD))

    subsetores = carregar_subsetores()
    arvore = carregar_arvore_filhos()
    siglas_validas = set(arvore) | set(subsetores)
    for filhos in arvore.values():
        siglas_validas.update(filhos)

    catalogo, canonico, wb = carregar_catalogo(origem, subsetores, arvore, siglas_validas)
    ome_por_matricula, efetivo = carregar_ome_por_matricula()

    por_matricula = {}
    usadas = set()
    linhas_por_matricula = {}  # matricula -> [(sigla, item)]
    sem_codigo = []
    codigo_orfao = []
    sem_pecunlio = []
    divergencia_unidade = []

    for r in wb[ABA_OCUPACAO].iter_rows(min_row=2, values_only=True):
        matricula = r[C_MATRICULA]
        if matricula is None:
            continue
        matricula = str(matricula).strip()
        nome = r[C_NOME]
        unidade_bruta = str(r[C_UNIDADE] or "").strip()
        codigo = str(r[C_CODIGO]).strip() if r[C_CODIGO] else None

        if not codigo:
            sem_codigo.append((matricula, nome, unidade_bruta))
            continue
        # Duas pessoas lancadas em FUN114 e FUN116 ocupam o MESMO cargo: as
        # duas linhas viram a canonica, e a duplicidade aparece no relatorio
        # em vez de virar duas vagas diferentes.
        codigo = canonico.get(codigo, codigo)
        item = catalogo.get(codigo)
        if item is None:
            codigo_orfao.append((matricula, nome, codigo))
            continue

        sigla = ome_por_matricula.get(matricula)
        if sigla is None:
            sigla = DE_PARA_UNIDADE_FALLBACK.get(normalizar(unidade_bruta))
            if sigla is None:
                sem_pecunlio.append((matricula, nome, unidade_bruta))
                continue
        else:
            esperada = DE_PARA_UNIDADE_FALLBACK.get(normalizar(unidade_bruta))
            if esperada and esperada != sigla:
                divergencia_unidade.append((matricula, nome, unidade_bruta, sigla))

        antiguidade = r[C_ANTIGUIDADE]
        # Só o que varia por PESSOA. O que descreve a função (nome, seção,
        # divisão, OME, localidade) fica uma vez só em "funcoes", referenciado
        # por idFuncao — repetir esses textos em cada uma das 2.600 ocupações
        # inflava o arquivo em ~1 MB, e ele é `import`ado, ou seja, entra no
        # bundle que o navegador baixa antes do login.
        por_matricula.setdefault(matricula, []).append({
            "idFuncao": codigo,
            "postoFuncao": str(r[C_FUNCAO_DE]).strip() if r[C_FUNCAO_DE] else None,
            "cursos": str(r[C_CURSOS]).strip() if r[C_CURSOS] else None,
            "portaria": str(r[C_PORTARIA]).strip() if r[C_PORTARIA] else None,
            "bge": str(r[C_BGE]).strip() if r[C_BGE] else None,
            "antiguidade": antiguidade if isinstance(antiguidade, (int, float)) else None,
        })
        usadas.add(codigo)
        linhas_por_matricula.setdefault(matricula, []).append((sigla, item))

    # Contagem por divisão/seção: só FUNÇÃO, mais o ENCARGO de quem não tem
    # nenhuma função lançada (ver docstring). Sem isso, os 87 militares que
    # acumulam encargo contariam duas vezes na lotação da seção.
    por_unidade_divisao = {}
    por_unidade_secao = {}
    sem_divisao = []
    for matricula, linhas in linhas_por_matricula.items():
        principais = [(s, i) for s, i in linhas if i["tipo"] == TIPO_FUNCAO]
        for sigla, item in (principais or linhas):
            # A divisão foi resolvida contra a unidade DO CATÁLOGO. Quando o
            # Pecúlio lota o militar em outra unidade (110 casos hoje), essa
            # divisão não existe lá — usá-la criaria divisão fantasma. Só
            # vale se pertencer à unidade onde o militar de fato está.
            # Só re-casa quando a divisão EXISTE mas é de outra unidade.
            # Divisão já nula fica nula: ela foi anulada de propósito (o
            # Subcomandante Geral não ocupa a "Chefia" do GSG), e re-casar
            # pela seção desfaria justamente essa decisão.
            divisoes_do_militar = divisoes_da_sigla(sigla, subsetores, arvore)
            if item["divisao"] and item["divisao"] not in divisoes_do_militar:
                item = dict(item, divisao=casar_divisao(item["secao"], divisoes_do_militar))
            if item["divisao"]:
                por_unidade_divisao.setdefault(sigla, {}) \
                    .setdefault(item["divisao"], set()).add(matricula)
            else:
                sem_divisao.append((sigla, matricula, item["secao"] or item["funcao"]))
            if item["secao"]:
                por_unidade_secao.setdefault(sigla, {}) \
                    .setdefault(item["secao"], set()).add(matricula)

    def serializar(mapa):
        return {sigla: {nome: sorted(mats) for nome, mats in sorted(grupos.items())}
                for sigla, grupos in sorted(mapa.items())}

    total_ativos = sum(len(v) for v in efetivo["por_unidade"].values())
    cobertura = {
        "matriculas_com_funcao": len(por_matricula),
        "total_militares_ativos": total_ativos,
        "percentual": round(100 * len(por_matricula) / total_ativos, 1) if total_ativos else None,
        # Unidade coberta = tem alguém com função lançada. É por_unidade_secao,
        # não por_unidade_divisao: a segunda só lista unidade onde ALGUMA
        # função casou com uma divisão do organograma (36 das 43), e usá-la
        # aqui esconderia 7 unidades que estão cobertas, só que em seções que
        # o organograma não conhece.
        "unidades_cobertas": sorted(por_unidade_secao),
        "unidades_com_divisao_casada": sorted(por_unidade_divisao),
    }

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps({
        "fonte": ("QOD publicado pela DPlaG (Google Sheets), abas QOD_FUNCOES "
                  "(catálogo de funções) e QOD_CONSOLIDADA (quem ocupa cada uma), "
                  "ligadas por CÓDIGO -> ID_FUNCAO"),
        "url": URL_QOD,
        "gerado_em": datetime.now(timezone.utc).isoformat(),
        "cobertura": cobertura,
        "funcoes": {
            chave: {
                "tipo": item["tipo"],
                "funcao": item["funcao"],
                "secao": item["secao"] or None,
                "divisao": item["divisao"],
                "ome": item["ome"] or None,
                "omeCompleta": item["omeCompleta"],
                "localidade": item["localidade"],
            }
            for chave, item in catalogo.items() if chave in usadas
        },
        "por_matricula": por_matricula,
        "por_unidade_divisao": serializar(por_unidade_divisao),
        "por_unidade_secao": serializar(por_unidade_secao),
    }, ensure_ascii=False, indent=2, sort_keys=True), encoding="utf-8")

    com_divisao = sum(1 for i in catalogo.values() if i["divisao"])
    print("OK: %d militares com função (%s%% do efetivo ativo), em %d unidades"
          % (len(por_matricula), cobertura["percentual"], len(cobertura["unidades_cobertas"])))
    print("Catálogo: %d funções/encargos | %d casam com uma divisão do organograma"
          % (len(catalogo), com_divisao))
    print("Seções ocupadas: %d, em %d unidades | divisões preenchidas: %d, em %d unidades"
          % (sum(len(v) for v in por_unidade_secao.values()), len(por_unidade_secao),
             sum(len(v) for v in por_unidade_divisao.values()), len(por_unidade_divisao)))
    print("Gravado em %s" % OUT_JSON.relative_to(ROOT))

    def avisar(titulo, itens, limite=15):
        if itens:
            print("\nAVISO: %s: %d" % (titulo, len(itens)))
            for i in itens[:limite]:
                print("  -", i)

    avisar("linhas de ocupação sem CÓDIGO (não dá para saber a função)", sem_codigo)
    avisar("CÓDIGO que não existe no catálogo", codigo_orfao)
    avisar("matrículas não encontradas no Pecúlio/Neon", sem_pecunlio)
    avisar("unidade da planilha divergente do Pecúlio (vale o Pecúlio)", divergencia_unidade)
    avisar("funções sem divisão do organograma (contam só no total da unidade)", sem_divisao)

    # Cargo de chefia ADMINISTRATIVA e um por secao. "Comandante de Grupo" de
    # um GCI/GS/GAPH nao entra aqui: aquilo e funcao de turno, e ter 17 e o
    # esperado. O que nao pode e a mesma Secao ter dois Chefes.
    ocupantes = {}
    for matricula, linhas in linhas_por_matricula.items():
        for _, item in linhas:
            if item["tipo"] != TIPO_FUNCAO:
                continue
            if not SECAO_ADMINISTRATIVA.match(normalizar(item["secao"])):
                continue
            if not CHEFIA.match(normalizar(item["funcao"])):
                continue
            ocupantes.setdefault((item["ome"], item["secao"], item["funcao"]), set()).add(matricula)
    duplicadas = sorted(((k, v) for k, v in ocupantes.items() if len(v) > 1),
                        key=lambda kv: -len(kv[1]))
    if duplicadas:
        print(f"\nAVISO: {len(duplicadas)} cargo(s) de chefia com mais de um ocupante "
              f"(um por seção, por definição) — fato da planilha, não do casamento:")
        for (ome, secao, funcao), mats in duplicadas[:15]:
            print(f"  - {len(mats)}x  {ome} | {secao} | {funcao}")


if __name__ == "__main__":
    main()
