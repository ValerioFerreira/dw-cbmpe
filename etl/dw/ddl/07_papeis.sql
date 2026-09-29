-- Papeis de acesso ao DW (diretriz D7 de DW_INGESTAO.md).
--
-- Sao papeis-GRUPO, sem login. O usuario de login de cada consumidor (o
-- Windmill, o backend do app, o Metabase) e criado a parte, com senha
-- guardada no cofre e nos App Configs do CapRover -- nunca neste arquivo --
-- e recebe o grupo com GRANT <grupo> TO <usuario>.
--
--   etl_writer  escreve em raw_*, stg, core e marts. So o ETL.
--   app_reader  le marts e le/escreve o estado do app (schema app). So o
--               backend. Nao enxerga raw_*, stg nem core: se o app precisa
--               de um dado, ele vira view em marts (D6).
--   bi_reader   le marts. Metabase / Power BI.
--
-- As views de marts leem core com o privilegio do DONO da view, entao
-- app_reader e bi_reader nao precisam (e nao devem ter) acesso a core.
--
-- Os schemas fdw_* (08_fdw.sql) nao recebem grant de ninguem: foreign table
-- e passagem direta para o sistema de origem.

DO $$
DECLARE
    papel text;
BEGIN
    FOREACH papel IN ARRAY ARRAY['etl_writer', 'app_reader', 'bi_reader'] LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = papel) THEN
            EXECUTE format('CREATE ROLE %I NOLOGIN', papel);
        END IF;
    END LOOP;
END $$;

-- Ninguem cria objeto em public por acidente.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- etl_writer: todas as camadas analiticas. As tabelas raw sao recriadas a
-- cada carga (DROP + CREATE), por isso os DEFAULT PRIVILEGES abaixo --
-- grant em tabela existente se perde no DROP.
DO $$
DECLARE
    esquema text;
BEGIN
    FOR esquema IN
        SELECT nspname FROM pg_namespace
        WHERE nspname LIKE 'raw\_%' OR nspname IN ('stg', 'core', 'marts')
    LOOP
        EXECUTE format('GRANT USAGE, CREATE ON SCHEMA %I TO etl_writer', esquema);
        EXECUTE format('GRANT ALL ON ALL TABLES IN SCHEMA %I TO etl_writer', esquema);
        EXECUTE format('GRANT ALL ON ALL SEQUENCES IN SCHEMA %I TO etl_writer', esquema);
        EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT ALL ON TABLES TO etl_writer', esquema);
        EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT ALL ON SEQUENCES TO etl_writer', esquema);
    END LOOP;
END $$;

-- app_reader e bi_reader: so marts.
GRANT USAGE ON SCHEMA marts TO app_reader, bi_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA marts TO app_reader, bi_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA marts GRANT SELECT ON TABLES TO app_reader, bi_reader;

-- app_reader: estado editavel do app (organograma, perfis). O backend grava
-- aqui; o BI nao ve.
GRANT USAGE ON SCHEMA app TO app_reader;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app TO app_reader;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA app TO app_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT USAGE ON SEQUENCES TO app_reader;

-- etl_writer e DONO das camadas que o ETL reescreve (raw_*, raw_ref, stg,
-- core). Grant nao basta: o ETL recria views em stg (carga_core.py) e, quando
-- a origem muda de colunas, recria tabelas raw -- DROP e CREATE OR REPLACE
-- exigem ser dono. O usuario de login do Windmill (windmill_etl) entra com
-- `SET role = etl_writer` (etl/dw/criar_usuarios.py), entao o que ele cria
-- tambem fica com etl_writer. marts continua do administrador: as views de
-- consumo so mudam por DDL revisado, nunca pelo ETL. Roda a cada aplicacao
-- do DDL, para pegar tabela nova criada pelo administrador.
DO $$
DECLARE
    obj record;
BEGIN
    FOR obj IN
        SELECT n.nspname, c.relname, c.relkind
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE (n.nspname LIKE 'raw\_%' OR n.nspname IN ('stg', 'core'))
           AND c.relkind IN ('r', 'v', 'm', 'p')
           AND pg_get_userbyid(c.relowner) <> 'etl_writer'
    LOOP
        EXECUTE format('ALTER %s %I.%I OWNER TO etl_writer',
                       CASE obj.relkind WHEN 'v' THEN 'VIEW'
                                        WHEN 'm' THEN 'MATERIALIZED VIEW'
                                        ELSE 'TABLE' END,
                       obj.nspname, obj.relname);
    END LOOP;
END $$;

-- etl_writer le a hierarquia do organograma (carga_core.py monta
-- dim_ome_ancestral a partir dela), mas nao altera o estado do app.
GRANT USAGE ON SCHEMA app TO etl_writer;
GRANT SELECT ON app.organograma_unidade TO etl_writer;
