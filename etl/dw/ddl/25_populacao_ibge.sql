-- Populacao dos municipios de Pernambuco (IBGE), para as taxas por habitante dos
-- paineis -- a primeira e a de CVI por 100 mil habitantes (2026-10-29).
--
-- Fonte: API de agregados do IBGE, tabela 6579 ("Estimativas de populacao"), variavel
-- 9324 ("Populacao residente estimada"), periodo mais recente. Carga por
-- etl/dw/carga_ibge.py, no flow dw_diario (uma requisicao; o IBGE publica a
-- estimativa nova uma vez por ano, e a carga passa a usa-la sozinha).

CREATE TABLE IF NOT EXISTS raw_ref.ibge_populacao (
    cod_ibge     text PRIMARY KEY,   -- codigo de 7 digitos do municipio
    municipio    text NOT NULL,      -- nome como o IBGE grava, sem o " - PE"
    uf           text NOT NULL,
    ano          int  NOT NULL,      -- ano da estimativa
    populacao    int  NOT NULL,
    carga_id     bigint NOT NULL,
    extraido_em  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE raw_ref.ibge_populacao OWNER TO etl_writer;

-- `municipio_chave`: nome sem acento, em maiusculas e sem espacos repetidos -- e assim
-- que os paineis casam com a cidade das outras fontes (ROE grava "Sao Caitano",
-- "Jaboatao dos Guararapes" com e sem acento).
CREATE OR REPLACE VIEW marts.populacao_municipio AS
SELECT cod_ibge,
       municipio,
       upper(regexp_replace(translate(municipio,
             'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç',
             'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'), '\s+', ' ', 'g')) AS municipio_chave,
       ano,
       populacao
FROM raw_ref.ibge_populacao;

ALTER VIEW marts.populacao_municipio OWNER TO etl_writer;
GRANT SELECT ON marts.populacao_municipio TO app_reader, bi_reader;
