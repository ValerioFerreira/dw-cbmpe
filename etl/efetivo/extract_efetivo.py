# requirements:
# psycopg2-binary
"""Extração pontual de Efetivo a partir do banco Neon de Militares, para
popular src/data/real/efetivo.json (contagem agregada por unidade) e
src/data/real/efetivo_lista.json (relação nominal por unidade — Posto/
Graduação, Matrícula, Nome de Guerra).

Uso:
    DATABASE_URL_EFETIVO=postgresql://... python extract_efetivo.py

O efetivo.json só tem contagens agregadas (decisão de minimização em
DW_GOVERNANCA.md). O efetivo_lista.json é uma exceção deliberada e
confirmada com o usuário (ver DW_PLANEJAMENTO.md): expõe posto/graduação,
matrícula, nome completo, nome de guerra, sexo e idade por unidade, para a
tabela de efetivo na página de Indicador. A idade é calculada aqui e só a
idade (não a data de nascimento) sai no JSON — minimização deliberada de
um campo que a própria fonte trata como sensível (LGPD).

Cada registro também traz um sub-objeto "completo" com os demais campos
pedidos pelo usuário para o painel "Verificar dados completos" do app —
inclusive dado sensível LGPD (raça/cor, PCD, licenças de saúde). Isso só
funciona DEPOIS que o windmill-neon.py (com as colunas novas, preparado em
2026-08-11) rodar pelo menos uma vez — a consulta abaixo falha com "column
does not exist" enquanto isso não acontecer. Nunca inclui "observacao"
(texto livre, risco imprevisível).
"""
import json
import os
from datetime import date, datetime, timezone
from pathlib import Path

import psycopg2

ROOT = Path(__file__).resolve().parents[2]
MAPEAMENTO_PATH = Path(__file__).resolve().parent / "mapeamento_unidades.json"
OUTPUT_PATH = ROOT / "src" / "data" / "real" / "efetivo.json"
OUTPUT_LISTA_PATH = ROOT / "src" / "data" / "real" / "efetivo_lista.json"

# OMEs que existem na fonte mas não são unidade própria do organograma: são
# setores vinculados a uma unidade-mãe. O militar conta no efetivo da mãe
# (uma vez só, sem duplicidade), mas mantém a OME de origem na coluna OME,
# para poder ser filtrado pelo setor vinculado na tabela de efetivo.
#
# Sem isso, a OME era sobrescrita pela sigla da mãe e o setor vinculado
# ficava sem nenhum militar — era o caso da CPPA dentro da DGP.
#
# Só entram aqui casos em que a chave do mapeamento é uma unidade
# semanticamente distinta da mãe — variações de grafia da mesma unidade
# (ex. "1ºGB" -> "1º GB", "AjG" -> "AJG") NÃO entram: ali a sigla de destino
# é a forma correta da mesma OME, e mostrá-la é o comportamento certo.
OME_SETOR_VINCULADO = {"CPPA": "DGP"}


def main():
    database_url = os.environ["DATABASE_URL_EFETIVO"]
    mapeamento = json.loads(MAPEAMENTO_PATH.read_text(encoding="utf-8"))

    conn = psycopg2.connect(database_url, client_encoding="UTF8")
    cur = conn.cursor()
    cur.execute("""
        SELECT ome, COUNT(*)
        FROM "Militar"
        WHERE ativo = TRUE
        GROUP BY ome;
    """)
    contagem_por_ome = dict(cur.fetchall())

    cur.execute("""
        SELECT ome, "postoGrad", matricula, nome, "nomeGuerra", sexo, "dataNascimento", "ordemHierarquica"
        FROM "Militar"
        WHERE ativo = TRUE
        ORDER BY "ordemHierarquica" ASC NULLS LAST, "nomeGuerra" ASC NULLS LAST;
    """)
    militares = cur.fetchall()

    # "Dados completos" (painel retraído) — só funciona depois que o
    # windmill-neon.py com as colunas novas rodar (ver docstring do módulo).
    cur.execute("""
        SELECT matricula, "racaCor", pcd, telefone1, telefone2, "tempoServicoAnos",
               "tempoObmAtualDias", "omeAnteriorSp", orgao, "horarioEspecial",
               readaptado, "acumuloCargos", le, ltip, "afastamentoSup90Dias",
               "suplementoPessoalNumeroAno", "dataSuplementoPessoal", aniversario,
               "dataMovimentacaoSp", "dataIngresso", "dataUltimaPromocao", pcnh
        FROM "Militar"
        WHERE ativo = TRUE;
    """)
    completos_por_matricula = {}
    for (matricula, raca_cor, pcd, telefone1, telefone2, tempo_servico_anos,
         tempo_obm_atual_dias, ome_anterior_sp, orgao, horario_especial,
         readaptado, acumulo_cargos, le, ltip, afastamento_sup_90_dias,
         suplemento_pessoal_numero_ano, data_suplemento_pessoal, aniversario,
         data_movimentacao_sp, data_ingresso, data_ultima_promocao, pcnh) in cur.fetchall():
        completos_por_matricula[matricula] = {
            "racaCor": raca_cor,
            "pcd": pcd,
            "telefone1": telefone1,
            "telefone2": telefone2,
            "tempoServicoAnos": tempo_servico_anos,
            "tempoObmAtualDias": tempo_obm_atual_dias,
            "omeAnteriorSp": ome_anterior_sp,
            "orgao": orgao,
            "horarioEspecial": horario_especial,
            "readaptado": readaptado,
            "acumuloCargos": acumulo_cargos,
            "le": le,
            "ltip": ltip,
            "afastamentoSup90Dias": afastamento_sup_90_dias,
            "suplementoPessoalNumeroAno": suplemento_pessoal_numero_ano,
            "dataSuplementoPessoal": data_suplemento_pessoal.date().isoformat() if data_suplemento_pessoal else None,
            "aniversario": aniversario,
            "dataMovimentacaoSp": data_movimentacao_sp.date().isoformat() if data_movimentacao_sp else None,
            "dataIngresso": data_ingresso.date().isoformat() if data_ingresso else None,
            "dataUltimaPromocao": data_ultima_promocao.date().isoformat() if data_ultima_promocao else None,
            "pcnh": pcnh,
        }

    cur.close()
    conn.close()

    nao_mapeados = [ome for ome in contagem_por_ome if ome not in mapeamento]
    if nao_mapeados:
        raise SystemExit(
            "Valores de ome sem mapeamento em mapeamento_unidades.json: "
            f"{nao_mapeados}. Atualize o mapeamento antes de gerar o JSON."
        )

    por_unidade = {}
    nao_lotados = {}
    # Contagem própria dos setores vinculados (ex. CPPA), por unidade-mãe.
    # É um recorte de por_unidade[mãe], não um acréscimo: quem está aqui já
    # está contado na mãe. Serve pra tabela de setores vinculados mostrar o
    # efetivo atual do setor sem depender da Repercussão Financeira (que só
    # cobre parte do efetivo).
    por_setor_vinculado = {}
    for ome, contagem in contagem_por_ome.items():
        sigla = mapeamento[ome]
        if sigla is None:
            nao_lotados[ome] = contagem
        else:
            por_unidade[sigla] = por_unidade.get(sigla, 0) + contagem
            if ome in OME_SETOR_VINCULADO:
                por_setor_vinculado.setdefault(sigla, {})[ome] = contagem

    total_ativo = sum(contagem_por_ome.values())

    saida = {
        "fonte": "Neon (tabela Militar, campo ome, ativo=true)",
        "gerado_em": datetime.now(timezone.utc).isoformat(),
        "total_ativo": total_ativo,
        "por_unidade": por_unidade,
        "por_setor_vinculado": por_setor_vinculado,
        "nao_lotados": nao_lotados,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(saida, ensure_ascii=False, indent=2, sort_keys=True),
        encoding="utf-8",
    )
    print(f"Efetivo real gravado em {OUTPUT_PATH} — total ativo: {total_ativo}")
    if nao_lotados:
        print(f"Não lotados (contam só no total geral): {nao_lotados}")

    # -------------------------
    # Relação nominal por unidade (só campos confirmados com o usuário —
    # ver docstring do módulo)
    # -------------------------
    hoje = date.today()

    def calcular_idade(data_nascimento):
        if data_nascimento is None:
            return None
        nasc = data_nascimento.date() if hasattr(data_nascimento, "date") else data_nascimento
        idade = hoje.year - nasc.year - ((hoje.month, hoje.day) < (nasc.month, nasc.day))
        return idade

    lista_por_unidade = {}
    for ome, posto_grad, matricula, nome, nome_guerra, sexo, data_nascimento, ordem in militares:
        sigla = mapeamento.get(ome)
        ome_exibicao = None
        if not sigla:
            # Não lotados (ex. ADIDO) contam no efetivo do Comando Geral —
            # mesma regra do efetivo.json/organograma.js (overlay de
            # efetivoNaoLotado). Sem isso, a tabela de detalhes do Comando
            # Geral ficava 187 registros menor que o KPI "Efetivo Atual".
            sigla = "COMANDO GERAL"
            # ...mas na COLUNA OME da tabela eles devem aparecer como a
            # origem real ("ADIDO"), não "COMANDO GERAL" — o único militar
            # que deve mostrar "COMANDO GERAL" é o próprio comandante geral
            # (ome de origem = "CG", que mapeia direto). Ver
            # DW_PLANEJAMENTO.md (2026-08-18).
            ome_exibicao = ome
        elif ome in OME_SETOR_VINCULADO:
            # Setor vinculado (ex. CPPA): conta no efetivo da mãe (sigla),
            # mas a coluna OME mostra a origem real, e é por ela que o
            # filtro de setor vinculado encontra esses militares.
            ome_exibicao = ome
        lista_por_unidade.setdefault(sigla, []).append({
            "postoGrad": posto_grad,
            "matricula": matricula,
            "nome": nome,
            "nomeGuerra": nome_guerra,
            "sexo": sexo,
            "idade": calcular_idade(data_nascimento),
            # Antiguidade (ordemHierarquica do Neon) — a tabela de Efetivo
            # ordena por este campo, não por OME (pedido de 2026-08-19).
            "ordem": ordem,
            "omeExibicao": ome_exibicao,
            "completo": completos_por_matricula.get(matricula, {}),
        })

    OUTPUT_LISTA_PATH.write_text(
        json.dumps(
            {
                "fonte": "Neon (tabela Militar, ativo=true)",
                "gerado_em": datetime.now(timezone.utc).isoformat(),
                "por_unidade": lista_por_unidade,
            },
            ensure_ascii=False, indent=2, sort_keys=True,
        ),
        encoding="utf-8",
    )
    print(f"Relação nominal de Efetivo gravada em {OUTPUT_LISTA_PATH}")


if __name__ == "__main__":
    main()
