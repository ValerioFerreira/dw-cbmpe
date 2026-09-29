-- Dado de referencia que nao tem sistema de origem vivo.
--
--   raw_ref   copia fiel de dado estatico: hoje, o que foi preservado do
--             banco dw_dim antes de aposenta-lo (2026-09-29) -- as unicas
--             coordenadas de OME que existem (o SGP tem 0,0 em todas) e os
--             catalogos de materiais. Carregado uma vez por
--             etl/dw/preservar_dw_dim.py; nao e agendado.
--
--   stg.coordenada_ome
--             resultado do casamento sigla SGP -> coordenada, com as regras
--             revisadas com o usuario (etl/sgp/casar_coordenadas_ome.py,
--             modo --gravar-dw). carga_core.py le daqui em vez de rodar o
--             casamento, para nao depender de arquivo nem de outro banco.

CREATE SCHEMA IF NOT EXISTS raw_ref;
COMMENT ON SCHEMA raw_ref IS 'Dado de referencia estatico, sem sistema de origem vivo (ex.: preservado do dw_dim).';

CREATE TABLE IF NOT EXISTS stg.coordenada_ome (
    id_ome      integer PRIMARY KEY,          -- ovrsgp.tb_ome.id_ome
    sigla       text,
    latitude    numeric(10, 6) NOT NULL,
    longitude   numeric(10, 6) NOT NULL,
    categoria   text NOT NULL,                -- casado, override, padrao_qcg...
    explicacao  text,
    gerado_em   timestamptz NOT NULL DEFAULT now()
);

GRANT USAGE ON SCHEMA raw_ref TO etl_writer;
GRANT ALL ON ALL TABLES IN SCHEMA raw_ref TO etl_writer;
ALTER DEFAULT PRIVILEGES IN SCHEMA raw_ref GRANT ALL ON TABLES TO etl_writer;
GRANT ALL ON stg.coordenada_ome TO etl_writer;
