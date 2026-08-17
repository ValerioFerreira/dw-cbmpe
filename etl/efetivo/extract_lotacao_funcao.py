# requirements:
# openpyxl
"""Extração pontual da Lotação/Função a partir da aba DIST_FUNCOES da
planilha "Repercussão Financeira" (CPPA) — conecta o efetivo já conhecido
(Pecúlio/Neon, em src/data/real/efetivo_lista.json) com a função e seção
que cada militar ocupa. O QOD (etl/efetivo/extract_previsto_divisoes.py)
já diz quantas vagas de função existem por divisão; esta aba diz quem
ocupa qual.

Cobertura parcial e conhecida, não um bug: hoje só as unidades abaixo têm
função lançada em DIST_FUNCOES — "está sendo atualizada, e irá conter
todos os militares do pecúlio" (usuário, 2026-08-17). Unidade/militar
ausente aqui não significa "sem função", só que ainda não foi lançado.

Chave de junção: MATRÍCULA. A unidade (OME) de cada militar vem de
src/data/real/efetivo_lista.json (fonte já reconciliada com o organograma,
mesma origem do Neon) — a coluna UNIDADE da própria DIST_FUNCOES só é
usada como fallback (matrícula não encontrada no Pecúlio) e para avisos de
divergência, nunca como fonte primária.

O casamento de função usa 3 camadas, nesta ordem de prioridade:
1. Catálogo oficial (Funções - DPlaG.xlsx, aba QOD_FUNCOES) — a partir da
   próxima planilha, "NOME DA FUNÇÃO E SEÇÃO/OME" do DIST_FUNCOES passa a
   ser preenchido com o valor exato da coluna FUNÇÃO deste catálogo
   (confirmado pelo usuário, 2026-08-17) — motivo pelo qual esta camada é
   tentada primeiro e tende a virar praticamente 100% dos casos com o
   tempo, à medida que os lançamentos antigos (texto livre, sem seguir o
   catálogo) forem sendo substituídos.
2. Heurística de texto direto contra as divisões de SUBSETORES
   (organograma.js) — cobre lançamentos antigos que não citam o catálogo.
3. Rollup na árvore real do QOD (etl/efetivo/extract_previsto_divisoes.py)
   — sobe pela hierarquia de seções até achar um ancestral que já bate com
   uma divisão conhecida, pra função em nível mais fino do que SUBSETORES
   reconhece hoje (ex. "Seção de Instrução" dentro de "Divisão de
   Operações").

Funções que não batem em nenhuma das 3 camadas ficam registradas como
"não classificadas" (contam no total da unidade, não em nenhuma divisão
específica), sem falhar o script.

Uso:
    python etl/efetivo/extract_lotacao_funcao.py "<caminho do xlsx>"
"""
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

SHEET = "DIST_FUNCOES"
LINHA_INICIO = 23
COL_UNIDADE = 3
COL_MATRICULA = 4
COL_POSTO = 5
COL_NOME = 6
COL_FUNCAO_SECAO = 8
COL_FUNCAO_DE = 9
COL_PORTARIA = 10
COL_BGE = 11
COL_ANTIGUIDADE = 2

# De-para best-effort da coluna UNIDADE de DIST_FUNCOES -> sigla do
# organograma. Só usado como fallback (matrícula não achada no Pecúlio) ou
# pra avisos de divergência — não é a fonte primária de unidade.
DE_PARA_UNIDADE_FALLBACK = {
    "GCG": "GCG", "GBI": "GBI", "GBS": "GBS", "GBMAR": "GBMar",
    "DGP": "DGP", "DVP": "DVP", "DJD": "DJD", "DTIC": "DTIC",
    "DPLAG": "DPLAG", "DLOG": "DLOG", "DF": "DF", "DGO": "DGO",
    "DIINTER/1": "DINTER I", "DIINTER/2": "DINTER II",
    "ADIDO": None,  # sem sigla própria — decisão já registrada (Pecúlio/Neon)
}

# Regras especiais pra funções de comando/chefia que não citam o nome da
# divisão explicitamente (ex. "Comandante", "Subcomandante", "Chefe do
# GCG", "Diretor(a) de Tecnologia da Informação e Comunicação").
PREFIXOS_COMANDO = [
    (re.compile(r"^subcomand"), "subcomand"),
    (re.compile(r"^comand"), "comand"),
    (re.compile(r"^diretor"), "diretor"),
]


def normalizar(s):
    s = str(s or "").strip()
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.lower()
    s = s.replace("divisao", "div").replace("secao", "sec").replace("nucleo", "nuc")
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def extrair_parenteses(texto):
    texto = str(texto or "")
    m = re.search(r"\(([^)]*)\)", texto)
    hint = m.group(1) if m else None
    sem_parenteses = re.sub(r"\([^)]*\)", "", texto).strip()
    return sem_parenteses, hint


def carregar_subsetores():
    texto = ORGANOGRAMA_JS.read_text(encoding="utf-8")
    inicio = texto.index("const SUBSETORES = {")
    abre = texto.index("{", inicio)
    profundidade = 0
    fim = None
    for i in range(abre, len(texto)):
        if texto[i] == "{":
            profundidade += 1
        elif texto[i] == "}":
            profundidade -= 1
            if profundidade == 0:
                fim = i + 1
                break
    bloco = texto[abre:fim]
    bloco = re.sub(r"^\s*//.*$", "", bloco, flags=re.MULTILINE)
    bloco = bloco.replace("'", '"')
    bloco = re.sub(r",(\s*[\]}])", r"\1", bloco)
    return json.loads(bloco)


def carregar_arvore_filhos():
    texto = ORGANOGRAMA_JS.read_text(encoding="utf-8")
    inicio = texto.index("const ARVORE = {")
    abre = texto.index("{", inicio)
    profundidade = 0
    fim = None
    for i in range(abre, len(texto)):
        if texto[i] == "{":
            profundidade += 1
        elif texto[i] == "}":
            profundidade -= 1
            if profundidade == 0:
                fim = i + 1
                break
    bloco = texto[abre:fim]
    bloco = re.sub(r"^\s*//.*$", "", bloco, flags=re.MULTILINE)
    bloco = bloco.replace("'", '"')
    bloco = re.sub(r",(\s*[\]}])", r"\1", bloco)
    return json.loads(bloco)


def divisoes_da_sigla(sigla, subsetores, arvore):
    filhos = set(arvore.get(sigla, []))
    itens = [item for item in subsetores.get(sigla, []) if item not in filhos]
    return [re.sub(r"^↳\s*", "", item) for item in itens]


def variantes_divisao(titulo):
    """Núcleo(s) normalizados de uma divisão pra tentar casar contra texto
    livre de função — inclui a forma completa, a abreviação (depois do
    último hífen) e a forma sem abreviação, cada uma normalizada."""
    partes = re.split(r"\s*-\s*", titulo)
    formas = {titulo}
    if len(partes) >= 2:
        formas.add(partes[-1])
        formas.add(" - ".join(partes[:-1]))
    # remove sufixo "/SIGLA (Cidade)" das seções operacionais, ex.
    # "1ª SBI/GBI (Jaboatão dos Guararapes)" -> "1ª SBI"
    sem_sufixo = re.sub(r"\s*/\s*\S+\s*\([^)]*\)\s*$", "", titulo)
    formas.add(sem_sufixo)
    return {normalizar(f) for f in formas if normalizar(f)}


def casar_divisao(funcao_texto, divisoes):
    """Retorna o nome da divisão (como está em SUBSETORES) que melhor casa
    com o texto livre de função, ou None se não achar candidato razoável."""
    sem_parenteses, hint = extrair_parenteses(funcao_texto)
    core = normalizar(sem_parenteses)
    core_hint = normalizar(hint) if hint else ""

    candidatos = [(d, variantes_divisao(d)) for d in divisoes]

    def tenta(texto_norm):
        if not texto_norm:
            return None
        melhores = []
        for divisao, variantes in candidatos:
            for v in variantes:
                if len(v) >= 4 and (v in texto_norm or texto_norm in v):
                    melhores.append((len(v), divisao))
        if melhores:
            melhores.sort(reverse=True)
            return melhores[0][1]
        return None

    achado = tenta(core)
    if achado:
        return achado
    achado = tenta(core_hint)
    if achado:
        return achado

    # Fallback por sobreposição de palavras (não exige substring exata) —
    # cobre casos como "Transporte, Serviços e Telemática" vs "Transporte,
    # Serviços Gerais e Telemática" (uma palavra a mais no meio quebra a
    # contenção literal, mas o conjunto de palavras ainda bate muito).
    def tenta_tokens(texto_norm):
        if not texto_norm:
            return None
        alvo_tokens = set(texto_norm.split())
        melhores = []
        for divisao, variantes in candidatos:
            for v in variantes:
                v_tokens = set(v.split())
                if len(v_tokens) < 2:
                    continue
                intersecao = len(alvo_tokens & v_tokens)
                menor = min(len(alvo_tokens), len(v_tokens))
                if menor and intersecao / menor >= 0.7:
                    melhores.append((intersecao / menor, len(v), divisao))
        if melhores:
            melhores.sort(reverse=True)
            return melhores[0][2]
        return None

    achado = tenta_tokens(core)
    if achado:
        return achado

    # Regras especiais pra comando/subcomando/diretoria (função não cita o
    # nome da divisão, só o cargo de topo da própria unidade).
    for padrao, prefixo in PREFIXOS_COMANDO:
        if padrao.match(core):
            for divisao, variantes in candidatos:
                if any(v.startswith(prefixo) for v in variantes):
                    return divisao

    # "Chefe do/da {sigla da própria unidade}" (ex. "Chefe do GCG") — cargo
    # de topo da unidade, mapeia pra divisão "Chefia" quando existir.
    m = re.match(r"^chefe d[oae]\s+(.+)$", core)
    if m and len(m.group(1)) <= 6:
        for divisao, variantes in candidatos:
            if any(v.startswith("chefia") for v in variantes):
                return divisao
    return None


# sigla -> índice da aba de unidade no QOD (mesma tabela usada em
# extract_previsto_divisoes.py) — usado só pro rollup de seções internas
# (ex. "Seção de Instrução..." dentro de "Divisão de Operações") que o
# catálogo de funções resolve num nível mais fino do que SUBSETORES
# reconhece hoje.
SIGLA_SHEET_IDX = {
    "GCG": 4, "CI": 5, "CPO": 6, "AECI": 7, "CCS": 8, "GSG": 9, "AJG": 10, "CPP": 11,
    "DGO": 12, "DIM": 13, "GBI": 14, "GBAPH": 20, "GBS": 25, "GBMar": 31,
    "DIESP": 34, "CAT/RMR": 35, "DINTER I": 36, "1º GB": 37, "2º GB": 41,
    "6º GB": 49, "7º GB": 52, "CAT/ZM": 57, "CAT/AG": 58, "DINTER II": 59,
    "3º GB": 60, "4º GB": 65, "5º GB": 69, "9º GB": 74, "CAT/SE": 78,
    "DAS": 79, "DGP": 80, "DJD": 82, "DVP": 83, "DTIC": 84, "DPLAG": 85,
    "DLOG": 86, "CMAN": 87, "CINT": 88, "CEAO": 89, "DF": 90, "DEIP": 91,
    "ABMG": 92, "CEFD": 93,
}
COL_QOD_DISCRIMINACAO = 1
PADRAO_QOD_HEADER = re.compile(r"^(\d+(?:\.\d+)*)\)\s*(.+)$")
PADRAO_QOD_BODY = re.compile(r"^[a-z]\.\s")


class NoQod:
    __slots__ = ("titulo", "nivel", "filhos", "pai")

    def __init__(self, titulo, nivel, pai):
        self.titulo = titulo
        self.nivel = nivel
        self.filhos = []
        self.pai = pai


def parsear_arvore_qod(ws):
    raizes = []
    pilha = []
    for row in ws.iter_rows(min_row=7, max_row=ws.max_row):
        a = row[COL_QOD_DISCRIMINACAO - 1].value
        if a is None:
            continue
        a = str(a).strip()
        if not a or a.upper().startswith("TOTAL"):
            continue
        m = PADRAO_QOD_HEADER.match(a)
        if m:
            nivel = len(m.group(1).split("."))
            no = NoQod(m.group(2).strip(), nivel, None)
            while pilha and pilha[-1].nivel >= nivel:
                pilha.pop()
            if pilha:
                no.pai = pilha[-1]
                pilha[-1].filhos.append(no)
            else:
                raizes.append(no)
            pilha.append(no)
            continue
        if PADRAO_QOD_BODY.match(a) and pilha:
            # linha-folha (ex. "a. Chefe") — mesmo nó-pai, sem nó próprio.
            continue
    return raizes


def achatar_qod(raizes):
    out = []

    def visitar(no):
        out.append(no)
        for f in no.filhos:
            visitar(f)

    for r in raizes:
        visitar(r)
    return out


def construir_rollup_qod(sigla, wb_qod, divisoes):
    """Devolve uma função texto_livre -> divisão (SUBSETORES) que resolve
    seções internas mais finas subindo a árvore real do QOD até achar um
    ancestral que já case com alguma divisão conhecida."""
    idx = SIGLA_SHEET_IDX.get(sigla)
    if idx is None or wb_qod is None:
        return lambda _texto: None
    ws = wb_qod[wb_qod.sheetnames[idx]]
    nos = achatar_qod(parsear_arvore_qod(ws))

    def resolver(texto_livre):
        core = normalizar(texto_livre)
        if not core:
            return None
        candidatos = []
        for no in nos:
            nucleo = normalizar(re.sub(r"\s*/\s*\S+\s*\([^)]*\)\s*$", "", no.titulo))
            if len(nucleo) >= 4 and (nucleo in core or core in nucleo):
                candidatos.append(no)
        if not candidatos:
            return None
        # nó mais específico primeiro (título mais longo)
        candidatos.sort(key=lambda n: len(n.titulo), reverse=True)
        no = candidatos[0]
        while no is not None:
            achado = casar_divisao(no.titulo, divisoes)
            if achado:
                return achado
            no = no.pai
        return None

    return resolver


def carregar_ome_por_matricula():
    dados = json.loads(EFETIVO_LISTA_JSON.read_text(encoding="utf-8"))
    mapa = {}
    for sigla, registros in dados["por_unidade"].items():
        for r in registros:
            if r.get("matricula"):
                mapa[r["matricula"]] = sigla
    return mapa


# Aliases da coluna OME do catálogo de funções (Funções - DPlaG.xlsx) que
# não batem literalmente com a sigla do organograma.
OME_CATALOGO_ALIAS = {
    "ajg": "AJG", "diesp": "DIESP", "cat rmr": "CAT/RMR",
    "dinter 1": "DINTER I", "dinter ii": "DINTER II", "cat ser": "CAT/SE",
}


def unidade_pai(ome_valor, siglas_validas):
    """Resolve a coluna OME do catálogo de funções pra sigla do
    organograma — seções operacionais vêm como "1ª SB/4º GB" (a sigla da
    unidade-mãe é a parte depois da última barra)."""
    ome = str(ome_valor or "").strip()
    chave = normalizar(ome)
    if chave in OME_CATALOGO_ALIAS:
        return OME_CATALOGO_ALIAS[chave]
    if ome in siglas_validas:
        return ome
    if "/" in ome:
        parte = ome.rsplit("/", 1)[-1].strip()
        if parte in siglas_validas:
            return parte
    return ome


def carregar_catalogo_funcoes(caminho, siglas_validas):
    """Carrega o dicionário oficial de funções (Funções - DPlaG.xlsx,
    aba QOD_FUNCOES) — dado pelo usuário como a fonte da qual o texto de
    DIST_FUNCOES é extraído. Cada linha vira um candidato de casamento,
    agrupado pela sigla da unidade-mãe."""
    wb = openpyxl.load_workbook(caminho, data_only=True)
    ws = wb["QOD_FUNCOES"]
    cabecalho = [c.value for c in next(ws.iter_rows(min_row=1, max_row=1))]

    def idx(nome_parcial):
        for i, c in enumerate(cabecalho):
            if c and nome_parcial in normalizar(c).upper():
                return i
        return None

    i_ome = idx("OME") if idx("OME") is not None else 4
    # colunas exatas pela posição observada (ID_FUNCAO, TIPO_FUNCAO,
    # ID_FUNCAO_VINCULADA, OME_COMPLETA, OME, LOCALIDADE, SEÇÃO, FUNÇÃO, OBS)
    linhas = []
    for row in ws.iter_rows(min_row=2, max_row=ws.max_row, values_only=True):
        if len(row) < 8 or not row[7]:
            continue
        ome_bruta = row[4]
        linhas.append({
            "id": row[0],
            "tipo": row[1],
            "ome": str(ome_bruta).strip() if ome_bruta else "",
            "unidade_pai": unidade_pai(ome_bruta, siglas_validas),
            "secao": str(row[6]).strip() if row[6] else "",
            "funcao": str(row[7]).strip() if row[7] else "",
        })

    por_unidade_pai = {}
    for linha in linhas:
        por_unidade_pai.setdefault(linha["unidade_pai"], []).append(linha)
    return por_unidade_pai


def casar_via_catalogo(funcao_texto, candidatos_catalogo):
    """Casa o texto livre de DIST_FUNCOES contra o catálogo oficial de
    funções (já filtrado pra unidade-mãe do militar). Retorna a linha do
    catálogo (dict) com melhor casamento, ou None."""
    if not candidatos_catalogo:
        return None
    core = normalizar(funcao_texto)
    if not core:
        return None
    melhores = []
    for linha in candidatos_catalogo:
        alvo = normalizar(linha["funcao"])
        if not alvo:
            continue
        if alvo == core:
            melhores.append((1000, linha))
        elif alvo in core or core in alvo:
            melhores.append((len(alvo), linha))
    if not melhores:
        return None
    melhores.sort(key=lambda x: x[0], reverse=True)
    return melhores[0][1]


def main():
    if len(sys.argv) < 2:
        raise SystemExit(
            "uso: extract_lotacao_funcao.py <caminho da Repercussão Financeira.xlsx> "
            "[caminho do catálogo de Funções.xlsx]"
        )
    caminho = sys.argv[1]
    caminho_catalogo = sys.argv[2] if len(sys.argv) > 2 else None
    caminho_qod = sys.argv[3] if len(sys.argv) > 3 else None

    subsetores = carregar_subsetores()
    arvore = carregar_arvore_filhos()
    ome_por_matricula = carregar_ome_por_matricula()
    siglas_validas = set(arvore.keys()) | set(subsetores.keys())
    for filhos in arvore.values():
        siglas_validas.update(filhos)

    catalogo_por_unidade = (
        carregar_catalogo_funcoes(caminho_catalogo, siglas_validas) if caminho_catalogo else {}
    )
    wb_qod = openpyxl.load_workbook(caminho_qod, data_only=True) if caminho_qod else None
    rollup_por_sigla = {}
    usados_via_catalogo = 0
    usados_via_heuristica = 0
    usados_via_rollup_qod = 0

    wb = openpyxl.load_workbook(caminho, data_only=True)
    ws = wb[SHEET]

    por_matricula = {}
    por_unidade_divisao = {}
    nao_classificados = []
    matriculas_sem_pecunlio = []
    divergencias_unidade = []

    for r in ws.iter_rows(min_row=LINHA_INICIO, max_row=ws.max_row):
        matricula = r[COL_MATRICULA - 1].value
        if matricula is None:
            continue
        matricula = str(matricula).strip()
        unidade_bruta = r[COL_UNIDADE - 1].value
        posto = r[COL_POSTO - 1].value
        nome = r[COL_NOME - 1].value
        funcao_secao = r[COL_FUNCAO_SECAO - 1].value
        funcao_de = r[COL_FUNCAO_DE - 1].value
        portaria = r[COL_PORTARIA - 1].value
        bge = r[COL_BGE - 1].value
        antiguidade = r[COL_ANTIGUIDADE - 1].value
        if not funcao_secao:
            continue

        sigla = ome_por_matricula.get(matricula)
        if sigla is None:
            sigla = DE_PARA_UNIDADE_FALLBACK.get(normalizar(unidade_bruta).upper().replace(" ", ""))
            if sigla is None:
                matriculas_sem_pecunlio.append((matricula, nome, unidade_bruta))
                continue
        else:
            sigla_fallback = DE_PARA_UNIDADE_FALLBACK.get(str(unidade_bruta).strip().upper())
            if sigla_fallback and sigla_fallback != sigla:
                divergencias_unidade.append((matricula, nome, unidade_bruta, sigla))

        registro = {
            "funcao": str(funcao_secao).strip(),
            "postoFuncao": str(funcao_de).strip() if funcao_de else None,
            "portaria": str(portaria).strip() if portaria else None,
            "bge": str(bge).strip() if bge else None,
            "antiguidade": antiguidade if isinstance(antiguidade, (int, float)) else None,
        }
        # Acúmulo de função: guarda todas, matrícula -> lista.
        por_matricula.setdefault(matricula, []).append(registro)

        divisoes = divisoes_da_sigla(sigla, subsetores, arvore)
        divisao = None
        candidato_texto = None
        if divisoes:
            linha_catalogo = casar_via_catalogo(str(funcao_secao), catalogo_por_unidade.get(sigla, []))
            if linha_catalogo:
                # Seção operacional (sub-OME própria, ex. "1ª SBI/GBI") vira
                # o próprio candidato de divisão; senão usa o campo SEÇÃO.
                candidato_texto = linha_catalogo["ome"] if linha_catalogo["ome"] != sigla else linha_catalogo["secao"]
                divisao = casar_divisao(candidato_texto, divisoes)
                if divisao:
                    usados_via_catalogo += 1
            if not divisao:
                divisao = casar_divisao(str(funcao_secao), divisoes)
                if divisao:
                    usados_via_heuristica += 1
            if not divisao and wb_qod is not None:
                if sigla not in rollup_por_sigla:
                    rollup_por_sigla[sigla] = construir_rollup_qod(sigla, wb_qod, divisoes)
                divisao = rollup_por_sigla[sigla](candidato_texto or str(funcao_secao))
                if divisao:
                    usados_via_rollup_qod += 1
        bucket = por_unidade_divisao.setdefault(sigla, {})
        if divisao:
            bucket.setdefault(divisao, set()).add(matricula)
        else:
            nao_classificados.append((sigla, matricula, str(funcao_secao)))

    # Serializa contagens (set -> len, mas guarda as matrículas também pra
    # depuração futura sem precisar reabrir o xlsx).
    por_unidade_divisao_out = {
        sigla: {divisao: sorted(matriculas) for divisao, matriculas in divs.items()}
        for sigla, divs in por_unidade_divisao.items()
    }

    total_militares_pecunlio = sum(len(v) for v in json.loads(EFETIVO_LISTA_JSON.read_text(encoding="utf-8"))["por_unidade"].values())
    cobertura = {
        "matriculas_com_funcao": len(por_matricula),
        "total_militares_ativos": total_militares_pecunlio,
        "percentual": round(100 * len(por_matricula) / total_militares_pecunlio, 1) if total_militares_pecunlio else None,
        "unidades_cobertas": sorted(por_unidade_divisao.keys()),
    }

    saida = {
        "fonte": "Repercussão Financeira.xlsx, aba DIST_FUNCOES (CPPA) — planilha viva, em atualização contínua, cobertura parcial",
        "gerado_em": datetime.now(timezone.utc).isoformat(),
        "cobertura": cobertura,
        "por_matricula": por_matricula,
        "por_unidade_divisao": por_unidade_divisao_out,
    }

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(
        json.dumps(saida, ensure_ascii=False, indent=2, sort_keys=True),
        encoding="utf-8",
    )

    print(f"OK: {len(por_matricula)} militares com função ({cobertura['percentual']}% do efetivo ativo)")
    print(f"Unidades cobertas: {cobertura['unidades_cobertas']}")
    if caminho_catalogo:
        print(
            f"Divisão casada via catálogo oficial: {usados_via_catalogo} | "
            f"via heurística de texto: {usados_via_heuristica} | "
            f"via rollup na árvore do QOD: {usados_via_rollup_qod}"
        )
    print(f"Gravado em {OUT_JSON}")
    if matriculas_sem_pecunlio:
        print(f"\nAVISO: {len(matriculas_sem_pecunlio)} matrícula(s) em DIST_FUNCOES não encontradas no Pecúlio/Neon (efetivo_lista.json):")
        for m in matriculas_sem_pecunlio[:20]:
            print("  -", m)
    if divergencias_unidade:
        print(f"\nAVISO: {len(divergencias_unidade)} matrícula(s) com unidade em DIST_FUNCOES divergente do Pecúlio (usando o Pecúlio como fonte):")
        for d in divergencias_unidade[:20]:
            print("  -", d)
    if nao_classificados:
        print(f"\nAVISO: {len(nao_classificados)} função(ões) não casadas com nenhuma divisão conhecida (contam só no total da unidade):")
        for n in nao_classificados[:40]:
            print("  -", n)


if __name__ == "__main__":
    main()
