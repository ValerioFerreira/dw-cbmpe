"""Documento "Pendencias de decisao" (2026-10-13): so o que AINDA falta, com a pergunta exata
para cada responsavel. Le etl/mapa_forca/de_para_posto_qod.csv (postos ainda a decidir).

    py -3 docs/relatorios/gerar_pendencias.py   ->  docs/relatorios/Pendencias_decisao.docx
"""
import csv
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))
from gerar_relatorios import novo_documento, tabela, marcador, HOJE  # noqa: E402

RAIZ = AQUI.parents[1]


def postos():
    with (RAIZ / "etl" / "mapa_forca" / "de_para_posto_qod.csv").open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f, delimiter=";"))


# O que preciso saber de cada posto que ainda esta sem destino (id -> pergunta).
PERGUNTAS = {
    "62": "A 4ª SB do 4º GB (Aeródromo de Petrolina) existe no QOD? Qual seção? A sua tabela de coordenadas só tem 1ª a 3ª SB: vale a coordenada do cadastro (-9,3665 / -40,5686)?",
    "21": "É a 1ª SB/4º GB (sede, Petrolina)? Tem 1 lançamento em 30 dias.",
    "11": "Cadastrado como 5º GB mas em Olinda (o 5º GB é Salgueiro). É de outra OME ou posto extinto? Pode ser desativado?",
    "27": "Posto de TESTE. Pode ser desativado/ignorado no mapa?",
    "54": "Guarda do AJG: qual seção do QOD do AJG (ou conta só na unidade)?",
    "1": "Posto chamado '1º GB', cadastrado na DGO, em Vitória de Santo Antão. É a sede do 1º GB (1ª SB)? Duplica o posto 71?",
    "15": "'SB Palmares', cadastrado na DGO. É a 2ª SB/1º GB (duplica o posto 86 '2ªSB / PALMARES')?",
    "105": "'DINTER 1' (Caruaru). A DINTER I tem seção própria no QOD ou conta só na unidade?",
    "12": "'CEMET II' (DINTER II, Jaboatão). O que é e em qual seção/OME conta?",
    "33": "'Cabo / Sede da Guarda Municipal' (GBAPH): em qual seção do GBAPH conta?",
    "32": "CEASA/Recife (GBAPH, 99 lançamentos em 30 dias): em qual seção do GBAPH conta (ou só na unidade)?",
    "23": "'SB Ouricuri' cadastrada no GBI (o GBI é da RMR). É a 4ª SB/5º GB (posto 69)? Pode ser desativada?",
    "5": "'CMAN / Recife' do GBMar: viatura do GBMar ativada no CMAN? Conta no GBMar (qual seção)?",
    "157": "'Extra - Goiana - Ponta de Pedra' (GBMar): posto de praia — coordenada e seção.",
}


def main():
    d = novo_documento("Pendências de decisão", f"O que ainda falta e o que preciso saber de cada responsável — {HOJE}")

    d.add_heading("1. Postos do Mapa de Força sem seção no QOD (Comando / DGO)", level=1)
    d.add_paragraph("Já decididos hoje e fora desta lista: CATs do Sertão → 4º GB, do Agreste → 2º GB, da Zona da Mata → 1º GB; "
                    "CATs da RMR → QCG; CIODS → DGO; DIESP → DGO; DPCIP, DAP e CIAT → DIESP; GBFN virou SBFN, subordinada ao GBI; "
                    "8º GB e 11º GB extintos; postos SEDE hospedados contam na OME que lança. Faltam estes:")
    linhas = []
    for r in postos():
        if r["id_posto"] in PERGUNTAS:
            linhas.append((r["id_posto"], r["nome_posto"], r["ome_do_posto"], r["municipio"], r["lancamentos_30d"], PERGUNTAS[r["id_posto"]]))
    tabela(d, ["Posto", "Nome", "OME cadastrada", "Município", "Lanç. 30 d", "O que preciso saber"], linhas,
           larguras=[1.2, 3.4, 2.2, 2.6, 1.3, 6.8], tam=8)

    d.add_heading("2. Regras para confirmar", level=1)
    todas = postos()
    eventos = [r for r in todas if "operacao/evento" in r["regra"]]
    praia = [r for r in todas if "praia do GBMar" in r["regra"]]
    marcador(d, f" são {len(eventos)} postos de operação/evento (Operação Carnaval, Verão, Pernambuco Seguro etc.; "
                f"{sum(int(r['lancamentos_30d']) for r in eventos)} lançamentos em 30 dias). Proposta: contam só na OME que lança, "
                "sem seção do QOD. Confirma?", "Postos de operação e evento:")
    marcador(d, f" são {len(praia)} postos de praia ({sum(int(r['lancamentos_30d']) for r in praia)} lançamentos em 30 dias), "
                "hoje todos no ponto da sede do GBMar. Falta, por posto: coordenada e, se houver, a seção do GBMar em que contam. "
                "Pode mandar uma planilha no mesmo formato da das SBs (posto, latitude, longitude).", "Postos de praia do GBMar:")
    marcador(d, " (SEDE/QCG/CMAN/ABMG ativados por outra OME) contam na OME que lança e a posição é a do quartel hospedeiro. "
                "Pergunta: basta a unidade da OME que lança ou precisa registrar a seção (ex.: 'GBAPH — 2ª SBAPH')?",
             "Postos hospedados:")

    d.add_heading("3. Cadastro e coordenadas (Mapa de Força)", level=1)
    marcador(d, " existe no SGP como seção (tb_secao, id 33), mas sem endereço nem coordenada, e não existe como posto de serviço "
                "(tb_posto do sistema de escala). O Mapa de Força lança por posto; sem posto, ninguém consegue lançar a guarnição "
                "dessa SB e ela não aparece no mapa. Quem administra o cadastro de postos precisa criar o posto '3ªSB / PETROLINA' "
                "(4º GB) — a coordenada já está na sua tabela.", "A 3ª SB do 4º GB (Petrolina)")
    marcador(d, " os postos estão cadastrados como '5ªSB / SANTA CRUZ DO CAPIBARIBE' e '6ªSB / TORITAMA'; a sua tabela diz "
                "5ª SB = Toritama e 6ª SB = Santa Cruz do Capibaribe. Usei a cidade do nome do posto, então cada ponto está no lugar "
                "certo; o que diverge é só o número da SB (afeta o rótulo e qualquer relatório por seção). Qual é a numeração correta?",
             "A 5ª e a 6ª SB do 2º GB:")

    d.add_heading("4. QOD (DPlaG e CPPA)", level=1)
    marcador(d, " 240 ocupações ficaram sem função após a tradução dos códigos e há 248 funções do catálogo antigo sem par no novo "
                "(111 com ocupante). Detalhe em QOD_ocupacoes_sem_funcao.xlsx — a DPlaG diz se a função deixou de existir, mudou de nome "
                "ou de seção; a CPPA confere o código escrito na linha.", "Ocupações sem função:")
    marcador(d, " o nome da função deve vir da QOD_CONSOLIDADA ou do ID_ATUALIZADO (hoje: ID_ATUALIZADO)?", "Nomenclatura:")
    marcador(d, " em 54 divisões a lotação passa do previsto (367 pessoas a mais). A DPlaG revisa o previsto ou a CPPA a lotação?",
             "Lotação acima do previsto:")

    d.add_heading("5. Finanças (DF)", level=1)
    d.add_paragraph("Unificar ou manter separados (a DF decide):")
    tabela(d, ["Tipos de gasto que parecem o mesmo", "Lanç."], [
        ("CUSTEIO - Cota Global  ×  Cota Global CBM  ×  DEA - COTA GLOBAL", "19 + 8 + 1"),
        ("CUSTEIO - Gestão das Taxas do CBMPE  ×  Gestão de taxas do CBMPE", "8 + 1"),
        ("EXECUTIVA - Curso de Formação  ×  Cursos de Formação", "3 + 7"),
        ("CUSTEIO - Suprimento Institucional  ×  Suprimento Institucional Ordinário", "125 + 306"),
        ("Diárias - Operação X (sem 'EXECUTIVA -')  ×  EXECUTIVA - Diárias - Operação X (Calendário Turístico, Pernambuco Meu País)", "3 + 13"),
        ("EXECUTIVA - Diárias - Calendário turístico  ×  ... - Operação Calendário Turístico", "7 + 12"),
        ("CUSTEIO - Diárias Militar  ×  DEA - Diárias Militar", "1 + 2"),
    ], larguras=[14, 3], tam=9)
    marcador(d, " 6 lançamentos estão sem tipo de gasto. Qual é o tipo de cada um?", "Sem tipo:")
    marcador(d, " os três totais da página inicial somam apenas as situações Aguardando, Empenhado e Liquidado; ficam de fora "
                "Cancelado (19 lançamentos), 'Não se enquadra' (11) e 5 sem situação. Está correto?", "Totais:")

    d.add_heading("6. Painel 09 — Intenção de Movimentação (Igor)", level=1)
    marcador(d, " conferi o painel do Metabase contra o DW: pedidos (17), solicitações por posto, 1ª opção, origem e transferências "
                "por OME e por posto batem exatamente. Diferença: o Metabase mostra 390 transferências e o DW 389 — o 390 conta uma "
                "linha da planilha que é uma nota de rodapé ('ABAIXO ESTÁ A SITUAÇÃO APÓS A DISTRIBUIÇÃO DO CFHP 2026 SP 013/2026'), "
                "não uma transferência; a soma do próprio gráfico por posto do Metabase também é 389. Pedir ao Igor para corrigir o card.",
             "O que bate:")
    marcador(d, " cinco OMEs empatam com 2 pedidos (6ºGB, 7ºGB, AjG, GBS, SDS) e só 3 cabem nas vagas 3 a 5 do 'Top 5'. O Metabase "
                "mostrou GBS, SDS e 6ºGB; o sistema mostra 6ºGB, SDS e AjG, porque nenhum dos dois define critério de desempate. "
                "Decisão: listar todas as empatadas (7 OMEs) ou desempatar por ordem alfabética?", "Empate no Top 5:")

    d.add_heading("7. Frota", level=1)
    marcador(d, " a regra de 'condutores por viatura' está em conferência (números fora do sistema). Frota: o que conta como condutor "
                "de uma viatura?", "Condutores:")
    marcador(d, " a empresa nova ainda não forneceu a API; o campo fica com traço até lá.", "Combustível:")

    d.add_heading("8. Infraestrutura (TI / ATI)", level=1)
    marcador(d, " o servidor do DW não arquiva WAL e não tem réplica. Existe dump diário do banco 'dw' no caprover-01? Retenção? "
                "Se não, quem fará o dump (≈ 65 MB) do que não se reconstrói das fontes?", "Backup:")
    marcador(d, " subdomínio ou subcaminho? Quem administra o srv-nginx01? (ver docs/deploy-pedido-vm-ati.md)", "Endereço da VM:")
    d.save(AQUI / "Pendencias_decisao.docx")
    print("ok", AQUI / "Pendencias_decisao.docx")


if __name__ == "__main__":
    main()
