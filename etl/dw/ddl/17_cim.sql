-- Painel 09 (Intencao de Movimentacao) do Dashboard Pessoal de Efetivo.
--
-- Fonte: as planilhas CIM (pedidos e atendidos), carregadas pelo flow dw_diario
-- em raw_cim.pedidos / raw_cim.atendidos (etl/windmill/dw/raw_planilhas.py).
-- Antes o painel lia um JSON gerado a mao a partir das tabelas public.cim_* do
-- Metabase (etl/efetivo/extract_intencao_movimentacao.py, removido).
--
-- As views entregam o MINIMO que o painel agrega: sem matricula nem nome (o
-- DW guarda, o app nao precisa -- DW_GOVERNANCA.md) e sem as linhas em branco
-- que a planilha traz ate o fim da folha (so entra linha com matricula).
-- Texto como esta na planilha: so trim, e "-" ou vazio viram NULL (e o que o
-- Metabase fazia com "opcao_n <> '-'").
--
-- O recorte por perfil e no backend: o painel e do Comando Geral (visao
-- corporativa, sem quebra por unidade) -- GET /dados/painel/movimentacao.

CREATE OR REPLACE VIEW marts.painel_cim_pedido AS
SELECT nullif(trim(col_01_posto_grad_atual), '')                                  AS posto_grad,
       nullif(trim(col_02_of_ou_praca), '')                                       AS categoria,
       nullif(trim(col_03_ome), '')                                               AS ome,
       CASE WHEN trim(col_06_ome_atual) IN ('', '-') THEN NULL ELSE trim(col_06_ome_atual) END AS ome_atual,
       CASE WHEN trim(col_07_opcao_1)   IN ('', '-') THEN NULL ELSE trim(col_07_opcao_1)   END AS opcao_1,
       CASE WHEN trim(col_08_opcao_2)   IN ('', '-') THEN NULL ELSE trim(col_08_opcao_2)   END AS opcao_2,
       CASE WHEN trim(col_09_opcao_3)   IN ('', '-') THEN NULL ELSE trim(col_09_opcao_3)   END AS opcao_3,
       nullif(trim(col_10_motivo), '')                                            AS motivo
FROM raw_cim.pedidos
WHERE nullif(trim(col_04_matricula), '') IS NOT NULL;

CREATE OR REPLACE VIEW marts.painel_cim_atendido AS
SELECT nullif(trim(col_01_posto_grad_atual), '')                                  AS posto_grad,
       nullif(trim(col_02_of_ou_praca), '')                                       AS categoria,
       nullif(trim(col_03_ome), '')                                               AS ome,
       CASE WHEN trim(col_06_ome_atual) IN ('', '-') THEN NULL ELSE trim(col_06_ome_atual) END AS ome_atual,
       nullif(trim(col_10_motivo), '')                                            AS motivo
FROM raw_cim.atendidos
WHERE nullif(trim(col_04_matricula), '') IS NOT NULL;

GRANT SELECT ON marts.painel_cim_pedido, marts.painel_cim_atendido TO app_reader, bi_reader;
ALTER VIEW marts.painel_cim_pedido   OWNER TO etl_writer;
ALTER VIEW marts.painel_cim_atendido OWNER TO etl_writer;
