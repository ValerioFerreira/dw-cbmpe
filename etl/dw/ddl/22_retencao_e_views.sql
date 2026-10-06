-- Ajustes de 2026-10-06 (parte 2):
--   1. as views de stg/marts passam a ser do etl_writer (a carga precisa poder
--      derruba-las e recria-las quando recria uma tabela raw);
--   2. a carga raw via fdw preserva as views dependentes (antes o DROP ... CASCADE as
--      levava junto e o app ficava sem dado ate o DDL ser reaplicado);
--   3. retencao de 30 dias do Mapa de Forca: a raw so copia os ultimos 30 dias, e o
--      que sai da janela vira historico AGREGADO por dia (tabelas abaixo);
--   4. sai a view marts.painel_df_funeral, sem uso desde que o Auxilio Funeral deixou
--      o painel de Financas.

-- 1. Dono das views ----------------------------------------------------------------
DO $$
DECLARE
    v record;
BEGIN
    FOR v IN
        SELECT n.nspname, c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = 'v' AND n.nspname IN ('stg', 'marts')
          AND pg_get_userbyid(c.relowner) <> 'etl_writer'
    LOOP
        EXECUTE format('ALTER VIEW %I.%I OWNER TO etl_writer', v.nspname, v.relname);
    END LOOP;
END $$;

-- 4. Sem uso -------------------------------------------------------------------------
DROP VIEW IF EXISTS marts.painel_df_funeral;

-- 3. Historico agregado do emprego operacional --------------------------------------
-- O DW so guarda os ultimos 30 dias de lancamento do Mapa de Forca (a decisao do
-- Comando: quem precisar de data anterior recorre ao sistema do proprio Mapa de
-- Forca). Para nao perder o que o BI e o validar.py usam (serie por mes, uso de cada
-- viatura), o que SAI da janela e gravado aqui, por dia, antes do corte
-- (carga_core.py, guardar_historico_emprego). Sem matricula nem nome.
CREATE TABLE IF NOT EXISTS core.emprego_historico_viatura_dia (
    id_frota     integer NOT NULL,
    data         date    NOT NULL,
    lancamentos  integer NOT NULL,
    PRIMARY KEY (id_frota, data)
);
CREATE TABLE IF NOT EXISTS core.emprego_historico_ome_dia (
    sigla                text    NOT NULL,
    data                 date    NOT NULL,
    lancamentos          integer NOT NULL,
    militares_escalados  integer NOT NULL,
    PRIMARY KEY (sigla, data)
);
ALTER TABLE core.emprego_historico_viatura_dia OWNER TO etl_writer;
ALTER TABLE core.emprego_historico_ome_dia     OWNER TO etl_writer;

-- Uso de cada viatura: historico (dias que ja sairam da janela) + janela. O historico
-- so vale ANTES do primeiro dia que ainda esta no core, para nao contar um dia duas
-- vezes.
CREATE OR REPLACE VIEW marts.emprego_viatura_resumo AS
WITH janela AS (
    SELECT coalesce(min(t.data), DATE '9999-12-31') AS inicio
    FROM core.fato_lancamento_viatura l
    JOIN core.dim_tempo t ON t.sk_tempo = l.sk_tempo
),
uso AS (
    SELECT h.id_frota, h.data, h.lancamentos
    FROM core.emprego_historico_viatura_dia h, janela j
    WHERE h.data < j.inicio
    UNION ALL
    SELECT v.id_frota, t.data, count(*)::integer
    FROM core.fato_lancamento_viatura l
    JOIN core.dim_viatura v ON v.sk_viatura = l.sk_viatura
    JOIN core.dim_tempo t ON t.sk_tempo = l.sk_tempo
    GROUP BY v.id_frota, t.data
)
SELECT atual.sk_viatura,
       atual.id_frota,
       atual.placa,
       atual.tipo_acronym,
       atual.numero_ordem,
       atual.situacao,
       o.sigla                          AS sigla_ome,
       count(DISTINCT u.data)           AS dias_empregada,
       coalesce(sum(u.lancamentos), 0)  AS lancamentos,
       min(u.data)                      AS primeiro_emprego,
       max(u.data)                      AS ultimo_emprego,
       current_date - max(u.data)       AS dias_desde_ultimo_emprego
FROM core.dim_viatura atual
LEFT JOIN uso u          ON u.id_frota = atual.id_frota
LEFT JOIN core.dim_ome o ON o.sk_ome = atual.sk_ome
WHERE atual.versao_atual
GROUP BY atual.sk_viatura, atual.id_frota, atual.placa, atual.tipo_acronym,
         atual.numero_ordem, atual.situacao, o.sigla;

-- Emprego por unidade e mes. `militares_distintos` so existe para mes que esta
-- INTEIRO na janela de 30 dias do core (distinto nao se soma entre dias); nos meses
-- com dia vindo do historico fica NULL.
CREATE OR REPLACE VIEW marts.emprego_operacional_mes AS
WITH janela AS (
    SELECT coalesce(min(t.data), DATE '9999-12-31') AS inicio
    FROM core.fato_lancamento_militar l
    JOIN core.dim_tempo t ON t.sk_tempo = l.sk_tempo
),
dias AS (
    SELECT h.sigla, h.data, h.lancamentos::bigint AS lancamentos,
           h.militares_escalados::bigint AS escalados, NULL::bigint AS distintos, true AS historico
    FROM core.emprego_historico_ome_dia h, janela j
    WHERE h.data < j.inicio
    UNION ALL
    SELECT o.sigla, t.data, count(DISTINCT l.id_lancamento), count(*), count(DISTINCT l.sk_militar), false
    FROM core.fato_lancamento_militar l
    JOIN core.dim_tempo t ON t.sk_tempo = l.sk_tempo
    JOIN core.dim_ome o   ON o.sk_ome = l.sk_ome
    GROUP BY o.sigla, t.data
)
SELECT o.sk_ome,
       d.sigla,
       to_char(d.data, 'YYYY-MM')                          AS ano_mes,
       sum(d.lancamentos)::bigint                          AS lancamentos,
       sum(d.escalados)::bigint                            AS militares_escalados,
       CASE WHEN bool_or(d.historico) THEN NULL
            ELSE sum(d.distintos)::bigint END              AS militares_distintos
FROM dias d
JOIN core.dim_ome o ON o.sigla = d.sigla
GROUP BY o.sk_ome, d.sigla, to_char(d.data, 'YYYY-MM');

GRANT SELECT ON marts.emprego_viatura_resumo, marts.emprego_operacional_mes TO app_reader, bi_reader;

-- 3b. Filtro por tabela na carga raw via fdw ---------------------------------------
-- stg.raw_filtro.condicao e um WHERE (sobre as colunas da foreign table) aplicado na
-- copia daquela tabela. So o Mapa de Forca usa: ultimos 30 dias, contados a partir do
-- ultimo lancamento da origem; as tabelas-filho seguem os lancamentos da janela.
CREATE TABLE IF NOT EXISTS stg.raw_filtro (
    fonte     text NOT NULL,
    tabela    text NOT NULL,
    condicao  text NOT NULL,
    PRIMARY KEY (fonte, tabela)
);
ALTER TABLE stg.raw_filtro OWNER TO etl_writer;
INSERT INTO stg.raw_filtro (fonte, tabela, condicao) VALUES
    ('mapa_forca', 'launches',
        '"date" > (SELECT max("date") FROM fdw_mapa_forca.launches) - 30'),
    ('mapa_forca', 'launch_militaries',
        'launch_id IN (SELECT id FROM fdw_mapa_forca.launches WHERE "date" > (SELECT max("date") FROM fdw_mapa_forca.launches) - 30)'),
    ('mapa_forca', 'launch_vehicles',
        'launch_id IN (SELECT id FROM fdw_mapa_forca.launches WHERE "date" > (SELECT max("date") FROM fdw_mapa_forca.launches) - 30)'),
    ('mapa_forca', 'launch_operational_resources',
        'launch_id IN (SELECT id FROM fdw_mapa_forca.launches WHERE "date" > (SELECT max("date") FROM fdw_mapa_forca.launches) - 30)')
ON CONFLICT (fonte, tabela) DO UPDATE SET condicao = EXCLUDED.condicao;

-- 2 e 3b. Copia fdw: aplica o filtro e preserva as views dependentes. Mesmo corpo de
-- 08_fdw.sql, mais as duas coisas acima.
CREATE OR REPLACE FUNCTION stg.copiar_tabela_fdw(p_fonte text, p_tabela text, p_carga_id bigint)
RETURNS bigint
LANGUAGE plpgsql AS $$
DECLARE
    v_origem  text := format('%I.%I', 'fdw_' || p_fonte, p_tabela);
    v_destino text := format('%I.%I', 'raw_' || p_fonte, p_tabela);
    v_nomes   text;
    v_defs    text;
    v_atuais  text;
    v_linhas  bigint;
    v_filtro  text;
    v_salvas  jsonb := '[]'::jsonb;
    v         jsonb;
BEGIN
    SELECT string_agg(format('%I', attname), ', ' ORDER BY attnum),
           string_agg(format('%I %s', attname, format_type(atttypid, atttypmod)), ', ' ORDER BY attnum)
      INTO v_nomes, v_defs
      FROM pg_attribute
     WHERE attrelid = v_origem::regclass AND attnum > 0 AND NOT attisdropped;

    IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'raw_' || p_fonte) THEN
        EXECUTE format('CREATE SCHEMA %I', 'raw_' || p_fonte);
    END IF;

    SELECT condicao INTO v_filtro FROM stg.raw_filtro WHERE fonte = p_fonte AND tabela = p_tabela;

    SELECT string_agg(format('%I %s', attname, format_type(atttypid, atttypmod)), ', ' ORDER BY attnum)
      INTO v_atuais
      FROM pg_attribute
     WHERE attrelid = to_regclass(v_destino) AND attnum > 0 AND NOT attisdropped
       AND attname NOT IN ('carga_id', 'extraido_em');

    IF v_atuais IS NOT DISTINCT FROM v_defs THEN
        EXECUTE format('TRUNCATE %s', v_destino);
    ELSE
        -- Guarda as views que dependem da tabela (definicao, ordem e permissoes) para
        -- recria-las depois do DROP ... CASCADE.
        IF to_regclass(v_destino) IS NOT NULL THEN
            SELECT coalesce(jsonb_agg(jsonb_build_object('s', q.nspname, 'n', q.relname, 'd', q.def, 'a', q.acl)
                                      ORDER BY q.nivel, q.nspname, q.relname), '[]'::jsonb)
              INTO v_salvas
              FROM (
                  WITH RECURSIVE dep(view_oid, nivel) AS (
                      SELECT r.ev_class, 1
                        FROM pg_depend d
                        JOIN pg_rewrite r ON r.oid = d.objid
                        JOIN pg_class vv ON vv.oid = r.ev_class AND vv.relkind = 'v'
                       WHERE d.refobjid = to_regclass(v_destino) AND d.classid = 'pg_rewrite'::regclass
                         AND r.ev_class <> d.refobjid
                      UNION
                      SELECT r.ev_class, dep.nivel + 1
                        FROM dep
                        JOIN pg_depend d ON d.refobjid = dep.view_oid AND d.classid = 'pg_rewrite'::regclass
                        JOIN pg_rewrite r ON r.oid = d.objid
                        JOIN pg_class vv ON vv.oid = r.ev_class AND vv.relkind = 'v'
                       WHERE r.ev_class <> dep.view_oid
                  )
                  SELECT n.nspname, c.relname, pg_get_viewdef(c.oid, true) AS def,
                         c.relacl::text AS acl, max(dep.nivel) AS nivel
                    FROM dep
                    JOIN pg_class c ON c.oid = dep.view_oid
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                   GROUP BY n.nspname, c.relname, c.oid, c.relacl
              ) q;
        END IF;
        EXECUTE format('DROP TABLE IF EXISTS %s CASCADE', v_destino);
        EXECUTE format(
            'CREATE TABLE %s (%s, carga_id bigint NOT NULL, extraido_em timestamptz NOT NULL DEFAULT now())',
            v_destino, v_defs);
        FOR v IN SELECT * FROM jsonb_array_elements(v_salvas)
        LOOP
            BEGIN
                EXECUTE format('CREATE VIEW %I.%I AS %s', v->>'s', v->>'n',
                               rtrim(rtrim(v->>'d'), ';'));
                IF (v->>'a') ~ 'app_reader=[a-zA-Z*]*r' THEN
                    EXECUTE format('GRANT SELECT ON %I.%I TO app_reader', v->>'s', v->>'n');
                END IF;
                IF (v->>'a') ~ 'bi_reader=[a-zA-Z*]*r' THEN
                    EXECUTE format('GRANT SELECT ON %I.%I TO bi_reader', v->>'s', v->>'n');
                END IF;
                RAISE NOTICE 'view %.% recriada', v->>'s', v->>'n';
            EXCEPTION WHEN OTHERS THEN
                RAISE WARNING 'view %.% NAO foi recriada (%); ajuste o DDL e reaplique', v->>'s', v->>'n', SQLERRM;
            END;
        END LOOP;
    END IF;

    EXECUTE format('INSERT INTO %s (%s, carga_id) SELECT %s, %s FROM %s %s',
                   v_destino, v_nomes, v_nomes, p_carga_id, v_origem,
                   CASE WHEN v_filtro IS NULL THEN '' ELSE 'WHERE ' || v_filtro END);
    GET DIAGNOSTICS v_linhas = ROW_COUNT;
    RETURN v_linhas;
END $$;
