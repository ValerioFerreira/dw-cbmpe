-- Camada de consumo. E o unico schema que o app e as ferramentas de BI
-- enxergam -- o core tem dado sensivel e fica restrito.

-- ---------------------------------------------------------------------------
-- Efetivo por OME, com rollup pela hierarquia
-- ---------------------------------------------------------------------------
-- O JOIN com dim_ome_ancestral e o que faz a CPPA aparecer no proprio filtro
-- E somada na DGP, e o adido aparecer em ADIDOS E no Comando Geral, sem
-- duplicidade e sem regra especial em lugar nenhum: cada militar tem uma
-- linha de fato so, e a hierarquia distribui.
--
-- efetivo_proprio  = so quem esta lotado nesta OME
-- efetivo_total    = a OME mais tudo que pende dela
CREATE OR REPLACE VIEW marts.efetivo_por_ome AS
SELECT
    o.sk_ome,
    o.sigla,
    o.nome,
    o.tipo,
    o.tipo_registro,
    o.municipio,
    o.latitude,
    o.longitude,
    t.data                                                     AS data_referencia,
    count(*) FILTER (WHERE a.distancia = 0)                    AS efetivo_proprio,
    count(*)                                                   AS efetivo_total,
    count(*) FILTER (WHERE f.adido)                            AS adidos,
    count(*) FILTER (WHERE f.afastado)                         AS afastados
FROM core.dim_ome o
JOIN core.dim_ome_ancestral a ON a.sk_ome_ancestral = o.sk_ome
JOIN core.fato_efetivo_diario f ON f.sk_ome = a.sk_ome_descendente
JOIN core.dim_tempo t ON t.sk_tempo = f.sk_tempo
JOIN core.dim_ome od ON od.sk_ome = f.sk_ome AND od.conta_efetivo
GROUP BY o.sk_ome, o.sigla, o.nome, o.tipo, o.tipo_registro,
         o.municipio, o.latitude, o.longitude, t.data;

-- ---------------------------------------------------------------------------
-- Onde estao os adidos
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW marts.adidos_por_orgao AS
SELECT
    coalesce(oe.nome, '(orgao nao informado)') AS orgao,
    t.data                                     AS data_referencia,
    count(*)                                   AS militares
FROM core.fato_efetivo_diario f
JOIN core.dim_tempo t ON t.sk_tempo = f.sk_tempo
LEFT JOIN core.dim_orgao_externo oe ON oe.sk_orgao_externo = f.sk_orgao_externo
WHERE f.adido
GROUP BY 1, 2;

-- ---------------------------------------------------------------------------
-- Emprego operacional de viatura -- "em que dias esta viatura rodou"
-- ---------------------------------------------------------------------------
-- Responde a pergunta que motivou a reconciliacao Frota x mapa de forca:
-- clicar numa viatura e ver os dias em que ela foi empregada. Historico
-- desde novembro de 2019.
CREATE OR REPLACE VIEW marts.emprego_viatura_dia AS
SELECT DISTINCT
    v.sk_viatura,
    v.placa,
    v.tipo_acronym,
    v.numero_ordem,
    t.data,
    l.sk_ome,
    o.sigla AS sigla_ome
FROM core.fato_lancamento_viatura l
-- sk_viatura aponta para a VERSAO vigente no dia do lancamento (SCD2), entao
-- placa/tipo/numero aqui sao os daquele dia, nao os de hoje.
JOIN core.dim_viatura v ON v.sk_viatura = l.sk_viatura
JOIN core.dim_tempo t ON t.sk_tempo = l.sk_tempo
LEFT JOIN core.dim_ome o ON o.sk_ome = l.sk_ome;

-- Resumo por viatura: quantos dias rodou, primeira e ultima vez.
--
-- Agrupa por id_frota, NAO por sk_viatura: desde que a dim_viatura virou SCD2
-- a mesma viatura tem varias linhas (uma por versao), e agrupar pela chave da
-- versao partiria o historico de cada viatura em pedacos. Situacao e OME vem
-- da versao atual, que e o que a pergunta "onde esta essa viatura hoje"
-- espera. Os lancamentos, esses somam a vida inteira.
-- DROP antes do CREATE: a view ganhou a coluna id_frota no meio da lista,
-- e CREATE OR REPLACE nao aceita mudanca de posicao/nome de coluna.
DROP VIEW IF EXISTS marts.emprego_viatura_resumo;
CREATE VIEW marts.emprego_viatura_resumo AS
SELECT
    atual.sk_viatura,
    atual.id_frota,
    atual.placa,
    atual.tipo_acronym,
    atual.numero_ordem,
    atual.situacao,
    o.sigla                       AS sigla_ome,
    count(DISTINCT t.data)        AS dias_empregada,
    count(l.*)                    AS lancamentos,
    min(t.data)                   AS primeiro_emprego,
    max(t.data)                   AS ultimo_emprego,
    current_date - max(t.data)    AS dias_desde_ultimo_emprego
FROM core.dim_viatura atual
LEFT JOIN core.dim_viatura v ON v.id_frota = atual.id_frota
LEFT JOIN core.fato_lancamento_viatura l ON l.sk_viatura = v.sk_viatura
LEFT JOIN core.dim_tempo t ON t.sk_tempo = l.sk_tempo
LEFT JOIN core.dim_ome o ON o.sk_ome = atual.sk_ome
WHERE atual.versao_atual
GROUP BY atual.sk_viatura, atual.id_frota, atual.placa, atual.tipo_acronym,
         atual.numero_ordem, atual.situacao, o.sigla;

-- ---------------------------------------------------------------------------
-- Emprego operacional de militar
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW marts.emprego_militar_resumo AS
SELECT
    m.sk_militar,
    m.matricula_exibida,
    m.nome_guerra,
    count(DISTINCT t.data)     AS dias_escalado,
    count(*)                   AS lancamentos,
    min(t.data)                AS primeira_escala,
    max(t.data)                AS ultima_escala
FROM core.dim_militar m
JOIN core.fato_lancamento_militar l ON l.sk_militar = m.sk_militar
JOIN core.dim_tempo t ON t.sk_tempo = l.sk_tempo
GROUP BY m.sk_militar, m.matricula_exibida, m.nome_guerra;

-- ---------------------------------------------------------------------------
-- Frota por OME (com a regra de situacao que o app ja usa)
-- ---------------------------------------------------------------------------
-- "Devolvida" conta como Ativa e "Descarregada" nao conta -- mesma regra
-- aplicada hoje na tabela de Viaturas do app, mantida aqui para os numeros
-- baterem entre o DW e o que os gestores ja viram.
CREATE OR REPLACE VIEW marts.frota_por_ome AS
SELECT
    o.sk_ome,
    o.sigla,
    count(*)                                                          AS viaturas,
    count(*) FILTER (WHERE v.situacao IN ('Ativa', 'Devolvida'))      AS ativas,
    count(*) FILTER (WHERE v.situacao = 'Manutenção')                 AS em_manutencao,
    count(*) FILTER (WHERE v.rastreado)                               AS rastreadas
FROM core.dim_viatura v
JOIN core.dim_ome o ON o.sk_ome = v.sk_ome
-- versao_atual e obrigatorio desde o SCD2: sem ele a mesma viatura seria
-- contada uma vez por versao (177 viaturas tem mais de uma).
WHERE v.versao_atual
  AND (v.situacao <> 'Descarregada' OR v.situacao IS NULL)
GROUP BY o.sk_ome, o.sigla;

-- ---------------------------------------------------------------------------
-- Emprego operacional por OME e mes
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW marts.emprego_operacional_mes AS
SELECT
    o.sk_ome,
    o.sigla,
    t.ano_mes,
    count(DISTINCT l.id_lancamento)   AS lancamentos,
    count(*)                          AS militares_escalados,
    count(DISTINCT l.sk_militar)      AS militares_distintos
FROM core.fato_lancamento_militar l
JOIN core.dim_tempo t ON t.sk_tempo = l.sk_tempo
JOIN core.dim_ome o ON o.sk_ome = l.sk_ome
GROUP BY o.sk_ome, o.sigla, t.ano_mes;

-- ---------------------------------------------------------------------------
-- Cobertura da reconciliacao -- metrica de qualidade, exposta de proposito
-- ---------------------------------------------------------------------------
-- A reconciliacao Frota x mapa de forca nao e perfeita e nao deve fingir que
-- e. Publicar a cobertura evita que alguem leia "viaturas empregadas" como
-- numero completo.
CREATE OR REPLACE VIEW marts.qualidade_reconciliacao AS
SELECT 'viatura' AS dominio, situacao, count(*) AS pares,
       sum(candidatos) AS candidatos
FROM stg.de_para_viatura GROUP BY 1, 2
UNION ALL
SELECT 'lancamento_militar',
       CASE WHEN sk_militar IS NULL THEN 'sem_casar' ELSE 'resolvido' END,
       count(*), NULL
FROM core.fato_lancamento_militar GROUP BY 1, 2
UNION ALL
SELECT 'lancamento_viatura',
       CASE WHEN sk_viatura IS NULL THEN 'sem_casar' ELSE 'resolvido' END,
       count(*), NULL
FROM core.fato_lancamento_viatura GROUP BY 1, 2;

-- ---------------------------------------------------------------------------
-- Tempo de reserva por militar -- averbacao menos afastamento
-- ---------------------------------------------------------------------------
-- No core os dois eventos vivem separados, porque sao eventos diferentes.
-- Aqui eles se encontram com sinal, que e como a pergunta e feita de fato:
-- "quanto tempo liquido este militar tem para a reserva?".
CREATE OR REPLACE VIEW marts.tempo_reserva_por_militar AS
WITH ajuste AS (
    SELECT sk_militar,  dias AS dias, 'averbacao'  AS origem FROM core.fato_averbacao
    UNION ALL
    SELECT sk_militar, -dias AS dias, 'afastamento' AS origem FROM core.fato_afastamento_reserva
)
SELECT
    m.sk_militar,
    m.matricula_exibida,
    m.nome_guerra,
    pg.sigla                                                   AS posto_grad,
    m.antiguidade,
    m.antiguidade_geral,
    coalesce(sum(a.dias) FILTER (WHERE a.origem = 'averbacao'), 0)    AS dias_averbados,
    coalesce(-sum(a.dias) FILTER (WHERE a.origem = 'afastamento'), 0) AS dias_descontados,
    coalesce(sum(a.dias), 0)                                   AS dias_liquidos,
    p.data_reserva_requerimento,
    p.data_reserva_compulsoria,
    p.abono_permanencia
FROM core.dim_militar m
LEFT JOIN core.dim_posto_grad pg ON pg.sk_posto_grad = m.sk_posto_grad
LEFT JOIN ajuste a ON a.sk_militar = m.sk_militar
LEFT JOIN core.fato_previsao_reserva p
       ON p.sk_militar = m.sk_militar
      AND p.sk_tempo = (SELECT max(sk_tempo) FROM core.fato_previsao_reserva)
GROUP BY m.sk_militar, m.matricula_exibida, m.nome_guerra, pg.sigla,
         m.antiguidade, m.antiguidade_geral, p.data_reserva_requerimento,
         p.data_reserva_compulsoria, p.abono_permanencia;

-- ---------------------------------------------------------------------------
-- Militar -- a visao de consumo, com as duracoes calculadas na hora
-- ---------------------------------------------------------------------------
-- A planilha do Peculio traz idade, tempo de servico e tempo na OBM ja
-- calculados. Nao guardamos nenhum dos tres: numero calculado envelhece, data
-- nao. Medido em 2026-08-24: a idade declarada na planilha ja divergia do
-- calculo em 126 dos 2.658 militares. Aqui a conta e refeita a cada consulta.
--
-- Sem telefone de proposito -- ver core.contato_militar.
CREATE OR REPLACE VIEW marts.militar AS
SELECT
    m.sk_militar,
    m.matricula_exibida,
    m.nome,
    m.nome_guerra,
    pg.sigla                                    AS posto_grad,
    m.antiguidade,
    m.antiguidade_geral,
    o.sigla                                     AS ome,
    m.sexo,
    m.raca_cor,
    m.data_nascimento,
    extract(year FROM age(current_date, m.data_nascimento))::int  AS idade,
    m.data_ingresso,
    extract(year FROM age(current_date, m.data_ingresso))::int    AS tempo_servico_anos,
    m.data_ultima_promocao,
    pp.principio                                AS principio_ultima_promocao,
    m.data_movimentacao_sp,
    (current_date - m.data_movimentacao_sp)     AS dias_na_ome_atual,
    m.ome_anterior,
    sp.numero_ano                               AS suplemento_pessoal,
    m.acumulo_cargos,
    m.observacao,
    f.adido,
    f.horario_especial,
    f.readaptado,
    f.pcd,
    f.le,
    f.ltip,
    ta.sigla                                    AS tipo_afastamento
FROM core.dim_militar m
LEFT JOIN core.dim_posto_grad pg          ON pg.sk_posto_grad = m.sk_posto_grad
LEFT JOIN core.dim_principio_promocao pp  ON pp.sk_principio_promocao = m.sk_principio_promocao
LEFT JOIN core.dim_suplemento_pessoal sp  ON sp.sk_suplemento = m.sk_suplemento
LEFT JOIN core.fato_efetivo_diario f
       ON f.sk_militar = m.sk_militar
      AND f.sk_tempo = (SELECT max(sk_tempo) FROM core.fato_efetivo_diario)
LEFT JOIN core.dim_ome o                  ON o.sk_ome = f.sk_ome
LEFT JOIN core.dim_tipo_afastamento ta    ON ta.sk_tipo_afastamento = f.sk_tipo_afastamento;

-- OME atual de cada militar, pela linha mais recente DAQUELE militar no
-- fato diario (nao o ultimo dia global: quem saiu do efetivo antes do
-- ultimo dia carregado tambem resolve). E o que o backend usa para
-- matricula -> OME no login e no /adm (backend/services/omeResolver.js), sem
-- precisar de acesso a core (D6). Sem nome nem dado pessoal: so a chave.
CREATE OR REPLACE VIEW marts.ome_atual_militar AS
SELECT DISTINCT ON (m.matricula)
    m.matricula,
    o.sigla     AS ome_sigla,
    o.nome      AS ome_nome,
    f.adido,
    t.data      AS data_referencia
FROM core.dim_militar m
JOIN core.fato_efetivo_diario f ON f.sk_militar = m.sk_militar
JOIN core.dim_ome o             ON o.sk_ome = f.sk_ome
JOIN core.dim_tempo t           ON t.sk_tempo = f.sk_tempo
ORDER BY m.matricula, f.sk_tempo DESC;
