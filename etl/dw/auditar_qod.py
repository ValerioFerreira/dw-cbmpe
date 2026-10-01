# requirements:
# openpyxl, psycopg2-binary
"""Auditoria do QOD -- gera o anexo do relatorio para a DPlaG e a CPPA.

Compara (1) a planilha QOD CONFERENCIA (a que o ETL le: funcoes da DPlaG e
ocupantes da CPPA), (2) o QOD formatado de setembro (quadros por unidade e
secao) e (3) o Peculio (fonte da verdade de matricula e de titular).
NAO corrige nada.

Uso:
    DATABASE_URL_DW_ETL=... python auditar_qod.py conferencia.xlsx quadros.xlsx saida.xlsx
"""
import json
import os
import re
import sys
import unicodedata
from collections import Counter, defaultdict

import openpyxl
import psycopg2

POSTOS_QUADRO = ["Cel", "Ten Cel", "Maj QOC", "Cap QOC", "1ºTen QOC", "2ºTen QOC",
                 "Maj QOA", "Cap QOA", "1ºTen QOA", "2ºTen QOA",
                 "Subten", "1ºSgt", "2ºSgt", "3ºSgt", "Cb", "Sd"]
# colunas do quadro (0-based): CEL..2TEN QOC = 1..6, SOMA=7, QOA 8..11, SOMA=12, pracas 13..18, SOMA=19, TOTAL=20
COL_POSTO = dict(zip(POSTOS_QUADRO, [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 13, 14, 15, 16, 17, 18]))
PAR_QUADRO = {"CATSER": "CATSE", "DINTER1": "DINTERI", "DINTER2": "DINTERII"}
SOMA_GABINETE = {"GCG": ["COMANDO", "GCG"], "GSG": ["SUBCOMANDO", "GSG"]}


def norm(s):
    s = unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode().upper()
    return re.sub(r"[^A-Z0-9]", "", s)


def tabela(wb, nome):
    rows = list(wb[nome].iter_rows(values_only=True))
    h = [str(x).strip() if x not in (None, "") else f"c{i}" for i, x in enumerate(rows[0])]
    return [dict(zip(h, r), _linha=i) for i, r in enumerate(rows[1:], start=2)
            if any(x not in (None, "") for x in r)]


def num(x):
    try:
        return int(float(x))
    except (TypeError, ValueError):
        return 0


def chave_unidade_quadro(rotulo):
    """'3.2.2. 1º GB Vitoria Stº Antão' -> '1GB'; '3.1.5 CAT/RMR' -> 'CATRMR'."""
    t = re.sub(r"^\d+(\.\d+)*[\.\)]?\s*", "", str(rotulo).strip())
    m = re.match(r"(\d+º GB)", t)
    if m:
        return norm(m.group(1))
    palavras = t.split()
    if palavras[0].upper() == "DINTER" and len(palavras) > 1:
        return norm(palavras[0] + palavras[1])  # DINTER I -> DINTERI ; DINTER II -> DINTERII
    return norm(palavras[0])


def quadros_gerais(wb):
    out = {}
    for r in wb["GERAL 001"].iter_rows(values_only=True):
        a = r[0]
        if isinstance(a, str) and re.match(r"^\d", a.strip()) and r[20] not in (None, ""):
            out[chave_unidade_quadro(a)] = {"rotulo": a.strip(), "TOTAL": num(r[20]),
                                            **{p: num(r[c]) for p, c in COL_POSTO.items()}}
    return out


def quadro_da_unidade(ger, k):
    """Quadro da unidade da DPlaG. GCG e GSG somam o Comando/Subcomando Geral."""
    if k in SOMA_GABINETE:
        partes = [ger.get(x) for x in SOMA_GABINETE[k]]
        if all(partes):
            return ({p: sum(x[p] for x in partes) for p in POSTOS_QUADRO + ["TOTAL"]},
                    " + ".join(x["rotulo"] for x in partes))
        return None, None
    q = ger.get(PAR_QUADRO.get(k, k))
    return (q, q["rotulo"]) if q else (None, None)


def main(conferencia, quadros, saida):
    wc = openpyxl.load_workbook(conferencia, data_only=True)
    wq = openpyxl.load_workbook(quadros, data_only=True)
    ger = quadros_gerais(wq)
    wbo = openpyxl.Workbook()
    resumo = {}

    # --- 1. previsto: vagas FUNCIONAL da DPlaG x quadro de setembro
    por_un, por_un_posto = Counter(), Counter()
    for v in tabela(wc, "FUNÇÕES DPLAG"):
        if v.get("TIPO VAGA") == "FUNCIONAL" and v.get("OME"):
            k = norm(v["OME"])
            por_un[k] += 1
            por_un_posto[(k, str(v.get("FUNÇÃO DE:") or "").strip())] += 1

    ws = wbo.active
    ws.title = "Previsto por unidade"
    ws.append(["Unidade (aba FUNÇÕES DPLAG)", "Vagas FUNCIONAIS (DPlaG)", "Quadro Setembro (GERAL 001)",
               "Diferença (DPlaG − quadro)", "Rótulo no quadro"])
    comparadas, sem_par = [], []
    for k in sorted(por_un):
        q, rot = quadro_da_unidade(ger, k)
        if q is None:
            ws.append([k, por_un[k], None, None, "sem par no quadro"]); sem_par.append(k)
        else:
            ws.append([k, por_un[k], q["TOTAL"], por_un[k] - q["TOTAL"], rot])
            comparadas.append((k, por_un[k], q["TOTAL"]))
    resumo["unidades_comparadas"] = len(comparadas)
    resumo["unidades_sem_par"] = sem_par
    resumo["unidades_que_diferem"] = [(k, a, b) for k, a, b in comparadas if a != b]

    total_geral = None
    for r in wq["GERAL 001"].iter_rows(values_only=True):
        if isinstance(r[0], str) and r[0].strip().upper() == "TOTAL GERAL":
            total_geral = {p: num(r[c]) for p, c in COL_POSTO.items()}
            total_geral["TOTAL"] = num(r[20])
    posto_dw = Counter()
    for (_, p), n in por_un_posto.items():
        posto_dw[p] += n
    ws2 = wbo.create_sheet("Previsto por posto (total)")
    ws2.append(["Posto/graduação", "Vagas FUNCIONAIS (DPlaG)", "Quadro Setembro", "Diferença"])
    for p in POSTOS_QUADRO:
        ws2.append([p, posto_dw.get(p, 0), total_geral[p], posto_dw.get(p, 0) - total_geral[p]])
    ws2.append(["TOTAL", sum(por_un.values()), total_geral["TOTAL"], sum(por_un.values()) - total_geral["TOTAL"]])
    resumo["total_geral_quadro"] = total_geral
    resumo["total_funcional_dplag"] = sum(por_un.values())
    resumo["por_posto"] = {p: (posto_dw.get(p, 0), total_geral[p]) for p in POSTOS_QUADRO}

    ws3 = wbo.create_sheet("Unidade x posto (diferenças)")
    ws3.append(["Unidade", "Posto/graduação", "Vagas DPlaG", "Quadro Setembro", "Diferença"])
    n_dif = 0
    for k, _, _ in comparadas:
        q, _ = quadro_da_unidade(ger, k)
        for p in POSTOS_QUADRO:
            a, b = por_un_posto.get((k, p), 0), q[p]
            if a != b:
                ws3.append([k, p, a, b, a - b]); n_dif += 1
    resumo["celulas_unidade_posto_que_diferem"] = n_dif

    # --- 2. QOD_FUNCOES (AGOSTO) x ID_ATUALIZADO (SETEMBRO)
    ago_l = [r for r in tabela(wc, "QOD_FUNCOES") if r.get("ID_FUNCAO")]
    set_l = [r for r in tabela(wc, "ID_ATUALIZADO") if r.get("ID_FUNCAO")]
    ago, set_ = {r["ID_FUNCAO"]: r for r in ago_l}, {r["ID_FUNCAO"]: r for r in set_l}
    mesma = sum(1 for i in ago if i in set_ and str(ago[i].get("FUNÇÃO_COMPLETA") or "").strip()
                == str(set_[i].get("FUNÇÃO_COMPLETA") or "").strip())
    chave = lambda r: (str(r.get("OME") or "").strip(), str(r.get("SEÇÃO") or "").strip(), str(r.get("FUNÇÃO") or "").strip())
    ca, cs = Counter(chave(r) for r in ago_l), Counter(chave(r) for r in set_l)
    ws4 = wbo.create_sheet("Agosto x Setembro (funções)")
    ws4.append(["Situação", "OME", "Seção", "Função", "Quantidade"])
    for k, n in sorted((ca - cs).items()):
        ws4.append(["só em agosto (QOD_FUNCOES)", *k, n])
    for k, n in sorted((cs - ca).items()):
        ws4.append(["só em setembro (ID_ATUALIZADO)", *k, n])
    resumo["agosto_x_setembro"] = {
        "funcoes_agosto": len(ago_l), "funcoes_setembro": len(set_l),
        "ids_que_apontam_para_a_mesma_funcao": mesma,
        "ids_que_apontam_para_outra_funcao": sum(1 for i in ago if i in set_) - mesma,
        "funcoes_so_em_agosto": sum((ca - cs).values()), "funcoes_so_em_setembro": sum((cs - ca).values())}

    # --- 3. ocupantes (QOD_CONSOLIDADA) x Peculio
    cons = tabela(wc, "QOD_CONSOLIDADA")
    c = psycopg2.connect(os.environ["DATABASE_URL_DW_ETL"])
    c.set_session(readonly=True)
    cur = c.cursor()
    cur.execute("select matricula, nome, posto_grad, ome, ordem from stg.peculio")
    pec = {r[0]: r for r in cur.fetchall()}
    pec_nome = defaultdict(list)
    for r in pec.values():
        pec_nome[norm(r[1])].append(r)
    ws5 = wbo.create_sheet("Ocupantes x Pecúlio")
    ws5.append(["Linha na QOD_CONSOLIDADA", "Apontamento", "Matrícula (QOD)", "Nome (QOD)", "Posto (QOD)",
                "Função (código)", "Unidade (QOD)", "Matrícula (Pecúlio)", "Posto (Pecúlio)", "OME (Pecúlio)"])
    cont = Counter()
    funcoes_por_mat = defaultdict(list)
    for r in cons:
        mat = re.sub(r"\D", "", str(r.get("MATRÍCULA") or ""))
        if not mat:
            continue
        funcoes_por_mat[mat].append(r)
        p = pec.get(mat)
        dados = [r.get("MATRÍCULA"), r.get("NOME COMPLETO"), r.get("POSTO/GRAD"), r.get("CÓDIGO"), r.get("UNIDADE")]
        if not p:
            alt = pec_nome.get(norm(r.get("NOME COMPLETO")))
            if alt:
                ws5.append([r["_linha"], "matrícula diferente da do Pecúlio (mesmo nome)"] + dados
                           + [alt[0][0], alt[0][2], alt[0][3]])
                cont["matricula_diferente_mesmo_nome"] += 1
            else:
                ws5.append([r["_linha"], "matrícula e nome fora do Pecúlio (efetivo ativo)"] + dados + ["", "", ""])
                cont["fora_do_peculio"] += 1
            continue
        pq, pp = norm(r.get("POSTO/GRAD")), norm(p[2])
        if pq != pp and not (pq in pp or pp in pq):
            ws5.append([r["_linha"], "posto diferente do Pecúlio"] + dados + [p[0], p[2], p[3]])
            cont["posto_diferente"] += 1
    for mat, rs in funcoes_por_mat.items():
        if len(rs) > 1:
            cont["militar_em_mais_de_uma_funcao"] += 1
            for r in rs:
                ws5.append([r["_linha"], f"mesmo militar em {len(rs)} funções", r.get("MATRÍCULA"),
                            r.get("NOME COMPLETO"), r.get("POSTO/GRAD"), r.get("CÓDIGO"), r.get("UNIDADE"), mat, "", ""])
    resumo["ocupantes"] = dict(cont)
    resumo["n_ocupantes_linhas"] = len(cons)

    # --- 4. defeitos de nome nas abas do arquivo de quadros
    nomes = wq.sheetnames
    ws6 = wbo.create_sheet("Arquivo de quadros")
    ws6.append(["Apontamento", "Detalhe"])
    numeros = Counter(re.search(r"(\d{3})\s*$", n).group(1) for n in nomes if re.search(r"(\d{3})\s*$", n))
    repetidos = {}
    for n_, q in numeros.items():
        if q > 1:
            repetidos[n_] = [x for x in nomes if x.strip().endswith(n_)]
            ws6.append(["Número de quadro repetido", f"{n_}: " + "; ".join(repetidos[n_])])
    fora_padrao = [n for n in nomes if re.search(r"SB\d", n) or "  " in n]
    for n in fora_padrao:
        ws6.append(["Nome de aba fora do padrão", n])
    ws6.append(["Mês do quadro geral", "GERAL 001 diz JULHO 2026; a CAPA diz SETEMBRO 2026"])
    ws6.append(["Aba da QOD CONFERÊNCIA ainda no mês anterior",
                "QOD_FUNCOES e RIANZI QOD_FUNCOES dizem AGOSTO; ID_ATUALIZADO diz SETEMBRO"])
    resumo["numeros_de_quadro_repetidos"] = repetidos
    resumo["abas_fora_do_padrao"] = fora_padrao
    for w in wbo.worksheets:
        for col in w.iter_cols(min_row=1, max_row=1):
            w.column_dimensions[col[0].column_letter].width = 26
    wbo.save(saida)
    json.dump(resumo, open(saida.replace(".xlsx", ".json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1,
              default=str)
    print(json.dumps(resumo, ensure_ascii=False, indent=1, default=str))


if __name__ == "__main__":
    main(*sys.argv[1:4])
