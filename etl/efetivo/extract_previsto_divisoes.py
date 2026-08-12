"""Extrai o efetivo previsto por divisão/seção interna de cada unidade,
a partir das abas individuais do QOD (uma aba por unidade, ex. "GBI 012",
"DGP 080") — complementa extract_previsto.py, que só lê o total por
unidade na aba "GERAL 001".

Cada aba de unidade tem uma árvore de seções numeradas (ex. "1) Comando",
"2) Subcomando", "4.4) 1ª Seção de Bombeiros... - 1ª SBI/GBI"), cada uma
com linhas-filho (ex. "a. Comandante") que têm o previsto na coluna
TOTAL (U). O script:

1. Lê SUBSETORES de src/data/organograma.js (fonte de verdade da lista de
   divisões que o app já exibe por unidade) via extração de texto do
   próprio arquivo-fonte, para nunca ficar dessincronizado.
2. Para cada unidade, faz o parse da árvore de seções da aba QOD
   correspondente e casa cada divisão de SUBSETORES com um nó da árvore
   (por texto exato, depois por abreviação após " - ", depois por posição
   entre os nós/alvos do tipo "seção operacional" ainda não casados — cobre
   o caso de rótulos duplicados por erro de digitação no QOD, ex. 3º GB).
3. Calcula o previsto de cada divisão como um "rollup" que soma os
   valores próprios do nó e de todos os descendentes NÃO reivindicados por
   outra divisão (ex.: em GBI, "Divisão de Operações" soma Chefe/Auxiliares
   + núcleos internos, mas NÃO as SBIs, que são divisões próprias na nossa
   lista).
4. Nós de topo não casados com nenhuma divisão de SUBSETORES viram
   divisões extras (ex. CPPA, que soma dentro de DGP por decisão já
   registrada em DW_PLANEJAMENTO.md).
5. Valida a soma por unidade contra src/data/real/efetivo_previsto.json
   (já confirmado, total 5249) — aborta se não bater.

Uso:
    python etl/efetivo/extract_previsto_divisoes.py "<caminho do xlsx>"
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[2]
ORGANOGRAMA_JS = ROOT / "src" / "data" / "organograma.js"
PREVISTO_UNIDADE_JSON = ROOT / "src" / "data" / "real" / "efetivo_previsto.json"
OUT_JSON = ROOT / "src" / "data" / "real" / "efetivo_previsto_divisoes.json"

COL_DISCRIMINACAO = 1
COL_TOTAL = 21

PADRAO_SECAO_OPERACIONAL = re.compile(r"\bSB(APH|SA|FN|I|S)?\b|\bSATec\b", re.IGNORECASE)
PADRAO_HEADER = re.compile(r"^(\d+(?:\.\d+)*)\)\s*(.+)$")
PADRAO_BODY = re.compile(r"^[a-z]\.\s")

# sigla -> índice da aba de unidade no QOD (posição em wb.sheetnames)
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
# sigla -> [(índice da aba extra, rótulo da divisão extra)] — unidades que
# somam efetivo de uma aba "satélite" que não está na lista de SUBSETORES
# (ex. CPPA soma em DGP — decisão já registrada em DW_PLANEJAMENTO.md).
EXTRA_SHEETS = {
    "DGP": [(81, "CPPA")],
}
# ARVORE (copiada de organograma.js) — usada só para filtrar, de SUBSETORES,
# os itens que são unidades-filhas (não divisões internas), igual à regra
# de divisoesDaSigla() em organograma.js.
ARVORE = {
    "COMANDO GERAL": ["SUBCOMANDO GERAL", "GCG", "CI", "CPO", "AECI", "CCS"],
    "SUBCOMANDO GERAL": ["DGO", "DGA", "GSG", "AJG", "CPP"],
    "DGO": ["DIM", "DINTER I", "DINTER II", "DIESP"],
    "DIM": ["GBI", "GBAPH", "GBS", "GBMar", "CAT/RMR"],
    "DINTER I": ["1º GB", "2º GB", "6º GB", "7º GB", "CAT/ZM", "CAT/AG"],
    "DINTER II": ["3º GB", "4º GB", "5º GB", "9º GB", "CAT/SE"],
    "DGA": ["DGP", "DVP", "DJD", "DF", "DAS", "DTIC", "DLOG", "DEIP", "DPLAG"],
    "DLOG": ["CMAN", "CINT", "CEAO"],
    "DEIP": ["ABMG", "CEFD"],
}


def normalizar(s):
    s = s.strip()
    s = re.sub(r"^↳\s*", "", s)
    s = re.sub(r"\s*\([^)]*\)\s*$", "", s)
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.lower()
    s = re.sub(r"\s+", " ", s).strip()
    return s


def variantes(titulo):
    """Gera variações de comparação de um título de divisão: texto completo,
    só a abreviação (depois do último hífen) e o nome sem a abreviação — o
    QOD tem inconsistências de digitação (hífen sem espaço, abreviação
    colada ao número) então cada variação também entra numa forma "solta"
    (sem espaços/hífens) para tolerar isso."""
    vs = {normalizar(titulo)}
    partes = re.split(r"\s*-\s*", titulo)
    if len(partes) >= 2:
        vs.add(normalizar(partes[-1]))
        vs.add(normalizar(" - ".join(partes[:-1])))
    soltas = {re.sub(r"[\s-]+", "", v) for v in vs}
    return vs | soltas


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
    bloco = bloco.replace("'", '"')
    bloco = re.sub(r",(\s*[\]}])", r"\1", bloco)
    return json.loads(bloco)


def divisoes_da_sigla(sigla, subsetores):
    filhos = set(ARVORE.get(sigla, []))
    itens = [item for item in subsetores.get(sigla, []) if item not in filhos]
    return [re.sub(r"^↳\s*", "", item) for item in itens]


class No:
    __slots__ = ("titulo", "numeracao", "nivel", "proprio", "filhos", "pai", "claimed")

    def __init__(self, titulo, numeracao):
        self.titulo = titulo
        self.numeracao = numeracao
        self.nivel = len(numeracao)
        self.proprio = 0.0
        self.filhos = []
        self.pai = None
        self.claimed = False


def parsear_arvore(ws):
    raizes = []
    pilha = []  # [(nivel, No)]
    total_planilha = None
    for row in ws.iter_rows(min_row=7, max_row=ws.max_row):
        a = row[COL_DISCRIMINACAO - 1].value
        if a is None:
            continue
        a = str(a).strip()
        if not a:
            continue
        if a.upper().startswith("TOTAL"):
            u = row[COL_TOTAL - 1].value
            total_planilha = float(u) if isinstance(u, (int, float)) else None
            break
        m = PADRAO_HEADER.match(a)
        if m:
            numeracao = tuple(int(x) for x in m.group(1).split("."))
            no = No(m.group(2).strip(), numeracao)
            while pilha and pilha[-1][0] >= no.nivel:
                pilha.pop()
            if pilha:
                no.pai = pilha[-1][1]
                pilha[-1][1].filhos.append(no)
            else:
                raizes.append(no)
            pilha.append((no.nivel, no))
            continue
        if PADRAO_BODY.match(a) and pilha:
            u = row[COL_TOTAL - 1].value
            if isinstance(u, (int, float)):
                pilha[-1][1].proprio += float(u)
    return raizes, total_planilha


def achatar(raizes):
    out = []

    def visitar(no):
        out.append(no)
        for f in no.filhos:
            visitar(f)

    for r in raizes:
        visitar(r)
    return out


def rollup(no):
    total = no.proprio
    for f in no.filhos:
        if f.claimed:
            continue
        total += rollup(f)
    return total


def rollup_completo(no):
    total = no.proprio
    for f in no.filhos:
        total += rollup_completo(f)
    return total


def extrair_divisoes_unidade(ws, alvos):
    raizes, total_planilha = parsear_arvore(ws)
    nos = achatar(raizes)

    resultado = {}
    nao_casados = list(alvos)

    # Passo 1: correspondência exata de texto (só quando único candidato).
    ainda = []
    for alvo in nao_casados:
        vs_alvo = variantes(alvo)
        candidatos = [n for n in nos if not n.claimed and (variantes(n.titulo) & vs_alvo)]
        if len(candidatos) == 1:
            candidatos[0].claimed = True
            resultado[alvo] = candidatos[0]
        else:
            ainda.append(alvo)
    nao_casados = ainda

    # Passo 2: fallback posicional para seções operacionais (SB/SATec) —
    # cobre rótulos duplicados por erro de digitação no QOD.
    alvos_op_restantes = [a for a in nao_casados if PADRAO_SECAO_OPERACIONAL.search(a)]
    nos_op_restantes = [n for n in nos if not n.claimed and PADRAO_SECAO_OPERACIONAL.search(n.titulo)]
    for alvo, no in zip(alvos_op_restantes, nos_op_restantes):
        no.claimed = True
        resultado[alvo] = no
        nao_casados.remove(alvo)

    divisoes = []
    for alvo in alvos:
        no = resultado.get(alvo)
        divisoes.append({"nome": alvo, "previsto": int(round(rollup(no))) if no else 0})

    extras = []
    for raiz in raizes:
        if not raiz.claimed:
            extras.append({"nome": raiz.titulo, "previsto": int(round(rollup(raiz)))})

    soma_total = sum(d["previsto"] for d in divisoes) + sum(e["previsto"] for e in extras)
    return divisoes, extras, soma_total, total_planilha, nao_casados


def main():
    if len(sys.argv) < 2:
        raise SystemExit("uso: extract_previsto_divisoes.py <caminho do xlsx>")
    caminho = sys.argv[1]

    subsetores = carregar_subsetores()
    previstos_unidade = json.loads(PREVISTO_UNIDADE_JSON.read_text(encoding="utf-8"))["por_unidade"]

    wb = openpyxl.load_workbook(caminho, data_only=True)

    por_unidade = {}
    avisos = []

    for sigla, idx in SIGLA_SHEET_IDX.items():
        ws = wb[wb.sheetnames[idx]]
        alvos = divisoes_da_sigla(sigla, subsetores)
        divisoes, extras, soma, total_planilha, nao_casados = extrair_divisoes_unidade(ws, alvos)

        for (extra_idx, rotulo) in EXTRA_SHEETS.get(sigla, []):
            ws_extra = wb[wb.sheetnames[extra_idx]]
            _, total_extra = parsear_arvore(ws_extra)
            valor_extra = int(round(total_extra)) if total_extra is not None else 0
            extras.append({"nome": rotulo, "previsto": valor_extra})
            soma += valor_extra

        if nao_casados:
            avisos.append(f"{sigla}: divisões sem correspondência na aba: {nao_casados}")
        if total_planilha is not None and abs(soma - total_planilha) > 0.01 and not EXTRA_SHEETS.get(sigla):
            avisos.append(f"{sigla}: soma das divisões ({soma}) != TOTAL da aba ({total_planilha})")

        esperado = previstos_unidade.get(sigla)
        if esperado is not None and soma != esperado:
            avisos.append(f"{sigla}: soma ({soma}) != efetivo_previsto.json ({esperado})")

        por_unidade[sigla] = divisoes + extras

    if avisos:
        print("AVISOS:")
        for a in avisos:
            print(" -", a)

    total_geral = sum(d["previsto"] for divs in por_unidade.values() for d in divs)

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(
        json.dumps(
            {
                "fonte": (
                    "QOD (08 - QOD - AGOSTO - 2026.xlsx, abas por unidade) — "
                    "pendente de homologação/publicação em BGE"
                ),
                "por_unidade": por_unidade,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"\nOK: {len(por_unidade)} unidades, total previsto (divisões) = {total_geral}")
    print(f"Gravado em {OUT_JSON}")

    if avisos:
        raise SystemExit(f"\n{len(avisos)} aviso(s) acima — revisar antes de usar o resultado.")


if __name__ == "__main__":
    main()
