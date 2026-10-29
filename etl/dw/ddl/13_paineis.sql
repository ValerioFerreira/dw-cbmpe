-- Paineis corporativos no DW (2026-09-29): DF, Vacinacao (DAS) e Ocorrencias
-- (ROE). Cada view devolve as MESMAS linhas que os extratores do app
-- (etl/financas/extract_dashboard_df.py, etl/das/extract_dashboard_vacinacoes.py,
-- etl/ocorrencias/extract_dashboard_ocorrencias.py) gravavam em
-- src/data/real/*.json, com as mesmas regras de limpeza -- o backend
-- (/dados/painel/*) monta o mesmo JSON e o front nao muda de conta.

-- ---------------------------------------------------------------------------
-- De-para de OME dos paineis (antes: etl/das e etl/ocorrencias/
-- mapeamento_unidades.json, onde estao as justificativas de cada linha).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stg.de_para_ome_painel (
    sistema  text NOT NULL,          -- vacina / roe
    chave    text NOT NULL,          -- OME ja limpa (ver funcoes abaixo)
    sigla    text NOT NULL,          -- sigla usada pelo painel
    PRIMARY KEY (sistema, chave)
);
INSERT INTO stg.de_para_ome_painel (sistema, chave, sigla) VALUES
    ('vacina', 'CG', 'GCG'),
    ('vacina', 'SCG', 'GSG'),
    ('vacina', 'DINTER / 1', 'DINTER I'),
    ('vacina', 'DINTER / 2', 'DINTER II'),
    ('vacina', 'CAT / AGRESTE', 'CAT/AG'),
    ('vacina', 'CAT / SERTÃO', 'CAT/SE'),
    ('vacina', 'ADIDOS / DGP', 'ADIDO'),
    ('roe', 'DINTER/1', 'DINTER I'),
    ('roe', 'DINTER/2', 'DINTER II')
ON CONFLICT (sistema, chave) DO UPDATE SET sigla = EXCLUDED.sigla;

-- normalizar_ome() de extract_dashboard_vacinacoes.py
-- SECURITY DEFINER: leem stg.de_para_ome_painel, e sao chamadas de dentro de
-- views de marts lidas por app_reader, que nao tem acesso a stg. search_path
-- fixo, como manda a boa pratica para SECURITY DEFINER.
CREATE OR REPLACE FUNCTION stg.ome_vacina(bruto text)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, stg AS $$
    WITH a AS (
        SELECT CASE
                 WHEN replace(trim(bruto), '°', 'º') IN ('DIRETORIA DE GESTÃO DE PESSOAL.', 'DGP.', 'CPPA') THEN 'DGP'
                 ELSE replace(trim(bruto), '°', 'º')
               END AS v
    )
    SELECT coalesce((SELECT sigla FROM stg.de_para_ome_painel WHERE sistema = 'vacina' AND chave = a.v), a.v)
    FROM a
$$;

-- normalizar_ome() de extract_dashboard_ocorrencias.py
CREATE OR REPLACE FUNCTION stg.ome_roe(bruto text)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, stg AS $$
    WITH a AS (SELECT upper(replace(trim(bruto), '°', 'º')) AS v)
    SELECT CASE
             WHEN bruto IS NULL OR trim(bruto) = '' THEN nullif(bruto, '')
             WHEN a.v IN ('ADIDOS', 'ADIDOS / DGP', 'ADIDO') THEN 'ADIDO'
             ELSE coalesce((SELECT sigla FROM stg.de_para_ome_painel WHERE sistema = 'roe' AND chave = a.v), a.v)
           END
    FROM a
$$;

-- normalizar_posto() de extract_dashboard_vacinacoes.py ("7ºGB" -> "7º GB",
-- "4GB" -> "4º GB").
CREATE OR REPLACE FUNCTION stg.posto_vacina(bruto text)
RETURNS text
LANGUAGE sql IMMUTABLE AS $$
    SELECT regexp_replace(
             regexp_replace(upper(replace(trim(bruto), '°', 'º')), '^(\d+)GB$', '\1º GB'),
             '^(\d+º)GB$', '\1 GB')
    WHERE nullif(trim(bruto), '') IS NOT NULL
$$;

-- ---------------------------------------------------------------------------
-- Vacinacao (DAS). Replica a view vw_vaccinations_dashboard da origem sobre
-- raw_vacina, sem CPF (que nem chega ao DW) e sem o nome do vacinado.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW marts.painel_vacinacao_evento AS
SELECT to_char(v.date, 'YYYY-MM-DD')                         AS data,
       stg.posto_vacina(v.post)                              AS posto,
       nullif(trim(c.name), '')                              AS campanha,
       nullif(trim(vac.name), '')                            AS vacina,
       CASE WHEN upper(trim(vb.name)) = 'FUNDAÇÃO OSVALDO CRUZ' THEN 'FIOCRUZ'
            ELSE nullif(trim(vb.name), '') END               AS marca,
       stg.ome_vacina(o.acronym)                             AS ome,
       nullif(trim(a.name), '')                              AS aplicador   -- quem vacinou, em capacidade profissional
FROM raw_vacina.vaccinations v
JOIN raw_vacina.campaigns c     ON c.id = v.campaign_id
JOIN raw_vacina.militaries m    ON m.id = v.recipient_id
LEFT JOIN raw_vacina.omes o     ON o.id = m.ome_id
JOIN raw_vacina.vaccines vac    ON vac.id = v.vaccine_id
LEFT JOIN raw_vacina.vaccine_brands vb ON vb.id = v.vaccine_brand_id
LEFT JOIN raw_vacina.applicators a     ON a.id = v.applicator_id;

-- (vacina, OME ATUAL) -> militares distintos que estao nessa OME hoje e ja
-- tomaram a vacina. OME atual vem do efetivo do DW; Comando/Subcomando Geral
-- somam no gabinete (GCG/GSG), mesma regra do extrator e do front.
CREATE OR REPLACE VIEW marts.painel_vacinacao_participacao AS
SELECT nullif(trim(vac.name), '')                                            AS vacina,
       CASE e.sigla WHEN 'COMANDO GERAL' THEN 'GCG'
                    WHEN 'SUBCOMANDO GERAL' THEN 'GSG' ELSE e.sigla END      AS ome,
       count(DISTINCT e.matricula_normalizada)                               AS militares
FROM raw_vacina.vaccinations v
JOIN raw_vacina.militaries m ON m.id = v.recipient_id
JOIN raw_vacina.vaccines vac ON vac.id = v.vaccine_id
JOIN marts.efetivo_nominal e ON e.matricula_normalizada = replace(trim(m.registration), '-', '')
GROUP BY 1, 2;

-- ---------------------------------------------------------------------------
-- Ocorrencias (ROE) -- mesmas colunas das consultas de extract_dashboard_ocorrencias.py
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW marts.painel_roe_ocorrencia AS
SELECT to_char(data_recebimento, 'YYYY-MM-DD"T"HH24:MI:SS') AS data,
       nullif(trim(natureza), '')             AS natureza,
       stg.ome_roe(diretoria)                 AS diretoria,
       stg.ome_roe(ome)                       AS ome,
       nullif(trim(cidade), '')               AS cidade,
       nullif(trim(grupo), '')                AS grupo,
       nullif(trim(subgrupo), '')             AS subgrupo,
       nullif(trim(motivo_naoatendimento), '') AS motivo_nao_atendimento,
       status_relatorio,
       ocorrencia_atendida,
       (protocolo IS NOT NULL AND protocolo::text <> '') AS protocolo_presente,
       coalesce(qtde_vitimas_feridas, 0)      AS vitimas_feridas,
       coalesce(qtde_vitimas_fatais, 0)       AS vitimas_fatais,
       coalesce(qtde_vitimas_ilesas, 0)       AS vitimas_ilesas,
       coalesce(qtde_vitimas_desaparecidas, 0) AS vitimas_desaparecidas,
       stg.normalizar_sigla(stg.ome_roe(ome)) AS ome_norm,
       stg.normalizar_sigla(stg.ome_roe(diretoria)) AS diretoria_norm,
       -- 2026-10-29: mapa da aba Geolocalizacao e tabela de detalhamento. Mesmo
       -- cuidado do painel CVI (ddl/24): bairro sim, rua e numero nao; coordenada
       -- arredondada a 3 casas (~100 m). Colunas no fim: CREATE OR REPLACE VIEW so
       -- aceita coluna nova depois das existentes.
       roe_id,
       nullif(initcap(trim(logradouro_bairro)), '') AS bairro,
       round(logradouro_latitude::numeric, 3)  AS lat,
       round(logradouro_longitude::numeric, 3) AS lng
FROM raw_roe.roe_basico_ocorrencias;

CREATE OR REPLACE VIEW marts.painel_roe_aph AS
SELECT stg.ome_roe(b.ome) AS ome, stg.ome_roe(b.diretoria) AS diretoria,
       nullif(trim(a.genero), '') AS genero, a.idade, a.idade_em_meses, a.cvi, a.entregue_vivo,
       nullif(trim(a.status_deficiencia), '') AS deficiencia,
       stg.normalizar_sigla(stg.ome_roe(b.ome)) AS ome_norm,
       stg.normalizar_sigla(stg.ome_roe(b.diretoria)) AS diretoria_norm
FROM raw_roe.roe_basico_ocorrencias b
JOIN raw_roe.roe_aph_ocorrencias a ON a.roe_basico_id = b.roe_id
WHERE b.natureza = 'Atendimento Pré-Hospitalar' AND b.status_relatorio = 'Finalizado';

CREATE OR REPLACE VIEW marts.painel_roe_incendio AS
SELECT to_char(b.data_recebimento, 'YYYY-MM-DD"T"HH24:MI:SS') AS data,
       stg.ome_roe(b.ome) AS ome, stg.ome_roe(b.diretoria) AS diretoria, nullif(trim(b.cidade), '') AS cidade,
       i.duracao_combate_horas, i.duracao_rescaldo_horas, i.duracao_total_horas,
       stg.normalizar_sigla(stg.ome_roe(b.ome)) AS ome_norm,
       stg.normalizar_sigla(stg.ome_roe(b.diretoria)) AS diretoria_norm
FROM raw_roe.roe_incendio_ocorrencias i
JOIN raw_roe.roe_basico_ocorrencias b ON b.roe_id = i.roe_basico_id;

CREATE OR REPLACE VIEW marts.painel_roe_salvamento AS
SELECT to_char(b.data_recebimento, 'YYYY-MM-DD"T"HH24:MI:SS') AS data,
       stg.ome_roe(b.ome) AS ome, stg.ome_roe(b.diretoria) AS diretoria, nullif(trim(b.cidade), '') AS cidade,
       nullif(trim(s.tipo_predominante), '') AS tipo_predominante,
       stg.normalizar_sigla(stg.ome_roe(b.ome)) AS ome_norm,
       stg.normalizar_sigla(stg.ome_roe(b.diretoria)) AS diretoria_norm
FROM raw_roe.roe_salvamento_ocorrencias s
JOIN raw_roe.roe_basico_ocorrencias b ON b.roe_id = s.roe_basico_id;

CREATE OR REPLACE VIEW marts.painel_roe_prevencao AS
SELECT to_char(data_recebimento, 'YYYY-MM-DD"T"HH24:MI:SS') AS data,
       stg.ome_roe(ome) AS ome, stg.ome_roe(diretoria) AS diretoria, nullif(trim(cidade), '') AS cidade,
       duracao_evento_horas, publico_estimado, publico_presente,
       nullif(trim(situacao_avcb), '') AS situacao_avcb, area_estimada, evento_regularizado,
       stg.normalizar_sigla(stg.ome_roe(ome)) AS ome_norm,
       stg.normalizar_sigla(stg.ome_roe(diretoria)) AS diretoria_norm
FROM raw_roe.roe_prevencao_ocorrencias;

CREATE OR REPLACE VIEW marts.painel_roe_produtos_perigosos AS
SELECT to_char(b.data_recebimento, 'YYYY-MM-DD"T"HH24:MI:SS') AS data,
       stg.ome_roe(b.ome) AS ome, stg.ome_roe(b.diretoria) AS diretoria, nullif(trim(b.cidade), '') AS cidade,
       nullif(trim(p.nome_produto), '') AS nome_produto, nullif(trim(p.classe_risco), '') AS classe_risco,
       nullif(trim(p.perfil_botijao_glp), '') AS perfil_botijao_glp,
       stg.normalizar_sigla(stg.ome_roe(b.ome)) AS ome_norm,
       stg.normalizar_sigla(stg.ome_roe(b.diretoria)) AS diretoria_norm
FROM raw_roe.roe_prod_perigosos_ocorrencias p
JOIN raw_roe.roe_basico_ocorrencias b ON b.roe_id = p.roe_basico_id;

CREATE OR REPLACE VIEW marts.painel_roe_diagnostico_pp AS
SELECT count(*) FILTER (WHERE b.roe_id IS NULL)                                 AS sem_match_na_basico,
       count(*) FILTER (WHERE b.roe_id IS NOT NULL AND b.data_recebimento IS NULL) AS match_mas_data_nula,
       count(*) FILTER (WHERE b.data_recebimento IS NOT NULL)                   AS com_data
FROM raw_roe.roe_prod_perigosos_ocorrencias p
LEFT JOIN raw_roe.roe_basico_ocorrencias b ON p.roe_basico_id = b.roe_id;

-- ---------------------------------------------------------------------------
-- DF (Diretoria de Financas) -- as cinco visualizacoes de extract_dashboard_df.py
-- ---------------------------------------------------------------------------
ALTER TABLE core.fato_financeiro ADD COLUMN IF NOT EXISTS ficha_financ text;

CREATE OR REPLACE VIEW marts.painel_df_sfi_ordinario AS
SELECT sigla_organograma AS unidade,
       CASE WHEN upper(trim(natureza)) = 'CONSUMO' THEN 'Consumo' ELSE 'Serviço' END AS natureza,
       CASE upper(trim(mes))
            WHEN 'JANEIRO' THEN 'janeiro' WHEN 'FEVEREIRO' THEN 'fevereiro' WHEN 'MARÇO' THEN 'março'
            WHEN 'ABRIL' THEN 'abril' WHEN 'MAIO' THEN 'maio' WHEN 'JUNHO' THEN 'junho'
            WHEN 'JULHO' THEN 'julho' WHEN 'AGOSTO' THEN 'agosto' WHEN 'SETEMBRO' THEN 'setembro'
            ELSE lower(trim(mes)) END AS mes,
       round(sum(valor_liquidado), 2) AS valor
FROM stg.financas_destino
WHERE bloco = 'sfi_ordinario' AND situacao = 'EMPENHADO' AND sigla_organograma IS NOT NULL
GROUP BY 1, 2, 3;

CREATE OR REPLACE VIEW marts.painel_df_sfi_extra AS
SELECT sigla_organograma AS unidade, round(sum(valor), 2) AS valor
FROM stg.financas_destino
WHERE bloco = 'autorizacao' AND enquadramento = 'SFI' AND situacao = 'EMPENHADO'
  AND sigla_organograma IS NOT NULL
GROUP BY 1;

CREATE OR REPLACE VIEW marts.painel_df_suprimento_individual AS
SELECT sigla_organograma AS unidade, round(sum(valor), 2) AS valor
FROM stg.financas_destino
WHERE bloco = 'autorizacao' AND enquadramento = 'SI' AND situacao = 'EMPENHADO'
  AND sigla_organograma IS NOT NULL
GROUP BY 1;

-- Sem unidade: diarias e auxilio funeral nao sao gasto de uma unidade.
CREATE OR REPLACE VIEW marts.painel_df_diarias AS
SELECT coalesce(nullif(trim(ficha_financ), ''), '—') AS operacao, round(sum(valor), 2) AS valor
FROM core.fato_financeiro
WHERE bloco = 'autorizacao' AND enquadramento = 'DIÁRIAS' AND situacao = 'EMPENHADO'
GROUP BY 1;

CREATE OR REPLACE VIEW marts.painel_df_funeral AS
SELECT upper(trim(mes)) AS mes, round(sum(valor), 2) AS valor,
       coalesce(array_position(ARRAY['JAN','FEV','MAR','ABR','MAIO','JUN','JUL','AGO','SET','OUT','NOV','DEZ'],
                               upper(trim(mes))), 99) AS ordem
FROM core.fato_financeiro
WHERE bloco = 'autorizacao' AND enquadramento = 'FUNERAL' AND situacao = 'EMPENHADO'
GROUP BY 1;

-- Paineis sao lidos so pelo backend. aphEstatistica traz perfil de vitima
-- (genero/idade) linha a linha: nada disso vai para o BI.
REVOKE ALL ON marts.painel_vacinacao_evento, marts.painel_vacinacao_participacao,
              marts.painel_roe_ocorrencia, marts.painel_roe_aph, marts.painel_roe_incendio,
              marts.painel_roe_salvamento, marts.painel_roe_prevencao,
              marts.painel_roe_produtos_perigosos, marts.painel_roe_diagnostico_pp
    FROM bi_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA marts TO app_reader;
