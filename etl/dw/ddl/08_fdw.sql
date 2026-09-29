-- Carga raw direto de banco para banco, via postgres_fdw.
--
-- Para as fontes que sao Postgres da rede interna (SGP, escala, mapa de
-- forca, Frota; depois vacinacao e ROE), o proprio DW le a origem: cada
-- tabela de origem aparece como foreign table em fdw_<fonte>, e
-- stg.carregar_raw('<fonte>') copia todas elas para raw_<fonte>. O dado nao
-- passa pelo worker do Windmill -- o Windmill so chama o procedimento, agenda
-- e guarda o log.
--
-- Servidores, user mappings e foreign tables NAO estao aqui: dependem de
-- credencial, e sao criados por etl/dw/configurar_fdw.py a partir das
-- variaveis de ambiente. Este arquivo so tem o que e versionavel.
--
-- Fontes que nao sao Postgres interno (planilhas Google, o sistema de
-- reserva no Neon) continuam em Python: etl/windmill/dw/raw_planilhas.py e
-- etl/dw/carga_raw.py.

CREATE EXTENSION IF NOT EXISTS postgres_fdw;

-- Copia uma foreign table para a raw correspondente. Recria a tabela raw
-- com as mesmas colunas (a foreign table ja vem sem as colunas negadas, como
-- CPF -- ver configurar_fdw.py) mais carga_id/extraido_em, igual a
-- carga_raw.py. Devolve o numero de linhas.
CREATE OR REPLACE FUNCTION stg.copiar_tabela_fdw(p_fonte text, p_tabela text, p_carga_id bigint)
RETURNS bigint
LANGUAGE plpgsql AS $$
DECLARE
    v_origem  text := format('%I.%I', 'fdw_' || p_fonte, p_tabela);
    v_destino text := format('%I.%I', 'raw_' || p_fonte, p_tabela);
    v_nomes   text;
    v_defs    text;
    v_linhas  bigint;
BEGIN
    SELECT string_agg(format('%I', attname), ', ' ORDER BY attnum),
           string_agg(format('%I %s', attname, format_type(atttypid, atttypmod)), ', ' ORDER BY attnum)
      INTO v_nomes, v_defs
      FROM pg_attribute
     WHERE attrelid = v_origem::regclass AND attnum > 0 AND NOT attisdropped;

    IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'raw_' || p_fonte) THEN
        EXECUTE format('CREATE SCHEMA %I', 'raw_' || p_fonte);
    END IF;
    EXECUTE format('DROP TABLE IF EXISTS %s', v_destino);
    EXECUTE format(
        'CREATE TABLE %s (%s, carga_id bigint NOT NULL, extraido_em timestamptz NOT NULL DEFAULT now())',
        v_destino, v_defs);
    EXECUTE format('INSERT INTO %s (%s, carga_id) SELECT %s, %s FROM %s',
                   v_destino, v_nomes, v_nomes, p_carga_id, v_origem);
    GET DIAGNOSTICS v_linhas = ROW_COUNT;
    RETURN v_linhas;
END $$;

-- Carrega todas as foreign tables de fdw_<fonte>. Cada tabela e uma
-- transacao: a linha de stg.carga e gravada antes (fica 'em_andamento' se o
-- processo morrer), a copia roda num bloco proprio (erro desfaz so aquela
-- tabela, e a raw anterior continua intacta) e o status final e gravado
-- depois. Se alguma tabela falhar, o procedimento termina com erro -- para o
-- Windmill marcar o job como falho -- mas so depois de tentar todas.
--
-- Uso:  CALL stg.carregar_raw('frota');   (fora de transacao explicita)
CREATE OR REPLACE PROCEDURE stg.carregar_raw(p_fonte text)
LANGUAGE plpgsql AS $$
DECLARE
    r        record;
    v_carga  bigint;
    v_linhas bigint;
    v_falhas text[] := '{}';
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'fdw_' || p_fonte) THEN
        RAISE EXCEPTION 'fonte % sem schema fdw_% -- rodar etl/dw/configurar_fdw.py', p_fonte, p_fonte;
    END IF;

    FOR r IN
        SELECT c.relname AS tabela,
               max(o.option_value) FILTER (WHERE o.option_name = 'schema_name') || '.' ||
               max(o.option_value) FILTER (WHERE o.option_name = 'table_name') AS origem
          FROM pg_class c
          JOIN pg_namespace n     ON n.oid = c.relnamespace
          JOIN pg_foreign_table t ON t.ftrelid = c.oid
          CROSS JOIN LATERAL pg_options_to_table(t.ftoptions) o
         WHERE n.nspname = 'fdw_' || p_fonte AND c.relkind = 'f'
         GROUP BY c.relname
         ORDER BY c.relname
    LOOP
        INSERT INTO stg.carga (fonte, tabela, observacao)
        VALUES (r.origem, format('raw_%s.%s', p_fonte, r.tabela), 'postgres_fdw')
        RETURNING carga_id INTO v_carga;
        COMMIT;

        BEGIN
            v_linhas := stg.copiar_tabela_fdw(p_fonte, r.tabela, v_carga);
            UPDATE stg.carga SET concluido_em = clock_timestamp(), linhas = v_linhas, status = 'ok'
             WHERE carga_id = v_carga;
            RAISE NOTICE 'raw_%.%: % linhas', p_fonte, r.tabela, v_linhas;
        EXCEPTION WHEN OTHERS THEN
            UPDATE stg.carga
               SET concluido_em = clock_timestamp(), status = 'erro',
                   observacao = 'postgres_fdw: ' || SQLERRM
             WHERE carga_id = v_carga;
            v_falhas := v_falhas || r.tabela;
            RAISE WARNING 'raw_%.% falhou: %', p_fonte, r.tabela, SQLERRM;
        END;
        COMMIT;
    END LOOP;

    IF cardinality(v_falhas) > 0 THEN
        RAISE EXCEPTION 'carga raw_% com falha em: %', p_fonte, array_to_string(v_falhas, ', ');
    END IF;
END $$;
