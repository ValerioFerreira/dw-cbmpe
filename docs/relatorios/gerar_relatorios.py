# requirements:
# python-docx, openpyxl, psycopg2-binary
"""Gera os dois relatorios (QOD e DF) em .docx, a partir dos anexos .xlsx que
etl/dw/auditar_qod.py e etl/financas/auditar_planilha.py produzem.

    DATABASE_URL_DW_ETL=... python gerar_relatorios.py
"""
import json
import os
import re
from datetime import date
from pathlib import Path

import openpyxl
import psycopg2
from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

AQUI = Path(__file__).resolve().parent
HOJE = date.today().strftime("%d/%m/%Y")
VERMELHO = RGBColor(0xB0, 0x1E, 0x1E)


def novo_documento(titulo, subtitulo):
    d = Document()
    sec = d.sections[0]
    sec.left_margin = sec.right_margin = Cm(2)
    sec.top_margin = sec.bottom_margin = Cm(2)
    st = d.styles["Normal"]
    st.font.name = "Calibri"
    st.font.size = Pt(10.5)
    for nome, tam in (("Heading 1", 15), ("Heading 2", 12.5), ("Heading 3", 11)):
        d.styles[nome].font.name = "Calibri"
        d.styles[nome].font.size = Pt(tam)
        d.styles[nome].font.color.rgb = RGBColor(0x1F, 0x2A, 0x44)
    p = d.add_paragraph()
    r = p.add_run("CORPO DE BOMBEIROS MILITAR DE PERNAMBUCO")
    r.bold = True
    r.font.size = Pt(9)
    p = d.add_paragraph()
    r = p.add_run(titulo)
    r.bold = True
    r.font.size = Pt(19)
    r.font.color.rgb = RGBColor(0x1F, 0x2A, 0x44)
    p = d.add_paragraph(subtitulo)
    p.runs[0].font.color.rgb = RGBColor(0x55, 0x55, 0x55)
    return d


def sombra(celula, cor):
    tc = celula._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), cor)
    tc.append(shd)


def tabela(d, cabecalho, linhas, larguras=None, tam=9, destaque=None):
    """destaque: funcao(linha)->bool, pinta a linha de amarelo claro."""
    t = d.add_table(rows=1, cols=len(cabecalho))
    t.style = "Table Grid"
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, h in enumerate(cabecalho):
        c = t.rows[0].cells[i]
        c.text = ""
        r = c.paragraphs[0].add_run(str(h))
        r.bold = True
        r.font.size = Pt(tam)
        r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
        sombra(c, "1F2A44")
    for lin in linhas:
        cels = t.add_row().cells
        for i, v in enumerate(lin):
            cels[i].text = ""
            txt = "" if v is None else (f"{v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
                                       if isinstance(v, float) else str(v))
            r = cels[i].paragraphs[0].add_run(txt)
            r.font.size = Pt(tam)
            if isinstance(v, (int, float)):
                cels[i].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.RIGHT
            if destaque and destaque(lin):
                sombra(cels[i], "FFF2CC")
    if larguras:
        for row in t.rows:
            for i, w in enumerate(larguras):
                row.cells[i].width = Cm(w)
    d.add_paragraph()
    return t


def marcador(d, texto, negrito_inicio=None):
    p = d.add_paragraph(style="List Bullet")
    if negrito_inicio:
        r = p.add_run(negrito_inicio)
        r.bold = True
    p.add_run(texto)
    return p


def brl(v):
    return "R$ " + f"{v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def folha(path, nome):
    ws = openpyxl.load_workbook(path, data_only=True)[nome]
    rows = list(ws.iter_rows(values_only=True))
    return rows[0], rows[1:]


# ---------------------------------------------------------------------------
# QOD
# ---------------------------------------------------------------------------
def relatorio_qod():
    res = json.load(open(AQUI / "QOD_apontamentos.json", encoding="utf-8"))
    xl = AQUI / "QOD_apontamentos.xlsx"
    d = novo_documento("Divergências entre as planilhas do QOD",
                       f"Relatório para a DPlaG e a CPPA — {HOJE} — Projeto CBMPE BI / Data Warehouse")

    d.add_heading("1. O que foi comparado e quem responde por quê", 1)
    d.add_paragraph(
        "Para alimentar o sistema do Comando (CBMPE BI), foram cruzadas duas planilhas do QOD e o Pecúlio. "
        "Nada foi corrigido: este relatório apenas aponta o que não bate, para que cada área decida o que ajustar. "
        "Ele está dividido pela responsabilidade de cada área:")
    marcador(d, " define quais funções existem e em qual OME e seção ficam (catálogo de funções, vagas e quadros de efetivo "
                "fixado). Parte A deste relatório.", "DPlaG —")
    marcador(d, " informa somente quem ocupa cada função (aba QOD_CONSOLIDADA). Parte B deste relatório.", "CPPA —")
    marcador(d, " o que depende das duas áreas ao mesmo tempo (ex.: lotação acima do previsto). Parte C.", "Em comum —")
    marcador(d, " é a planilha que o sistema lê todos os dias (link publicado). Abas usadas: FUNÇÕES DPLAG, QOD_FUNCOES, "
                "ID_ATUALIZADO e QOD_CONSOLIDADA.", "QOD CONFERÊNCIA")
    marcador(d, " é o QOD formatado, uma aba por quadro (efetivo fixado por lei, distribuição por unidade e por seção, por posto "
                "e graduação), lido pelo link de compartilhamento.", "QOD de setembro de 2026")
    marcador(d, " é a fonte da verdade para matrícula, posto e lotação dos militares (decisão do Comando).", "Pecúlio")
    d.add_paragraph(
        "Uso no sistema: nomenclatura e distribuição das funções por OME e seção vêm do catálogo da DPlaG (ID_ATUALIZADO, "
        "ID fixo por função) e dos quadros de setembro; os ocupantes vêm da QOD_CONSOLIDADA (CPPA), conferidos pelo Pecúlio.")

    d.add_heading("2. Resumo", 1)
    dif = res["unidades_que_diferem"]
    ag = res["agosto_x_setembro"]
    oc = res["ocupantes"]
    marcador(d, f" {res['total_funcional_dplag']:,}".replace(",", ".") +
             f" vagas FUNCIONAIS na aba FUNÇÕES DPLAG contra {res['total_geral_quadro']['TOTAL']:,}".replace(",", ".") +
             f" do efetivo fixado (LC nº 527/2023, quadro de setembro): {res['total_funcional_dplag'] - res['total_geral_quadro']['TOTAL']} "
             "vagas a mais na lista de funções.", "DPlaG — total:")
    marcador(d, f" das {res['unidades_comparadas']} unidades comparadas, {len(dif)} têm previsto diferente "
                "(a maior diferença é o 2º GB, com 186 vagas a mais na lista de funções).", "DPlaG — por unidade:")
    marcador(d, f" o ID_FUNCAO não é estável entre agosto e setembro ({ag['ids_que_apontam_para_outra_funcao']:,} de "
                f"{ag['ids_que_apontam_para_a_mesma_funcao'] + ag['ids_que_apontam_para_outra_funcao']:,} IDs apontam para outra função)."
             .replace(",", "."), "DPlaG — funções:")
    marcador(d, f" 1 matrícula diferente da do Pecúlio (mesmo nome), {oc['posto_diferente']} postos diferentes e "
                f"{oc['fora_do_peculio']} ocupantes que não estão no efetivo ativo do Pecúlio.", "CPPA — ocupantes:")

    # ------------------------------------------------------------------ Parte A
    d.add_heading("PARTE A — Para a DPlaG (funções, OME e quadros)", 1)

    d.add_heading("A1. Efetivo previsto por unidade", 2)
    d.add_paragraph("Vagas FUNCIONAIS da aba FUNÇÕES DPLAG × total do quadro de setembro (aba GERAL 001). "
                    "O Comandante-Geral e o Subcomandante-Geral estão na OME GCG e GSG da lista de funções, por isso "
                    "foram somados aos quadros 1) Comando Geral + 1.1 GCG e 2) Subcomando Geral + 2.1 GSG.")
    cab, linhas = folha(xl, "Previsto por unidade")
    linhas = [(re.sub(r"^(\d)O", r"\1º ", str(l[0])), l[1], l[2], l[3], l[4]) for l in linhas]
    linhas.sort(key=lambda l: (l[3] == 0, -abs(l[3] or 0), l[0]))
    tabela(d, ["Unidade", "Vagas DPlaG", "Quadro", "Diferença", "Rótulo no quadro"], linhas,
           larguras=[3, 2.2, 2.2, 2.2, 7], destaque=lambda l: l[3] not in (0, None))
    d.add_paragraph("Linhas em amarelo: unidades com diferença. As demais batem.")

    d.add_heading("A2. Por posto e graduação (corporação inteira)", 2)
    cab, linhas = folha(xl, "Previsto por posto (total)")
    tabela(d, list(cab), [tuple(l) for l in linhas], larguras=[4, 3.5, 3.5, 3], destaque=lambda l: l[3] != 0)
    d.add_paragraph(
        "A diferença de 163 vagas concentra-se nas praças (Sd +41, Cb +54, 3º Sgt +38, 2º Sgt +10, 1º Sgt +8, Subten +4) "
        "e nos oficiais QOC subalternos (Cap +3, 1º Ten +3, 2º Ten +2).")

    d.add_heading("A3. Unidade × posto", 2)
    d.add_paragraph("Todas as combinações em que as duas planilhas divergem (a lista completa está no anexo).")
    cab, linhas = folha(xl, "Unidade x posto (diferenças)")
    linhas = [(re.sub(r"^(\d)O", r"\1º ", str(l[0])),) + tuple(l[1:]) for l in linhas]
    tabela(d, list(cab), linhas, larguras=[3.2, 3.5, 3, 3.5, 3])

    d.add_heading("A4. Aba de funções: QOD_FUNCOES (agosto) × ID_ATUALIZADO (setembro)", 2)
    marcador(d, f" QOD_FUNCOES tem {ag['funcoes_agosto']:,} funções e ID_ATUALIZADO tem {ag['funcoes_setembro']:,}.".replace(",", "."),
             "Quantidade:")
    marcador(d, f" {ag['funcoes_so_em_agosto']} funções só existem na aba de agosto e {ag['funcoes_so_em_setembro']} só na de setembro "
                "(comparando OME, seção e nome da função, não o ID).", "Mudanças:")
    marcador(d, f" o ID_FUNCAO é renumerado: só {ag['ids_que_apontam_para_a_mesma_funcao']} IDs apontam para a mesma função nas duas abas. "
                "Isso impede acompanhar uma função de um mês para o outro. O ideal é o ID permanecer o mesmo enquanto a função existir "
                "(o sistema já usa o ID como chave).", "IDs instáveis:")
    marcador(d, " a 2ª SB do 6º GB (Bom Conselho) aparece como “1ª SB/6º GB” na aba de agosto, igual a Garanhuns, "
                "e como “2ª SB/6º GB” na de setembro. Em ambas, o campo OME_COMPLETA continua dizendo “1ª SEÇÃO DE BOMBEIROS DO 6º GB”.",
             "Seção do 6º GB:")
    marcador(d, " “Núcleo de CJustiça e Disciplina” (agosto) foi corrigido em setembro. Continuam: “Garanhus (Sede)” no campo "
                "LOCALIDADE (50 linhas, nas duas abas), “Subomando” (QOD_FUNCOES e QOD_CONSOLIDADA), “Asessoria de Relações "
                "Institucionais” e “Núcleo de Núcleo de Educação Física e Desportos” (ID_ATUALIZADO).", "Erros de digitação:")
    marcador(d, " a aba QOD_FUNCOES ainda está em AGOSTO; a de setembro é a ID_ATUALIZADO. Atualizar QOD_FUNCOES ou desativá-la.",
             "Mês:")
    d.add_paragraph("A lista completa das funções que mudaram está na aba “Agosto x Setembro (funções)” do anexo.")

    d.add_heading("A5. Seções do catálogo que não existem no quadro da unidade", 2)
    cab, linhas = folha(xl, "Secoes sem no no quadro")
    d.add_paragraph(
        f"{len(linhas)} seções do catálogo de funções (ID_ATUALIZADO) não aparecem, com o mesmo nome, na árvore numerada do "
        f"quadro da unidade (aba do quadro de setembro). São {sum(l[2] for l in linhas)} funções. Algumas são diferenças de "
        "digitação (“Div. Op” × “Div. Op.”, “Núcleo de Núcleo…”); outras são seções que o catálogo lista e o quadro não. "
        "O sistema as casa com a divisão do organograma por aproximação; o ideal é o nome ser o mesmo nas duas planilhas. "
        "As 30 mais frequentes (lista completa no anexo):")
    tabela(d, ["Unidade", "Seção no catálogo", "Funções", "Exemplo de ID"], [tuple(l) for l in linhas[:30]],
           larguras=[2.5, 9.5, 1.8, 3], tam=8)

    d.add_heading("A6. O arquivo de quadros de setembro", 2)
    for n, abas in res["numeros_de_quadro_repetidos"].items():
        marcador(d, f" o número {n} foi usado em mais de um quadro: {'; '.join(abas)}.", "Numeração repetida:")
    marcador(d, " " + "; ".join(res["abas_fora_do_padrao"]) + ".", "Nomes de abas fora do padrão:")
    marcador(d, " o quadro GERAL 001 traz “JULHO 2026”, enquanto a CAPA diz “SETEMBRO 2026” (e o número do 2º GB, 485, é o mesmo de antes da "
                "atualização).", "Mês:")

    # ------------------------------------------------------------------ Parte B
    d.add_heading("PARTE B — Para a CPPA (ocupantes das funções)", 1)
    d.add_paragraph(f"A QOD_CONSOLIDADA tem {res['n_ocupantes_linhas']:,} linhas de ocupantes.".replace(",", "."))
    cab, linhas = folha(xl, "Ocupantes x Pecúlio")
    mat = [l for l in linhas if l[1] and l[1].startswith("matrícula diferente")]
    fora = [l for l in linhas if l[1] and "fora do Pecúlio" in l[1]]
    posto = [l for l in linhas if l[1] and l[1].startswith("posto diferente")]
    d.add_heading("B1. Matrícula diferente da do Pecúlio", 2)
    tabela(d, ["Linha", "Nome (QOD)", "Matrícula (QOD)", "Matrícula (Pecúlio)", "Unidade (QOD)"],
           [(l[0], l[3], l[2], l[7], l[6]) for l in mat], larguras=[1.5, 6, 3, 3, 3.5])
    d.add_paragraph("Vale a matrícula do Pecúlio. A QOD_CONSOLIDADA precisa ser corrigida.")
    d.add_heading("B2. Ocupantes que não estão no efetivo ativo do Pecúlio", 2)
    tabela(d, ["Linha", "Matrícula", "Posto (QOD)", "Função", "Unidade (QOD)"],
           [(l[0], l[2], l[4], l[5], l[6]) for l in fora], larguras=[1.5, 3, 4, 3, 5])
    d.add_paragraph("Os nomes foram omitidos deste relatório; estão no anexo. Podem ser militares já inativados ou matrícula digitada errada.")
    d.add_heading("B3. Posto diferente do Pecúlio", 2)
    from collections import Counter
    c = Counter((l[4], l[8]) for l in posto)
    tabela(d, ["Posto na QOD", "Posto no Pecúlio", "Ocupantes"],
           [(a, b, n) for (a, b), n in c.most_common()], larguras=[5, 5, 3])
    d.add_paragraph("A maior parte (Cb na QOD, 3º Sgt no Pecúlio) é compatível com promoções ainda não refletidas na QOD. "
                    "A relação nominal está no anexo (aba “Ocupantes x Pecúlio”).")
    d.add_heading("B4. Ocupante lotado, no Pecúlio, em unidade diferente da OME da função", 2)
    cab, linhas = folha(xl, "Funcao em outra unidade")
    pares = Counter((l[3], l[4]) for l in linhas)
    d.add_paragraph(
        f"{len(linhas)} ocupações estão em função de uma OME diferente da unidade em que o militar está lotado no Pecúlio. "
        "Parte é esperada (o militar da ABMG que exerce função na DEIP: a ABMG pende da DEIP), mas vale a CPPA conferir se a "
        "função ou a lotação está desatualizada. Os pares mais frequentes (lista completa no anexo):")
    tabela(d, ["OME da função", "Unidade no Pecúlio", "Ocupações"], [(a, b, n) for (a, b), n in pares.most_common(15)],
           larguras=[5.5, 5.5, 3])
    d.add_heading("B5. Militar em mais de uma função", 2)
    d.add_paragraph(f"{oc['militar_em_mais_de_uma_funcao']} militares ocupam mais de uma função na QOD_CONSOLIDADA. "
                    "Pode ser regra (função e encargo), por isso é apenas informativo; a lista está no anexo.")

    # ------------------------------------------------------------------ Parte C
    d.add_heading("PARTE C — Em comum: lotação acima do previsto", 1)
    cab, linhas = folha(xl, "Divisoes acima do previsto")
    d.add_paragraph(
        f"O sistema casa cada função com a divisão do organograma (por nome e pela hierarquia numerada do quadro) e compara "
        f"quantos militares a QOD_CONSOLIDADA lota em cada divisão com o previsto no quadro. Em {len(linhas)} divisões a lotação "
        f"passa do previsto ({sum(l[4] for l in linhas)} pessoas a mais no total). Isso é o QOD ocupando mais gente do que o quadro "
        "fixa — a DPlaG confere se o quadro está desatualizado, e a CPPA se há ocupante a mais. As 25 maiores diferenças:")
    tabela(d, ["Unidade", "Divisão", "Previsto", "Lotados", "Diferença"], [tuple(l) for l in linhas[:25]],
           larguras=[2.3, 8.5, 2, 2, 2], tam=8)

    d.add_heading("Encaminhamentos sugeridos", 1)
    marcador(d, " confirmar o previsto correto do 2º GB (671 ou 485) e do 6º GB (201 ou 232); explicar as 163 vagas FUNCIONAIS "
                "acima do efetivo fixado; manter o ID_FUNCAO estável; atualizar QOD_FUNCOES para setembro (ou desativá-la); "
                "alinhar os nomes de seção entre o catálogo e os quadros; corrigir a numeração repetida dos quadros e o mês do GERAL 001.",
             "DPlaG:")
    marcador(d, " corrigir a matrícula do Subcomandante-Geral na QOD_CONSOLIDADA; revisar os 2 ocupantes fora do Pecúlio, os postos "
                "desatualizados e as ocupações em unidade diferente da lotação.", "CPPA:")
    marcador(d, " revisar as divisões em que a lotação passa do previsto.", "As duas:")
    d.add_paragraph()
    p = d.add_paragraph("Anexo: QOD_apontamentos.xlsx (todas as linhas dos apontamentos acima).")
    p.runs[0].italic = True
    d.save(AQUI / "Relatorio_QOD_divergencias.docx")


# ---------------------------------------------------------------------------
# DF
# ---------------------------------------------------------------------------
def relatorio_df():
    xl = AQUI / "DF_apontamentos.xlsx"
    wb = openpyxl.load_workbook(xl, data_only=True)
    resumo = {r[0]: r[1] for r in list(wb["Resumo"].iter_rows(values_only=True))[1:]}
    c = psycopg2.connect(os.environ["DATABASE_URL_DW_ETL"])
    c.set_session(readonly=True)
    cur = c.cursor()
    cur.execute("""select bloco, count(*), sum(valor), sum(valor_liquidado), sum(valor_pago)
                   from core.fato_financeiro group by 1 order by 1""")
    blocos = cur.fetchall()
    cur.execute("""select enquadramento, count(*), sum(valor), sum(valor_liquidado), sum(valor_pago)
                   from core.fato_financeiro where bloco='autorizacao' group by 1 order by 3 desc nulls last""")
    enq = cur.fetchall()
    cur.execute("""select destino, count(*), sum(valor) from stg.financas_destino
                   where sigla_organograma is null and nullif(trim(destino),'') is not null
                   group by 1 order by 2 desc""")
    destinos = cur.fetchall()

    d = novo_documento("Apontamentos sobre a planilha de Finanças",
                       f"Relatório para a Diretoria de Finanças — {HOJE} — Projeto CBMPE BI / Data Warehouse")
    d.add_heading("1. O que foi analisado", 1)
    d.add_paragraph(
        "A aba “Banco de Dados - NÃO MEXER” da planilha de Finanças (a consolidação das abas AUTORIZAÇÃO, CARNAVAL 2026 e "
        "SFI ORDINÁRIO). A aba Plan1 foi ignorada. A planilha é lida todos os dias, direto da publicação na web, e carregada no "
        "Data Warehouse.")
    tabela(d, ["Bloco", "Lançamentos", "Valor (empenhado)", "Valor liquidado", "Valor pago"],
           [(b, n, float(v or 0), float(l or 0), float(p or 0)) for b, n, v, l, p in blocos],
           larguras=[3.5, 2.5, 3.8, 3.8, 3.8])
    d.add_heading("Como o sistema trata os dados", 2)
    marcador(d, " o sistema mostra os valores exatamente como estão na planilha. Nada é corrigido: valor, situação, "
                "OME e enquadramento seguem como digitados.", "Sem correção:")
    marcador(d, " só se tratam erros de digitação de nomenclatura: caixa, espaço e hífen no tipo de gasto "
                "(“CUSTEIO- Auxílio Funeral” = “CUSTEIO - Auxílio Funeral”), “Cota Globa” → “Cota Global”, “Diárias Miliar” → "
                "“Diárias Militar”, e o mês com palavras extras (“JAN (ASA BRANCA R$ 404.710,46…)” → JAN; “MAIO” e “MAI” → MAI; "
                "mês gravado como data no bloco Carnaval → mês).", "Só grafia:")
    marcador(d, " nem todo valor empenhado foi liquidado, e nem todo liquidado foi pago. Isso é normal e não é apontado aqui.",
             "Não é problema:")

    d.add_heading("2. Resumo dos apontamentos", 1)
    ordem = ["Pago maior que liquidado", "Pago maior que empenhado", "Liquidado maior que empenhado",
             "EMPENHADO sem número de empenho", "Valor com formato inválido", "Campos obrigatórios em branco",
             "Mês que não é um mês", "Ofício + item repetidos"]
    desc = {
        "Pago maior que liquidado": "valor pago acima do liquidado no mesmo lançamento (não deveria ocorrer)",
        "Pago maior que empenhado": "valor pago acima do valor empenhado",
        "Liquidado maior que empenhado": "valor liquidado acima do valor empenhado",
        "EMPENHADO sem número de empenho": "situação EMPENHADO sem o número da NE",
        "Valor com formato inválido": "texto onde deveria haver valor (ex.: “GR”, dois valores na mesma célula)",
        "Campos obrigatórios em branco": "destino/OME, situação, valor, enquadramento, tipo de gasto ou (se EMPENHADO) mês em branco",
        "Mês que não é um mês": "coluna Mês com texto que não é um mês (ex.: “CANCELADO”)",
        "Ofício + item repetidos": "o mesmo par ofício + item aparece em mais de uma linha do mesmo bloco",
    }
    tabela(d, ["Apontamento", "Ocorrências", "O que significa"],
           [(k, resumo.get(k, 0), desc[k]) for k in ordem], larguras=[5.2, 2.2, 9.5])

    def secao(titulo, aba, colunas, nota=None, largs=None):
        cab, linhas = folha(xl, aba)
        idx = [cab.index(c) for c in colunas]
        d.add_heading(titulo, 2)
        if nota:
            d.add_paragraph(nota)
        monet = {j for j, c in enumerate(colunas) if c in ("valor", "liquidado", "pago", "diferenca")}
        tabela(d, [c.replace("_", " ").capitalize() for c in colunas],
               [[(float(l[i]) if j in monet and l[i] is not None else l[i]) for j, i in enumerate(idx)] for l in linhas],
               larguras=largs, tam=8)

    d.add_heading("3. Detalhe dos apontamentos", 1)
    d.add_paragraph("A coluna “Linha” é a linha da aba “Banco de Dados - NÃO MEXER”. Valores em reais.")
    base = ["bloco", "linha", "oficio", "item", "destino", "enquadramento", "situacao", "mes", "valor", "liquidado", "pago"]
    secao("3.1 Pago maior que liquidado", "Pago maior que liquidado", base + ["diferenca"],
          "Os dois casos: no primeiro o pago excede o liquidado em R$ 443,16; no segundo, o pago (45.000) é dez vezes o liquidado "
          "(4.500), o que sugere um zero a mais. O sistema mostra os valores como estão.")
    secao("3.2 Pago maior que o valor empenhado", "Pago maior que empenhado", base + ["diferenca"])
    secao("3.3 Liquidado maior que o valor empenhado", "Liquidado maior que empenhado", base + ["diferenca"],
          "Atenção à linha 147 (DLog, contrato): empenhado R$ 361.820,64, liquidado R$ 2.630.151,72.")
    secao("3.4 EMPENHADO sem número de empenho", "EMPENHADO sem número de empenho", base)
    secao("3.5 Valor com formato inválido", "Valor com formato inválido",
          ["bloco", "linha", "oficio", "item", "destino", "campos", "liq_txt", "pago_txt"],
          "O sistema não consegue somar estas células e as trata como vazias.")
    secao("3.6 Campos obrigatórios em branco", "Campos obrigatórios em branco",
          ["bloco", "linha", "oficio", "item", "destino", "enquadramento", "situacao", "valor", "campos_em_branco"])
    secao("3.7 Mês que não é um mês", "Mês que não é um mês", ["bloco", "linha", "oficio", "item", "destino", "situacao", "mes"])
    secao("3.8 Ofício + item repetidos", "Ofício + item repetidos",
          ["bloco", "linha", "oficio", "item", "sei", "destino", "valor", "situacao"],
          "Linhas com o mesmo ofício, item, SEI e valor (ex.: 485 e 491) parecem duplicidade; as demais podem ser item reaproveitado.")

    d.add_heading("4. Destinos que não são uma OME do organograma", 1)
    d.add_paragraph("O campo OME/Destino recebe, além de siglas de unidade, expressões como “Aos mesmos” e siglas de áreas que não existem "
                    "no organograma do sistema. Essas linhas entram nos totais da corporação, mas não podem ser atribuídas a uma unidade.")
    tabela(d, ["Valor na planilha", "Lançamentos", "Valor (R$)"], [(a, b, float(c_ or 0)) for a, b, c_ in destinos],
           larguras=[6, 3, 4.5])
    d.add_paragraph("“Aos mesmos”, “À mesma”, “Ao mesmo” aparecem em auxílio funeral, indenização, translado e folha: parecem referir-se a "
                    "“mesmos beneficiários” do lançamento anterior, e não a uma OME. DPAFO, DAFO, SGD e SEGI são siglas que não constam "
                    "no organograma do sistema; a DF pode informar a qual unidade pertencem.")

    d.add_heading("5. Tratamentos de grafia aplicados", 1)
    d.add_paragraph("Estes são os únicos ajustes que o sistema faz. A tabela completa (58 grafias do tipo de gasto) está no anexo.")
    cab, linhas = folha(xl, "Tipos de gasto (grafia)")
    mudou = [(a, b, n) for a, b, n in linhas if a != b]
    tabela(d, ["Como está na planilha", "Como o sistema exibe", "Lançamentos"], mudou, larguras=[7.5, 7.5, 2.4], tam=8)
    d.add_paragraph("Podem ser o mesmo tipo escrito de formas diferentes, mas o sistema NÃO os junta (a DF decide): "
                    "“Cota Global” × “Cota Global CBM” × “DEA - COTA GLOBAL”; “Gestão das Taxas do CBMPE” × “Gestão de taxas do CBMPE”; "
                    "“Curso de Formação” × “Cursos de formação”; “Diárias - Operação X” (sem “EXECUTIVA -”) × “EXECUTIVA - Diárias - Operação X”.")

    d.add_heading("6. Para a DF considerar", 1)
    marcador(d, " dos R$ 360 milhões do bloco Autorização, só R$ 14,5 milhões têm valor liquidado e R$ 11,1 milhões valor pago na planilha. "
                "A folha de pagamento (45 lançamentos, R$ 200 mi) não tem liquidado nem pago em nenhuma linha, e as operações de crédito "
                "(41 lançamentos, R$ 125 mi) têm liquidado em apenas 4. O sistema mostra esses campos vazios como estão.", "Liquidado e pago:")
    cabe = ["Enquadramento", "Lançamentos", "Valor (empenhado)", "Valor liquidado", "Valor pago"]
    tabela(d, cabe, [(a or "(sem enquadramento)", b, float(v or 0), float(l or 0), float(p or 0)) for a, b, v, l, p in enq],
           larguras=[5, 2.2, 3.6, 3.6, 3.6], tam=8)
    cur.execute("""select coalesce(situacao, '(sem situação)'), count(*) from core.fato_financeiro
                   where bloco = 'autorizacao' and mes_rotulo is null group by 1 order by 2 desc""")
    sem_mes = cur.fetchall()
    total_sem_mes = sum(n for _, n in sem_mes)
    marcador(d, f" {total_sem_mes} lançamentos de Autorização não têm mês: " +
             ", ".join(f"{n} {s}" for s, n in sem_mes) +
             ". Os AGUARDANDO, CANCELADO e NÃO SE ENQUADRA são esperados; os EMPENHADO e os sem situação aparecem nos apontamentos.",
             "Mês:")

    d.add_heading("7. Dúvidas para a DF", 1)
    d.add_paragraph(
        "Pontos em que o sistema precisa de uma definição da Diretoria de Finanças para mostrar o número certo. "
        "Enquanto não houver resposta, o sistema mostra os dados como estão na planilha.")
    marcador(d, " o card de Finanças de cada unidade soma o valor PAGO dos lançamentos EMPENHADO (no SFI Ordinário, o valor liquidado, como no painel da DF). "
                "É essa a métrica correta, ou deveria ser o empenhado ou o liquidado? Quando a DF definir, o sistema se ajusta.",
             "1. O que é gasto:")
    marcador(d, " 57 lançamentos têm valor liquidado ou pago em situação diferente de EMPENHADO (por exemplo LIQUIDADO ou "
                "AGUARDANDO). O painel só soma a situação EMPENHADO. Esses valores devem entrar nos totais?", "2. Liquidado/pago fora de EMPENHADO:")
    marcador(d, " dois lançamentos têm pago maior que o liquidado (um deles com pago exatamente dez vezes o liquidado: "
                "R$ 45.000 contra R$ 4.500, ofício 101 item 13). É erro de digitação (um zero a mais)? "
                "E os 11 com pago acima do empenhado e os 10 com liquidado acima do empenhado (o maior: ofício 29 item 1, DLog, "
                "empenhado R$ 361.820,64 e liquidado R$ 2.630.151,72)?", "3. Pago e liquidado acima do previsto:")
    marcador(d, " a folha de pagamento (45 lançamentos, R$ 200 milhões) não tem liquidado nem pago em nenhuma linha. "
                "A folha é paga e controlada fora desta planilha? O painel deve mostrá-la só como empenhada?", "4. Folha de pagamento:")
    marcador(d, " “Aos mesmos”, “À mesma” e “Ao mesmo” referem-se a qual unidade? DPAFO, DAFO, SGD e SEGI pertencem a qual "
                "unidade do organograma? Hoje essas linhas entram só no total da corporação.", "5. Destinos sem unidade:")
    marcador(d, " 11 lançamentos (R$ 4,9 milhões) estão como “FORA DE ENQUADRAMENTO”. Como devem aparecer nos painéis?",
             "6. Fora de enquadramento:")
    marcador(d, " quais destes tipos são o mesmo gasto e podem ser unificados no painel? “Cota Global” × “Cota Global CBM” × "
                "“DEA - COTA GLOBAL”; “Gestão das Taxas do CBMPE” × “Gestão de taxas do CBMPE”; “Curso de Formação” × "
                "“Cursos de formação”; “Diárias - Operação X” × “EXECUTIVA - Diárias - Operação X”.", "7. Tipos de gasto:")
    marcador(d, " 16 pares ofício + item aparecem em mais de uma linha. Quando o SEI e o valor são iguais, é duplicidade? "
                "Se for, qual linha vale?", "8. Ofício + item repetidos:")
    marcador(d, " 14 lançamentos têm campos obrigatórios em branco (destino, situação, valor, enquadramento ou tipo de gasto) "
                "e 3 têm valor com texto no lugar do número. A DF corrige na planilha?", "9. Campos em branco e valores inválidos:")
    marcador(d, " o painel ainda não mostra percentual de execução (a pedido do Comando). Qual é a base de cálculo que a DF "
                "considera correta (pago ÷ empenhado, pago ÷ dotação)?", "10. Percentual de execução:")
    p = d.add_paragraph("Anexo: DF_apontamentos.xlsx (todas as linhas de cada apontamento).")
    p.runs[0].italic = True
    d.save(AQUI / "Relatorio_DF_apontamentos.docx")


if __name__ == "__main__":
    relatorio_qod()
    relatorio_df()
    print("ok")
