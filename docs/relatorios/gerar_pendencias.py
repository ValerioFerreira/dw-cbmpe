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

    d.add_heading("1. Mapa de Força (atualizado em 13/10, após as respostas do Comando)", level=1)
    d.add_paragraph("Decidido: postos de operação/evento contam na OME que lança; postos de praia do GBMar e postos hospedados "
                    "(SEDE/QCG/CMAN/ABMG) lançam só na unidade da OME, e o GBMar usa a coordenada da sede por ora (adequar quando "
                    "as coordenadas dos postos de praia forem informadas); posto SEDE do 4º GB = 1ª SB/4º GB; CEASA/Recife conta na "
                    "1ª SBAPH do GBAPH; os postos não citados são legados e foram desconsiderados.")
    marcador(d, " a estação nova '3ªSB / PETROLINA' (seção de mergulho, na sede do 4º GB) foi criada no Mapa de Força com id 145 e "
                "id_scriptcase 64. O DW liga os lançamentos aos postos pelo id do cadastro antigo (ovresc.tb_posto = id_scriptcase): "
                "em 91% dos lançamentos recentes o id do lançamento é o do tb_posto. Dois riscos: (a) se o app gravar id_scriptcase 64 nos "
                "lançamentos, o DW os contará como '1ªSB / PETROLINA' (o posto 64 existe); (b) se gravar o id 145, o DW os contará como ABMG "
                "(o posto 145 do tb_posto é a ABMG, 102 lançamentos em 30 dias). Preciso saber qual id o Mapa de Força grava em "
                "launches.service_station_id para essa estação (um lançamento de teste resolve) — e sugiro dar a ela um id_scriptcase novo "
                "e único (ex.: 189) e criar o posto correspondente no tb_posto.", "3ª SB do 4º GB (mergulho):")
    marcador(d, " o ponto de serviço está cadastrado com coordenada do Rio de Janeiro (-22,88 / -43,64), que o sistema descarta; hoje cai no "
                "centro de Recife (aproximado, balão tracejado). Qual é a coordenada da CEASA Recife?", "CEASA / Recife:")

    d.add_heading("2. QOD (DPlaG e CPPA)", level=1)
    marcador(d, " 240 ocupações ficaram sem função após a tradução dos códigos e há 248 funções do catálogo antigo sem par no novo "
                "(111 com ocupante). Detalhe em QOD_ocupacoes_sem_funcao.xlsx — a DPlaG diz se a função deixou de existir, mudou de nome "
                "ou de seção; a CPPA confere o código escrito na linha.", "Ocupações sem função:")
    marcador(d, " o nome da função deve vir da QOD_CONSOLIDADA ou do ID_ATUALIZADO (hoje: ID_ATUALIZADO)?", "Nomenclatura:")
    marcador(d, " em 54 divisões a lotação passa do previsto (367 pessoas a mais). A DPlaG revisa o previsto ou a CPPA a lotação?",
             "Lotação acima do previsto:")

    d.add_heading("3. Finanças (DF)", level=1)
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

    d.add_heading("4. Painel 09 — Intenção de Movimentação (Igor)", level=1)
    marcador(d, " conferi o painel do Metabase contra o DW: pedidos (17), solicitações por posto, 1ª opção, origem e transferências "
                "por OME e por posto batem exatamente. Diferença: o Metabase mostra 390 transferências e o DW 389 — o 390 conta uma "
                "linha da planilha que é uma nota de rodapé ('ABAIXO ESTÁ A SITUAÇÃO APÓS A DISTRIBUIÇÃO DO CFHP 2026 SP 013/2026'), "
                "não uma transferência; a soma do próprio gráfico por posto do Metabase também é 389. Pedir ao Igor para corrigir o card.",
             "O que bate:")
    marcador(d, " cinco OMEs empatam com 2 pedidos (6ºGB, 7ºGB, AjG, GBS, SDS) e só 3 cabem nas vagas 3 a 5 do 'Top 5'. O Metabase "
                "mostrou GBS, SDS e 6ºGB; o sistema mostra 6ºGB, SDS e AjG, porque nenhum dos dois define critério de desempate. "
                "Decisão: listar todas as empatadas (7 OMEs) ou desempatar por ordem alfabética?", "Empate no Top 5:")

    d.add_heading("5. Frota", level=1)
    marcador(d, " a regra de 'condutores por viatura' está em conferência (números fora do sistema). Frota: o que conta como condutor "
                "de uma viatura?", "Condutores:")
    marcador(d, " a empresa nova ainda não forneceu a API; o campo fica com traço até lá.", "Combustível:")

    d.add_heading("6. Infraestrutura (TI / ATI)", level=1)
    marcador(d, " o servidor do DW não arquiva WAL e não tem réplica. Existe dump diário do banco 'dw' no caprover-01? Retenção? "
                "Se não, quem fará o dump (≈ 65 MB) do que não se reconstrói das fontes?", "Backup:")
    marcador(d, " subdomínio ou subcaminho? Quem administra o srv-nginx01? (ver docs/deploy-pedido-vm-ati.md)", "Endereço da VM:")
    d.save(AQUI / "Pendencias_decisao.docx")
    print("ok", AQUI / "Pendencias_decisao.docx")


if __name__ == "__main__":
    main()
