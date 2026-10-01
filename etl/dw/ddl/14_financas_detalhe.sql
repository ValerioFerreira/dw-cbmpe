-- DF: detalhe por lancamento para a aba "Despesas Gerais" (2026-10-01).
--
-- Regra do usuario: o sistema mostra os dados como estao na planilha. So se
-- trata GRAFIA (tipo de gasto e mes) -- ver tratar_grafia_financas() em
-- etl/dw/carga_core.py. Os campos originais ficam guardados.

ALTER TABLE core.fato_financeiro
    ADD COLUMN IF NOT EXISTS oficio              text,
    ADD COLUMN IF NOT EXISTS item                text,
    ADD COLUMN IF NOT EXISTS empenho             text,
    ADD COLUMN IF NOT EXISTS ficha_financ_original text,
    ADD COLUMN IF NOT EXISTS mes_original       text,
    ADD COLUMN IF NOT EXISTS mes_rotulo         text,   -- JAN..DEZ (ou NOV/2025), ja tratado
    ADD COLUMN IF NOT EXISTS mes_ordem          integer; -- aaaamm, para ordenar

-- Colunas novas no FIM: CREATE OR REPLACE VIEW nao deixa mexer nas existentes.
CREATE OR REPLACE VIEW stg.financas_destino AS
SELECT f.bloco, f.linha, f.destino, f.enquadramento, f.situacao, f.natureza, f.mes,
       f.valor, f.valor_liquidado, f.valor_pago,
       CASE WHEN dp.chave IS NOT NULL THEN dp.sigla ELSE o.sigla END AS sigla_organograma,
       (dp.chave IS NULL AND o.sigla IS NULL)                        AS sem_mapeamento,
       f.ficha_financ, f.mes_rotulo, f.mes_ordem, f.oficio, f.item, f.empenho
FROM core.fato_financeiro f
LEFT JOIN stg.de_para_destino_financas dp ON dp.chave = stg.normalizar_sigla(f.destino)
LEFT JOIN (SELECT DISTINCT sigla FROM app.organograma_unidade) o
       ON stg.normalizar_sigla(o.sigla) = stg.normalizar_sigla(f.destino);

-- Uma linha por lancamento, sem texto livre (SEI, descricao e observacao ficam
-- de fora: o auxilio funeral traz nome de falecido). `unidade` e a sigla do
-- organograma, ou NULL quando o destino nao e uma OME ("Aos mesmos", DPAFO...):
-- o backend so entrega essas linhas a quem ve Financas de todas as unidades.
CREATE OR REPLACE VIEW marts.painel_df_lancamento AS
SELECT CASE bloco WHEN 'autorizacao'   THEN 'Autorização'
                  WHEN 'carnaval_2026' THEN 'Carnaval 2026'
                  ELSE 'SFI Ordinário' END                  AS bloco,
       sigla_organograma                                    AS unidade,
       nullif(trim(destino), '')                            AS destino,
       nullif(trim(enquadramento), '')                      AS enquadramento,
       nullif(trim(situacao), '')                           AS situacao,
       ficha_financ                                         AS tipo,
       natureza,
       mes_rotulo                                           AS mes,
       mes_ordem,
       oficio, item, empenho,
       valor, valor_liquidado, valor_pago,
       (valor_pago > valor_liquidado + 0.005)               AS pago_maior_liquidado,
       (valor_liquidado > valor + 0.005)                    AS liquidado_maior_empenhado,
       (valor_pago > valor + 0.005)                         AS pago_maior_empenhado
FROM stg.financas_destino;

GRANT SELECT ON marts.painel_df_lancamento TO app_reader, bi_reader;
