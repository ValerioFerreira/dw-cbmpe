-- Dashboard Pessoal de Efetivo no DW (2026-10-06): o que ainda vinha de JSON
-- embutido no bundle (previsto por posto, saida de militares, previsao de
-- saida) passa a vir daqui, por GET /dados/painel/efetivo. Os JSON por
-- militar (militares, carreira_extra, adidos_extra) deixam de existir: o
-- front monta os registros a partir da relacao nominal do DW
-- (marts.efetivo_nominal, ja recortada por perfil no servidor).
--
-- Tudo aqui e AGREGADO (sem matricula nem nome); bi_reader tambem le.

-- ---------------------------------------------------------------------------
-- Efetivo previsto por unidade e posto/graduacao (quadros de setembro/2026,
-- core.qod_quadro_unidade). O front soma as unidades do escopo que esta vendo,
-- entao o Previsto/Deficit deixa de existir so para o Comando Geral.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW marts.previsto_quadro_posto AS
SELECT q.sigla_organograma AS sigla, p.posto, sum(p.qtd)::int AS previsto
FROM core.qod_quadro_unidade q
CROSS JOIN LATERAL (VALUES
    ('Cel', q.cel), ('Ten Cel', q.ten_cel),
    ('Maj QOC', q.maj_qoc), ('Cap QOC', q.cap_qoc), ('1ºTen QOC', q.ten1_qoc), ('2ºTen QOC', q.ten2_qoc),
    ('Maj QOA', q.maj_qoa), ('Cap QOA', q.cap_qoa), ('1ºTen QOA', q.ten1_qoa), ('2ºTen QOA', q.ten2_qoa),
    ('Subten', q.subten), ('1ºSgt', q.sgt1), ('2ºSgt', q.sgt2), ('3ºSgt', q.sgt3),
    ('Cb', q.cb), ('Sd', q.sd)
) AS p(posto, qtd)
WHERE q.sigla_organograma IS NOT NULL
GROUP BY q.sigla_organograma, p.posto;

-- ---------------------------------------------------------------------------
-- Saida de militares por ano (inativacoes, planilha "Inativos"), a partir de
-- 2015 -- o mesmo corte do card do Metabase.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW marts.painel_saida_ano AS
SELECT trim(col_07_ano)::int AS ano, count(*)::int AS total
FROM raw_inativos.planilha
WHERE trim(col_07_ano) ~ '^[0-9]{4}$' AND trim(col_07_ano)::int >= 2015
GROUP BY 1;

-- ---------------------------------------------------------------------------
-- Previsao de saida nos proximos 15 anos, por ano e categoria. SQL do Igor
-- (Metabase, 2026-08-19) reproduzido sem reinterpretar: LEAST entre a projecao
-- por tempo de servico (25 anos mulher / 30 homem, ate 2021-12-31; 35 anos
-- depois) e a por idade-limite (67 oficial, 65 praca).
-- "Cap QOC" entra na lista de oficiais (decisao do usuario, 2026-10-06): o SQL original
-- do Igor nao o tinha. Hoje o Peculio nao traz nenhum Cap QOC (o quadro preve 97), entao
-- o resultado nao muda, mas nao fica de fora quando aparecer.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW marts.painel_saida_previsao AS
WITH base AS (
    SELECT e.data_ingresso AS data_praca, e.sexo,
           CASE
               WHEN e.posto_grad IN ('Cel', 'Cel Promo. Req.', 'Ten Cel', 'Ten Cel Promo. Req.',
                                     'Maj QOC', 'Maj QOA', 'Maj QOA Promo. Req.', 'Cap QOC', 'Cap QOA',
                                     '1ºTen QOC', '1ºTen QOA', '2ºTen QOC', '2ºTen QOA',
                                     '2ºTen QOA Promo. Req.', 'Aspirante') THEN 'oficial'
               WHEN e.posto_grad IN ('Subten', 'Subten Promo. Req.', '1ºSgt', '1ºSgt Promo. Req./Invalidez',
                                     '2ºSgt', '2ºSgt Promo. Req./Invalidez', '3ºSgt', 'Cb', 'Sd') THEN 'praca'
           END AS categoria,
           (current_date - (e.idade || ' years')::interval)::date AS nascimento_estimado
    FROM marts.efetivo_nominal e
),
previsao AS (
    SELECT categoria,
           LEAST(
               CASE WHEN data_praca <= DATE '2021-12-31' THEN
                        CASE WHEN sexo = 'M' THEN (data_praca + INTERVAL '30 year')::date
                             WHEN sexo = 'F' THEN (data_praca + INTERVAL '25 year')::date END
                    WHEN data_praca >= DATE '2022-01-01' THEN (data_praca + INTERVAL '35 year')::date END,
               CASE categoria WHEN 'oficial' THEN (nascimento_estimado + INTERVAL '67 year')::date
                              WHEN 'praca'   THEN (nascimento_estimado + INTERVAL '65 year')::date END
           ) AS data_saida
    FROM base
)
SELECT extract(year FROM data_saida)::int AS ano, categoria, count(*)::int AS total
FROM previsao
WHERE data_saida IS NOT NULL
  AND data_saida >= current_date
  AND data_saida < current_date + INTERVAL '15 year'
  AND categoria IN ('oficial', 'praca')
GROUP BY 1, 2;

GRANT SELECT ON marts.previsto_quadro_posto, marts.painel_saida_ano, marts.painel_saida_previsao
    TO app_reader, bi_reader;
ALTER VIEW marts.previsto_quadro_posto OWNER TO etl_writer;
ALTER VIEW marts.painel_saida_ano      OWNER TO etl_writer;
ALTER VIEW marts.painel_saida_previsao OWNER TO etl_writer;
