# requirements:
# openpyxl
"""Auditoria da planilha de Financas -- gera o anexo do relatorio da DF.

NAO corrige nada: so aponta. Le a aba "Banco de Dados - NAO MEXER" (a
consolidacao das demais abas) direto da planilha publicada -- a mesma URL de
etl/windmill/dw/raw_planilhas.py -- e escreve um .xlsx com uma aba por tipo de
apontamento, com a LINHA da aba para a DF achar o lancamento.

Uso:
    python auditar_planilha.py [saida.xlsx]
"""
import io
import re
import sys
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path

import openpyxl

import tratamento

RAIZ = Path(__file__).resolve().parents[2]
ABA = "Banco de Dados - NÃO MEXER"

# posicao 1-based de cada campo, por bloco (a mesma de carga_core.BLOCOS_FINANCAS,
# mais as colunas que o DW nao usa e a DF precisa para localizar o lancamento)
BLOCOS = {
    "Autorização": dict(oficio=1, item=2, sei=3, fonte=4, acao=5, nd=6, ficha=7, valor=8, descricao=9,
                        destino=10, enquadramento=11, situacao=12, mes=13, empenho=14,
                        liquidado=15, pago=16, data=17, obs=18),
    "Carnaval 2026": dict(oficio=20, item=21, sei=22, fonte=23, acao=24, nd=25, ficha=26, valor=27,
                          descricao=28, destino=29, enquadramento=30, situacao=31, mes=32, empenho=33,
                          liquidado=34, pago=35, data=36, obs=37),
    "SFI Ordinário": dict(fonte=39, acao=40, nd=41, natureza=42, ficha=43, valor=44, destino=45,
                          situacao=46, mes=47, empenho=48, liquidado=49, pago=50, data=51, obs=52),
}
TOLERANCIA = 0.005  # meio centavo


def url_da_planilha():
    src = (RAIZ / "etl" / "windmill" / "dw" / "raw_planilhas.py").read_text(encoding="utf-8")
    i = src.index('"financas": {')
    return re.search(r'"url":\s*"([^"]+)"', src[i:]).group(1)


def baixar():
    req = urllib.request.Request(url_da_planilha(), headers={"User-Agent": "Mozilla/5.0"})
    return urllib.request.urlopen(req, timeout=120).read()


def valor(x):
    """Mesma regra de stg.valor_monetario: devolve (numero|None, valido)."""
    if x is None or (isinstance(x, str) and not x.strip()):
        return None, True
    if isinstance(x, (int, float)):
        return float(x), True
    v = re.sub(r"[^0-9,.\-]", "", str(x))
    if not v:
        return None, False
    if "," in v:
        v2 = v.replace(".", "").replace(",", ".")
    else:
        v2 = v
    try:
        return float(v2), True
    except ValueError:
        return None, False


def texto(x):
    if x is None:
        return None
    t = str(x).strip()
    return t or None


def sei_publicavel(x):
    """O campo SEI as vezes traz texto livre (ate o nome do falecido nos
    lancamentos de auxilio funeral). So sai no relatorio o que parece numero de
    processo."""
    if x and not re.fullmatch(r"(SEI\s*)?[\d.\-/\s]+", x.strip()):
        return "(texto livre no campo SEI)"
    return x


def ler(wb):
    ws = wb[ABA]
    linhas = list(ws.iter_rows(values_only=True))
    regs = []
    for bloco, pos in BLOCOS.items():
        for n, r in enumerate(linhas[1:], start=2):
            def g(campo):
                p = pos.get(campo)
                return r[p - 1] if p and p - 1 < len(r) else None
            destino, situacao, v = texto(g("destino")), texto(g("situacao")), g("valor")
            if not (destino or situacao or texto(v)):
                continue
            val, ok_v = valor(g("valor"))
            liq, ok_l = valor(g("liquidado"))
            pag, ok_p = valor(g("pago"))
            regs.append(dict(
                bloco=bloco, linha=n, oficio=texto(g("oficio")), item=texto(g("item")), sei=sei_publicavel(texto(g("sei"))),
                ficha=texto(g("ficha")), destino=destino, enquadramento=texto(g("enquadramento")),
                situacao=situacao, mes=texto(g("mes")), empenho=texto(g("empenho")), data=texto(g("data")),
                natureza=texto(g("natureza")), valor=val, liquidado=liq, pago=pag,
                valor_txt=texto(g("valor")), liq_txt=texto(g("liquidado")), pago_txt=texto(g("pago")),
                formato_invalido=[c for c, ok, t in (("valor", ok_v, g("valor")), ("liquidado", ok_l, g("liquidado")),
                                                    ("pago", ok_p, g("pago"))) if not ok]))
    return regs


def auditar(regs):
    mapa_tipos = tratamento.construir_mapa_tipos([r["ficha"] for r in regs if r["ficha"]])
    ap = defaultdict(list)
    for r in regs:
        base = {k: r[k] for k in ("bloco", "linha", "oficio", "item", "sei", "destino", "enquadramento",
                                  "situacao", "mes", "valor", "liquidado", "pago")}
        v, l, p = r["valor"], r["liquidado"], r["pago"]
        if p is not None and l is not None and p > l + TOLERANCIA:
            ap["Pago maior que liquidado"].append({**base, "diferenca": round(p - l, 2)})
        elif p is not None and l is None and p > TOLERANCIA:
            ap["Pago sem liquidado"].append(base)
        if l is not None and v is not None and l > v + TOLERANCIA:
            ap["Liquidado maior que empenhado"].append({**base, "diferenca": round(l - v, 2)})
        if p is not None and v is not None and p > v + TOLERANCIA:
            ap["Pago maior que empenhado"].append({**base, "diferenca": round(p - v, 2)})
        if r["situacao"] != "EMPENHADO" and ((l or 0) > 0 or (p or 0) > 0):
            ap["Liquidado ou pago em situação diferente de EMPENHADO"].append(base)
        if r["situacao"] == "EMPENHADO" and not r["empenho"]:
            ap["EMPENHADO sem número de empenho"].append(base)
        faltas = [c for c, vazio in (("destino/OME", not r["destino"]), ("situação", not r["situacao"]),
                                     ("valor", r["valor"] is None), ("mês (EMPENHADO)", not r["mes"] and r["situacao"] == "EMPENHADO"),
                                     ("enquadramento", r["bloco"] == "Autorização" and not r["enquadramento"]),
                                     ("tipo de gasto (ficha)", not r["ficha"])) if vazio]
        if faltas:
            ap["Campos obrigatórios em branco"].append({**base, "campos_em_branco": ", ".join(faltas)})
        if r["formato_invalido"]:
            ap["Valor com formato inválido"].append({**base, "campos": ", ".join(r["formato_invalido"]),
                                                     "valor_txt": r["valor_txt"], "liq_txt": r["liq_txt"],
                                                     "pago_txt": r["pago_txt"]})
        if v is not None and v <= 0:
            ap["Valor zero ou negativo"].append(base)
        rot, _ = tratamento.tratar_mes(r["mes"])
        if r["mes"] and rot is None:
            ap["Mês que não é um mês"].append(base)
        elif r["mes"] and re.search(r"[^A-Za-zÇç/0-9\s]|\d{3,}|\s\S+\s", r["mes"].strip()) and len(r["mes"].strip()) > 9:
            ap["Mês com texto extra (tratado)"].append({**base, "mes_original": r["mes"], "mes_tratado": rot})
        elif r["mes"] and r["mes"].strip().upper() in ("MAIO", "MAI") and False:
            pass
        if r["ficha"] and mapa_tipos.get(r["ficha"]) != r["ficha"]:
            ap["Tipo de gasto com grafia diferente (tratado)"].append(
                {**base, "ficha": r["ficha"], "ficha_tratada": mapa_tipos[r["ficha"]]})
    # duplicidade: mesmo oficio+item no mesmo bloco, ou mesmo SEI+destino+valor+mes
    chaves = defaultdict(list)
    for r in regs:
        if r["oficio"] and r["item"]:
            chaves[(r["bloco"], r["oficio"], r["item"])].append(r)
    for k, rs in chaves.items():
        if len(rs) > 1:
            for r in rs:
                ap["Ofício + item repetidos"].append({"bloco": r["bloco"], "linha": r["linha"], "oficio": r["oficio"],
                                                     "item": r["item"], "sei": r["sei"], "destino": r["destino"],
                                                     "valor": r["valor"], "situacao": r["situacao"]})
    return ap, mapa_tipos


def variantes_de_destino(regs):
    return sorted(Counter(r["destino"] for r in regs if r["destino"]).items(), key=lambda kv: -kv[1])


def escrever(ap, mapa_tipos, regs, caminho):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Resumo"
    ws.append(["Apontamento", "Ocorrências"])
    for k, v in sorted(ap.items(), key=lambda kv: -len(kv[1])):
        ws.append([k, len(v)])
    ws.column_dimensions["A"].width = 62
    for nome, itens in ap.items():
        a = wb.create_sheet(re.sub(r"[\[\]:*?/\\]", "", nome)[:31])
        cols = list(itens[0].keys())
        a.append(cols)
        for i in itens:
            a.append([i.get(c) for c in cols])
        for c in a.iter_cols(min_row=1, max_row=1):
            a.column_dimensions[c[0].column_letter].width = 22
    t = wb.create_sheet("Tipos de gasto (grafia)")
    t.append(["Como está na planilha", "Como o sistema exibe", "Lançamentos"])
    cont = Counter(r["ficha"] for r in regs if r["ficha"])
    for o, n in sorted(mapa_tipos.items(), key=lambda kv: (kv[1], kv[0])):
        t.append([o, n, cont[o]])
    t.column_dimensions["A"].width = 58
    t.column_dimensions["B"].width = 58
    wb.save(caminho)


def main():
    saida = Path(sys.argv[1]) if len(sys.argv) > 1 else RAIZ / "docs" / "relatorios" / "DF_apontamentos.xlsx"
    saida.parent.mkdir(parents=True, exist_ok=True)
    wb = openpyxl.load_workbook(io.BytesIO(baixar()), data_only=True)
    regs = ler(wb)
    ap, mapa_tipos = auditar(regs)
    escrever(ap, mapa_tipos, regs, saida)
    print(f"{len(regs)} lançamentos lidos; anexo em {saida}")
    for k, v in sorted(ap.items(), key=lambda kv: -len(kv[1])):
        print(f"  {len(v):>4}  {k}")


if __name__ == "__main__":
    main()
