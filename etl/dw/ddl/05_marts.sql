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
JOIN core.dim_viatura v ON v.sk_viatura = l.sk_viatura
JOIN core.dim_tempo t ON t.sk_tempo = l.sk_tempo
LEFT JOIN core.dim_ome o ON o.sk_ome = l.sk_ome;

-- Resumo por viatura: quantos dias rodou, primeira e ultima vez.
CREATE OR REPLACE VIEW marts.emprego_viatura_resumo AS
SELECT
    v.sk_viatura,
    v.placa,
    v.tipo_acronym,
    v.numero_ordem,
    v.situacao,
    o.sigla                       AS sigla_ome,
    count(DISTINCT t.data)        AS dias_empregada,
    count(*)                      AS lancamentos,
    min(t.data)                   AS primeiro_emprego,
    max(t.data)                   AS ultimo_emprego,
    current_date - max(t.data)    AS dias_desde_ultimo_emprego
FROM core.dim_viatura v
LEFT JOIN core.fato_lancamento_viatura l ON l.sk_viatura = v.sk_viatura
LEFT JOIN core.dim_tempo t ON t.sk_tempo = l.sk_tempo
LEFT JOIN core.dim_ome o ON o.sk_ome = v.sk_ome
GROUP BY v.sk_viatura, v.placa, v.tipo_acronym, v.numero_ordem, v.situacao, o.sigla;

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
WHERE v.situacao <> 'Descarregada' OR v.situacao IS NULL
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
