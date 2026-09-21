# requirements:
# psycopg2-binary
"""Extração do Dashboard de Vacinações (DAS — Diretoria de Assistência
Social), prototipado por Igor no Claude Cowork (ver dashboards/das.zip),
portado aqui para consumir dado real. Fonte: Postgres interno
`vaccine_control_production` (10.193.0.20:5432 — rede interna, precisa de
VPN), view `public.vw_vaccinations_dashboard` (join pronto de
vaccinations/campaigns/vaccines/vaccine_brands/militaries/omes/applicators).

Uso:
    DATABASE_URL_OPS=postgresql://usuario:senha@10.193.0.20:5432/vaccine_control_production python extract_dashboard_vacinacoes.py

Diferente de Efetivo/Finanças, o grão aqui é POR EVENTO DE VACINAÇÃO (uma
linha por aplicação — 3.030 linhas, validado batendo exato contra 6 números
já confirmados no protótipo por print do Metabase: total geral, top10 OME,
top8 vacinas, top7 postos, top7 aplicadores, 5 marcas — ver
DW_PLANEJAMENTO.md, entrada de 2026-09-21). Isso substitui os totais
parciais (top-N) do protótipo por totais completos de verdade, e desbloqueia
o gráfico "Vacinações mensais" (Aba 1) e a Linha do tempo por vacina
(Aba 3), que antes dependiam de leitura de imagem — ver
scratchpad/pacotes/das/status_dashboard_vacinacoes.md (pendências
resolvidas: P-1 a P-6 continuam sem fórmula do Looker, mas deixam de
importar porque este SQL é a fonte real, não uma tentativa de bater com o
relatório do Igor).

Minimização (LGPD): a view expõe `military_cpf` e `applicator_cpf` em texto
puro — NUNCA extraídos, mesma regra de extract_financas.py/
extract_dashboard_df.py. `military_name` também fica de fora por padrão
(mesmo princípio de efetivo.json: nome só sai numa "lista" explicitamente
aprovada pelo usuário para uma tela de detalhe — não existe pedido de tela
de detalhe de militar vacinado). O evento carrega só o suficiente pra
reconstruir os agregados dos 3 primeiros quadrantes (nenhum precisa de
identidade individual): data, posto, campanha, vacina, marca, OME. O nome
do aplicador entra (é quem vacinou, atuando em capacidade profissional —
não o vacinado, e já é o que a Aba 2 "Profissionais com maior número de
aplicações" precisa mostrar), mas `applicator_record`/`applicator_cpf`
nunca saem. `military_registration` (matrícula) é a ÚNICA exceção: entra
só como CHAVE DE CRUZAMENTO em memória, pra montar a matriz agregada da
Aba 4 (ver `extrair_participacao_atual`) — nunca é escrita no JSON de
saída, só a contagem resultante.

Normalização de OME: o campo `ome_acronym` da origem tem sujeira solta
(ver scratchpad/omes.txt) — "9°" com sinal de grau em vez de "9º" ordinal,
"DIRETORIA DE GESTÃO DE PESSOAL." com ponto duplicado, "CPPA" (extinta,
soma em DGP — mesma regra já confirmada com o usuário em Viaturas/Finanças).
Além disso, `mapeamento_unidades.json` cobre 7 unidades com grafia/
abreviação diferente da usada em efetivo.json/organograma (ex. "CG" ->
"COMANDO GERAL", "DINTER / 1" -> "DINTER I") — levantado comparando as 51
OMEs normalizadas da Vacinação contra as 44 de efetivo.json por chave sem
acento/espaço/pontuação (2026-09-21, pedido do usuário: só mapear o que for
comprovadamente a MESMA unidade, não achismo). Isso NÃO é um de-para
completo contra o organograma: o DW já registrou (DW_CATALOGO_FONTES.md,
"Quantas unidades cada sistema conhece") que a Vacinação tem 91 OMEs na
origem contra ~46 do organograma — reconciliar tudo é tarefa maior, ainda
pendente ("a levantar"), fora do escopo deste painel. 6 categorias ficam de
fora do mapeamento por não terem correspondência real em efetivo.json: "10º
GB" e "COINTER / 1"/"COM"/"DAT" (unidades reais que a fonte da Vacinação já
conhece e o organograma ainda não modela), "INATIVOS" e "LIC / DGP"
(categorias de situação funcional, não unidades — corretamente sem
efetivo ativo correspondente).
"""
import json
import os
import re
from pathlib import Path

import psycopg2

ROOT = Path(__file__).resolve().parents[2]
MAPEAMENTO_PATH = Path(__file__).resolve().parent / "mapeamento_unidades.json"
OUTPUT_PATH = ROOT / "src" / "data" / "real" / "vacinacao_dashboard.json"

_MAPEAMENTO = {k: v for k, v in json.loads(MAPEAMENTO_PATH.read_text(encoding="utf-8")).items() if not k.startswith("_")}


def normalizar_ome(bruto):
    if not bruto:
        return bruto
    a = bruto.strip().replace("°", "º")
    if a in ("DIRETORIA DE GESTÃO DE PESSOAL.", "DGP."):
        a = "DGP"
    if a == "CPPA":
        a = "DGP"
    return _MAPEAMENTO.get(a, a)


def normalizar_marca(bruto):
    if not bruto:
        return None
    m = bruto.strip()
    # "FUNDAÇÃO OSVALDO CRUZ" é o nome por extenso da FIOCRUZ (Fundação
    # Oswaldo Cruz) — mesma fabricante com grafia diferente na origem, 19
    # das 193 linhas com essa marca.
    if m.upper() == "FUNDAÇÃO OSVALDO CRUZ":
        m = "FIOCRUZ"
    return m


CONECTORES_NOME = {"de", "da", "do", "das", "dos", "e"}


def capitalizar_nome(bruto):
    if not bruto:
        return None
    # `applicator_name` mistura TUDO MAIÚSCULO com Title Case normal
    # (ex. "ANDREZA KELLY NOGUEIRA COSTA" vs "Ana Cláudia Souza e Silva
    # Marcelino") — trata tudo como se fosse maiúsculo puro e capitaliza de
    # novo, mantendo conectores (de/da/do/das/dos/e) minúsculos quando não
    # são a primeira palavra.
    palavras = bruto.strip().split()
    capitalizadas = []
    for i, p in enumerate(palavras):
        pl = p.lower()
        capitalizadas.append(pl if (i > 0 and pl in CONECTORES_NOME) else pl[:1].upper() + pl[1:])
    return " ".join(capitalizadas)


def normalizar_matricula(bruto):
    # Formatos diferentes entre as duas fontes: efetivo_lista.json grava
    # "798009-4" (dígito verificador com traço); a Vacinação grava
    # "7980094" (mesmo número, sem traço). Tirar o traço basta — 907 dos
    # 1.196 militares vacinados batem direto (o resto são inativos/
    # licenciados, sem linha em efetivo_lista.json, corretamente).
    return (bruto or "").strip().replace("-", "")


def normalizar_posto(bruto):
    if not bruto:
        return None
    # `vaccination_post` é texto livre lançado por posto — mesma sujeira de
    # maiúscula/minúscula, espaço sobrando e sinal de grau vs. ordinal já
    # vista em ome_acronym, aqui pior: "cas"/"CAS", "GBMar"/"Gbmar "/"GBMAR",
    # "7ºGB" sem espaço, "4GB" sem o ordinal. Sem essa limpeza, "GBMAR"
    # aparecia como 2 barras separadas no gráfico (110 + 28) — mesmo posto.
    # "1º"/"PS"/"TRANCRIÇÃO" ficam como estão: sem forma inequívoca de saber
    # a que se referem (ver scratchpad/postos.txt, levantado em 2026-09-21).
    p = bruto.strip().upper().replace("°", "º")
    p = re.sub(r"^(\d+)GB$", r"\1º GB", p)
    p = re.sub(r"^(\d+º)GB$", r"\1 GB", p)
    return p


def extrair_eventos(cur):
    cur.execute("""
        select vaccination_date, vaccination_post, campaign_name, vaccine_name,
               vaccine_brand_name, ome_acronym, applicator_name
        from vw_vaccinations_dashboard
        order by vaccination_date
    """)
    eventos = []
    for data, posto, campanha, vacina, marca, ome, aplicador in cur.fetchall():
        eventos.append({
            "data": data.isoformat() if data else None,
            "posto": normalizar_posto(posto),
            "campanha": (campanha or "").strip() or None,
            "vacina": (vacina or "").strip() or None,
            "marca": normalizar_marca(marca),
            "ome": normalizar_ome(ome),
            "aplicador": capitalizar_nome(aplicador),
        })
    return eventos


# COMANDO GERAL/SUBCOMANDO GERAL em efetivo_lista.json são o TITULAR
# sozinho (1 militar) — não uma OME própria. Conta no efetivo do GABINETE
# (GCG/GSG), mesma correção aplicada no front (src/lib/antiguidadeOme.js,
# DOBRA_GABINETE) e no de-para da Vacinação (CG/SCG -> GCG/GSG, ver
# mapeamento_unidades.json). Espelhado aqui pra "Efetivo Atual da OME"/
# "Militares que tomaram" baterem entre extrator e frontend.
DOBRA_GABINETE = {"COMANDO GERAL": "GCG", "SUBCOMANDO GERAL": "GSG"}


def carregar_ome_atual_por_matricula():
    # efetivo_lista.json é o retrato ATUAL do efetivo (fonte SGP, já
    # extraído — não precisa de outra conexão de banco), matricula -> OME de
    # hoje. É a autoridade pra "onde esse militar está lotado agora", mais
    # confiável que o `ome_id` da própria base de Vacinação: esse último não
    # tem granularidade histórica nenhuma (é 1 valor por pessoa, igual em
    # TODOS os eventos dela, mesmo anos depois — confirmado consultando 5
    # militares com vacinações de 2021 a 2026, sempre a mesma OME nas 9-11
    # linhas de cada um) e pode estar desatualizado frente ao SGP.
    path = ROOT / "src" / "data" / "real" / "efetivo_lista.json"
    dados = json.loads(path.read_text(encoding="utf-8"))
    mapa = {}
    for sigla, militares in dados["por_unidade"].items():
        sigla_final = DOBRA_GABINETE.get(sigla, sigla)
        for m in militares:
            mapa[normalizar_matricula(m["matricula"])] = sigla_final
    return mapa


def extrair_participacao_atual(cur, ome_atual_por_matricula):
    # Matriz (vacina, OME ATUAL) -> militares DISTINTOS que estão nessa OME
    # HOJE (efetivo_lista.json) e já tomaram aquela vacina, não importa em
    # qual OME estavam quando tomaram (ver docstring do módulo e
    # carregar_ome_atual_por_matricula). Quem não está no efetivo ativo hoje
    # (inativo, licenciado, adido em outro balde etc.) fica de fora — não
    # existe "OME atual" pra somar, e contá-lo em qualquer categoria
    # inflaria o numerador sem uma OME real como denominador.
    #
    # Nunca expõe matrícula nem qualquer identificador individual no JSON de
    # saída — só a contagem já agregada por set() em memória (mesma
    # minimização do resto do extrator).
    cur.execute("select vaccine_name, military_registration from vw_vaccinations_dashboard")
    grupos = {}
    for vacina, matricula in cur.fetchall():
        ome_atual = ome_atual_por_matricula.get(normalizar_matricula(matricula))
        if ome_atual is None:
            continue
        chave = ((vacina or "").strip() or None, ome_atual)
        grupos.setdefault(chave, set()).add(normalizar_matricula(matricula))
    return [
        {"vacina": vacina, "ome": ome, "militares": len(militares)}
        for (vacina, ome), militares in grupos.items()
    ]


def main():
    ome_atual_por_matricula = carregar_ome_atual_por_matricula()
    conn = psycopg2.connect(os.environ["DATABASE_URL_OPS"], connect_timeout=20)
    try:
        cur = conn.cursor()
        eventos = extrair_eventos(cur)
        participacao = extrair_participacao_atual(cur, ome_atual_por_matricula)
    finally:
        conn.close()

    saida = {"eventos": eventos, "participacao": participacao}
    OUTPUT_PATH.write_text(json.dumps(saida, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{len(eventos)} eventos de vacinação, {len(participacao)} pares (vacina, OME) -> {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
