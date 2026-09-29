-- Camadas do DW do CBMPE. Ver DW_ARQUITETURA.md e DW_MODELO_DADOS.md.
--
--   raw_*   copia fiel da fonte, append-only, com carga_id e extraido_em.
--           Nada e transformado aqui: e o que permite reprocessar sem
--           reler a origem.
--   stg     padronizacao, sanidade e TODOS os de-para entre sistemas.
--           E aqui que a regra de negocio comeca.
--   core    dimensoes conformadas e fatos. Fonte de verdade. Tem dado
--           sensivel, entao acesso restrito.
--   marts   views de consumo. Unico schema que o app e o BI enxergam.

CREATE SCHEMA IF NOT EXISTS raw_sgp;
CREATE SCHEMA IF NOT EXISTS raw_escala;
CREATE SCHEMA IF NOT EXISTS raw_mapa_forca;
CREATE SCHEMA IF NOT EXISTS raw_frota;
CREATE SCHEMA IF NOT EXISTS raw_peculio;
CREATE SCHEMA IF NOT EXISTS raw_vacina;
CREATE SCHEMA IF NOT EXISTS raw_reserva;
-- 2026-09-29. Declarados aqui porque o ETL roda como etl_writer, que nao
-- tem permissao de criar schema no banco.
CREATE SCHEMA IF NOT EXISTS raw_roe;
CREATE SCHEMA IF NOT EXISTS raw_financas;
CREATE SCHEMA IF NOT EXISTS raw_inativos;
CREATE SCHEMA IF NOT EXISTS raw_escolaridade;
CREATE SCHEMA IF NOT EXISTS raw_cim;
CREATE SCHEMA IF NOT EXISTS raw_materiais;
CREATE SCHEMA IF NOT EXISTS raw_qod;
CREATE SCHEMA IF NOT EXISTS stg;
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS marts;

COMMENT ON SCHEMA raw_sgp IS 'Copia fiel do ovrsgp (SGP), append-only.';
COMMENT ON SCHEMA raw_escala IS 'Copia fiel do ovresc (escala eletronica / cadastro-mestre do mapa de forca).';
COMMENT ON SCHEMA raw_mapa_forca IS 'Copia fiel do mapa_forca_api_development.';
COMMENT ON SCHEMA raw_frota IS 'Copia fiel do sistema de frotas.';
COMMENT ON SCHEMA raw_peculio IS 'Copia fiel da planilha do Peculio (Google Sheets), fonte atual do efetivo ativo.';
COMMENT ON SCHEMA raw_vacina IS 'Copia fiel do vaccine_control_production.';
COMMENT ON SCHEMA raw_roe IS 'Views de analise do ROE (ocorrencias), sem dado pessoal de cidadao -- ver NEGADAS em carga_raw.py.';
COMMENT ON SCHEMA raw_qod IS 'Copia fiel do QOD publicado (previsto e lotacao por funcao).';
COMMENT ON SCHEMA raw_reserva IS 'Copia fiel do sistema de controle de reserva remunerada (Neon). Unica fonte em que o Neon e sistema de origem, nao cache.';
COMMENT ON SCHEMA stg IS 'Padronizacao e de-para entre sistemas.';
COMMENT ON SCHEMA core IS 'Dimensoes conformadas e fatos. Acesso restrito.';
COMMENT ON SCHEMA marts IS 'Views de consumo para app e BI.';

-- Controle de carga: toda tabela raw referencia uma linha daqui, para dar
-- rastreabilidade e permitir reprocessar/descartar uma carga inteira.
CREATE TABLE IF NOT EXISTS stg.carga (
    carga_id     bigserial PRIMARY KEY,
    fonte        text        NOT NULL,
    tabela       text        NOT NULL,
    iniciado_em  timestamptz NOT NULL DEFAULT now(),
    concluido_em timestamptz,
    linhas       bigint,
    status       text        NOT NULL DEFAULT 'em_andamento',
    observacao   text
);

CREATE INDEX IF NOT EXISTS ix_carga_fonte_tabela ON stg.carga (fonte, tabela, iniciado_em DESC);
