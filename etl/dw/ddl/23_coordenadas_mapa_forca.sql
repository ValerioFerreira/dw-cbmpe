-- Coordenadas do Mapa de Forca no DW (2026-10-08): o catalogo de postos deixa de ser um arquivo
-- do repositorio (backend/data/mapa_forca_postos.json) e passa a ser tabela.
--
--   stg.coordenada_secao   o que o usuario informou, secao por secao (etl/mapa_forca/
--                          coordenadas_secoes.csv). Tem PRIORIDADE sobre qualquer outra fonte.
--   stg.coordenada_posto   resultado por posto de servico (id_posto do ovresc), com a origem da
--                          coordenada; gravado por etl/mapa_forca/extract_mapa_forca.py --gravar-dw
--                          (KMZ, malha do IBGE e regras do usuario ficam nesse script).
--   stg.mapa_forca_ome     OMEs do organograma que lancam no Mapa de Forca (nome, municipio, ponto).
--   marts.mapa_forca_posto / mapa_forca_ome   leitura do backend (GET /dados/mapa-forca/indice).
-- Nada aqui e dado pessoal. As tabelas stg.* nao sao tocadas pela carga diaria.

CREATE TABLE IF NOT EXISTS stg.coordenada_secao (
    ome          text    NOT NULL,            -- sigla do organograma ('1º GB', 'CAT/ZM'...)
    secao        text    NOT NULL DEFAULT '', -- '1ª SB'; vazio = a propria unidade (CATs)
    cidade       text    NOT NULL,
    latitude     numeric(12, 9) NOT NULL,
    longitude    numeric(12, 9) NOT NULL,
    informado_em date    NOT NULL DEFAULT current_date,
    PRIMARY KEY (ome, secao)
);

CREATE TABLE IF NOT EXISTS stg.coordenada_posto (
    id_posto     integer PRIMARY KEY,
    nome         text,
    ome          text,                        -- sigla do organograma
    municipio    text,
    bairro       text,
    ais          text,
    latitude     numeric(12, 9),
    longitude    numeric(12, 9),
    origem       text,                        -- posto | unidade | municipio | ome | NULL (sem coordenada)
    fonte        text,                        -- secao_informada | kmz/fonte | ...
    sede         boolean NOT NULL DEFAULT false,
    gerado_em    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stg.mapa_forca_ome (
    sigla        text PRIMARY KEY,            -- sigla do organograma
    nome         text,
    municipio    text,
    latitude     numeric(12, 9),
    longitude    numeric(12, 9),
    gerado_em    timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON stg.coordenada_secao, stg.coordenada_posto, stg.mapa_forca_ome TO etl_writer;

CREATE OR REPLACE VIEW marts.mapa_forca_posto AS
SELECT id_posto, nome, ome, municipio, bairro, ais,
       latitude::float8 AS lat, longitude::float8 AS lon, origem AS origem_coord, sede, gerado_em
FROM stg.coordenada_posto;

CREATE OR REPLACE VIEW marts.mapa_forca_ome AS
SELECT sigla, nome, municipio, latitude::float8 AS lat, longitude::float8 AS lon, gerado_em
FROM stg.mapa_forca_ome;

ALTER VIEW marts.mapa_forca_posto OWNER TO etl_writer;
ALTER VIEW marts.mapa_forca_ome   OWNER TO etl_writer;
GRANT SELECT ON marts.mapa_forca_posto, marts.mapa_forca_ome TO app_reader, bi_reader;
