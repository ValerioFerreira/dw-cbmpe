-- Titular de cada unidade do organograma, do Peculio.
--
-- POR QUE UMA TABELA E NAO A VIEW stg.peculio: a carga (carga_core.py) faz
-- DROP VIEW stg.peculio a cada rodada, porque o formato dela muda quando a
-- planilha ganha coluna -- e o DROP falha se alguma view de marts depender
-- dela ("DependentObjectsStillExist", flow dw_diario de 2026-10-06). Entao a
-- carga grava aqui, em stg.peculio_titular, o resultado ja resolvido (OME do
-- DW -> matricula do mais antigo, pela ordem do Peculio), e marts nao enxerga
-- mais stg.peculio.
CREATE TABLE IF NOT EXISTS stg.peculio_titular (
    sk_ome     integer PRIMARY KEY,   -- sem FK: a carga recarrega core.dim_ome
    matricula  text    NOT NULL,
    ordem      integer           -- posicao do titular na planilha do Peculio
);
ALTER TABLE stg.peculio_titular OWNER TO etl_writer;

-- Primeira populacao (instalacao existente): a carga seguinte refaz.
DO $$
BEGIN
    IF to_regclass('stg.peculio') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM stg.peculio_titular) THEN
        INSERT INTO stg.peculio_titular (sk_ome, matricula, ordem)
        SELECT DISTINCT ON (dp.sk_ome) dp.sk_ome, p.matricula, p.ordem::int
        FROM stg.peculio p
        JOIN stg.de_para_ome dp ON dp.sistema = 'peculio' AND dp.valor_origem = p.ome
        WHERE p.matricula IS NOT NULL AND p.matricula <> ''
        ORDER BY dp.sk_ome, p.ordem;
    END IF;
END $$;

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
    SELECT sk_ome, matricula FROM stg.peculio_titular
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

GRANT SELECT ON marts.chefe_organograma TO app_reader, bi_reader;
ALTER VIEW marts.chefe_organograma OWNER TO etl_writer;
