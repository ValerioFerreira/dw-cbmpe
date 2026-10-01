-- QOD (Quadro de Organizacao e Distribuicao) no DW -- 2026-09-29.
--
-- Fonte: a planilha publicada pela DPlaG (raw_qod, carregada por
-- etl/windmill/dw/raw_planilhas.py). Tres abas interessam:
--   FUNCOES_DPLAG    uma linha por VAGA, com o tipo (FUNCIONAL / ENCARGO)
--                    -> efetivo previsto por OME
--   QOD_FUNCOES      catalogo de funcoes, com ordem de exibicao
--   QOD_CONSOLIDADA  quem ocupa cada funcao (CODIGO -> QOD_FUNCOES.ID_FUNCAO)
--                    -> lotacao por funcao e chefe de cada unidade
-- As tabelas core abaixo sao preenchidas por carga_core.py (carregar_qod).
--
-- Decisoes do usuario (2026-09-29): previsto = vagas FUNCIONAL da
-- FUNCOES_DPLAG (substitui a aba "GERAL 001" de um xlsx local de agosto);
-- chefe = ocupante da funcao de menor ordem de exibicao; Comando Geral e
-- Subcomando Geral mostram o Comandante/Subcomandante Geral (lancados no GCG
-- e no GSG), e GCG/GSG mostram a 2a funcao (chefe de gabinete); funcao sem
-- ocupante aparece como "Vago".

CREATE TABLE IF NOT EXISTS core.qod_vaga (
    linha        integer PRIMARY KEY,     -- linha da planilha
    ome_qod      text,
    cod_funcao   text,
    funcao       text,
    tipo_vaga    text                     -- FUNCIONAL / ENCARGO
);

CREATE TABLE IF NOT EXISTS core.qod_funcao (
    id_funcao        text PRIMARY KEY,
    tipo_funcao      text,                -- FUNCAO / ENCARGO
    ome_qod          text,
    secao            text,
    funcao           text,
    funcao_completa  text,
    ordem_exibicao   numeric,
    ativo            boolean,
    mes_referencia   text
);

-- O nome exibido vem de core.dim_militar pela matricula; nome_qod so e
-- usado quando a matricula nao esta no efetivo do Peculio (ex.: o
-- Subcomandante Geral em 2026-09-29).
CREATE TABLE IF NOT EXISTS core.qod_ocupacao (
    linha            integer PRIMARY KEY,
    matricula        text,                -- so digitos
    nome_qod         text,
    unidade_qod      text,
    posto_grad       text,
    id_funcao        text,                -- -> core.qod_funcao
    tipo             text,
    funcao_de        text,
    antiguidade      numeric
);
ALTER TABLE core.qod_ocupacao ADD COLUMN IF NOT EXISTS nome_qod text;
-- Campos da ficha do militar (lotacao por funcao), 2026-09-29.
ALTER TABLE core.qod_ocupacao ADD COLUMN IF NOT EXISTS cursos   text;
ALTER TABLE core.qod_ocupacao ADD COLUMN IF NOT EXISTS portaria text;
ALTER TABLE core.qod_ocupacao ADD COLUMN IF NOT EXISTS bge      text;
ALTER TABLE core.qod_funcao   ADD COLUMN IF NOT EXISTS ome_completa text;
ALTER TABLE core.qod_funcao   ADD COLUMN IF NOT EXISTS localidade   text;
CREATE INDEX IF NOT EXISTS ix_qod_ocupacao_funcao ON core.qod_ocupacao (id_funcao);
CREATE INDEX IF NOT EXISTS ix_qod_ocupacao_matricula ON core.qod_ocupacao (matricula);

-- OME do QOD -> sigla do organograma, onde a normalizacao nao basta.
CREATE TABLE IF NOT EXISTS stg.de_para_ome_qod (
    chave       text PRIMARY KEY,           -- stg.normalizar_sigla(ome do QOD)
    sigla       text NOT NULL,              -- sigla do organograma
    observacao  text
);
INSERT INTO stg.de_para_ome_qod (chave, sigla, observacao) VALUES
    ('DINTER1', 'DINTER I',  'grafia'),
    ('DINTER2', 'DINTER II', 'grafia'),
    ('CATSER',  'CAT/SE',    'grafia'),
    ('CPPA',    'DGP',       'CPPA soma na DGP (mesma regra de efetivo, viaturas e financas)')
ON CONFLICT (chave) DO UPDATE SET sigla = EXCLUDED.sigla, observacao = EXCLUDED.observacao;

CREATE OR REPLACE VIEW stg.qod_ome_organograma AS
SELECT DISTINCT q.ome_qod,
       coalesce(dp.sigla, o.valor_origem) AS sigla
FROM (SELECT ome_qod FROM core.qod_vaga UNION SELECT ome_qod FROM core.qod_funcao) q
LEFT JOIN stg.de_para_ome_qod dp ON dp.chave = stg.normalizar_sigla(q.ome_qod)
LEFT JOIN stg.de_para_ome o
       ON o.sistema = 'organograma'
      AND stg.normalizar_sigla(o.valor_origem) = stg.normalizar_sigla(q.ome_qod)
WHERE coalesce(dp.sigla, o.valor_origem) IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Efetivo previsto proprio por sigla do organograma.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW marts.previsto_organograma AS
SELECT m.sigla, count(*) AS previsto
FROM core.qod_vaga v
JOIN stg.qod_ome_organograma m ON m.ome_qod = v.ome_qod
WHERE v.tipo_vaga = 'FUNCIONAL'
GROUP BY m.sigla;

-- ---------------------------------------------------------------------------
-- Chefe de cada unidade do organograma.
-- ---------------------------------------------------------------------------
-- posto_curto: como o app ja exibe ("TC Carneiro", "Maj Cibely").
CREATE OR REPLACE FUNCTION stg.posto_curto(posto text)
RETURNS text
LANGUAGE sql IMMUTABLE AS $$
    SELECT nullif(trim(regexp_replace(replace(coalesce(posto, ''), 'Ten Cel', 'TC'),
                                      '\s*(QO[A-Z]+|Promo\. Req\.)', '', 'g')), '')
$$;

-- cargo_curto: "Comandante do 1o GB" -> "Comandante"; "Diretor de Financas"
-- -> "Diretor"; "Comandante Geral" fica inteiro.
CREATE OR REPLACE FUNCTION stg.cargo_curto(funcao text)
RETURNS text
LANGUAGE sql IMMUTABLE AS $$
    SELECT trim(split_part(regexp_replace(coalesce(funcao, ''),
                                          '\s+(do|da|de|dos|das)\s+', '|', 'i'), '|', 1))
$$;

-- Titular de cada unidade: a FONTE DA VERDADE E O PECULIO (decisao do usuario,
-- 2026-10-01), tanto para a matricula quanto para quem e o titular -- o militar
-- mais antigo da OME, pela ordem em que aparece na planilha (stg.peculio.ordem,
-- que ja e a precedencia). A regra bate com a marca "Titular" da coluna OBS em
-- 45 de 45 OMEs. O QOD so empresta o NOME DA FUNCAO ("Comandante do 1o GB").
-- Unidade sem OME no Peculio sai como vaga, sem pessoa: hoje so a DGA (o
-- organograma mostra "Em construcao"); a CPP repete o titular da CPO.
CREATE OR REPLACE VIEW marts.chefe_organograma AS
WITH funcoes AS (
    SELECT f.*, m.sigla,
           row_number() OVER (PARTITION BY m.sigla ORDER BY f.ordem_exibicao, f.id_funcao) AS ordem
    FROM core.qod_funcao f
    JOIN stg.qod_ome_organograma m ON m.ome_qod = f.ome_qod
    WHERE f.ativo AND f.tipo_funcao ILIKE 'FUN%'
),
-- Qual funcao do QOD da nome ao cargo: a 1a da propria OME, salvo as duas
-- unidades de gabinete (a chefia e a 2a funcao).
alvo AS (
    SELECT DISTINCT d.valor_origem AS sigla, d.sk_ome,
           CASE d.valor_origem
                WHEN 'COMANDO GERAL'    THEN 'GCG'
                WHEN 'SUBCOMANDO GERAL' THEN 'GSG'
                ELSE d.valor_origem END  AS sigla_funcao,
           CASE d.valor_origem
                WHEN 'GCG' THEN 2
                WHEN 'GSG' THEN 2
                ELSE 1 END               AS ordem
    FROM stg.de_para_ome d
    WHERE d.sistema = 'organograma'
),
titular AS (
    SELECT DISTINCT ON (dp.sk_ome) dp.sk_ome, p.matricula
    FROM stg.peculio p
    JOIN stg.de_para_ome dp ON dp.sistema = 'peculio' AND dp.valor_origem = p.ome
    ORDER BY dp.sk_ome, p.ordem
)
SELECT a.sigla,
       f.funcao                                        AS funcao,
       stg.cargo_curto(f.funcao)                       AS cargo,
       t.matricula,
       stg.posto_curto(pg.sigla)                       AS posto,
       coalesce(dm.nome_guerra, dm.nome)               AS nome_guerra,
       (t.matricula IS NULL)                           AS vago
FROM alvo a
LEFT JOIN funcoes f ON f.sigla = a.sigla_funcao AND f.ordem = a.ordem
-- CPP (Comissao de Promocoes de Praças) nao tem OME no Peculio; a
-- presidencia e a mesma da CPO (decisao do usuario, 2026-10-01: Maj FRANÇA).
LEFT JOIN titular t ON t.sk_ome = CASE WHEN a.sigla = 'CPP'
                                       THEN (SELECT sk_ome FROM alvo WHERE sigla = 'CPO')
                                       ELSE a.sk_ome END
LEFT JOIN core.dim_militar dm ON dm.matricula = t.matricula
LEFT JOIN core.dim_posto_grad pg ON pg.sk_posto_grad = dm.sk_posto_grad;

GRANT SELECT ON ALL TABLES IN SCHEMA marts TO app_reader, bi_reader;
