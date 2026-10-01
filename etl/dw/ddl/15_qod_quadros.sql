-- Efetivo previsto pelo QOD formatado (quadros de setembro de 2026), por
-- unidade e posto/graduacao (2026-10-01).
--
-- Decisao do usuario: a distribuicao de funcoes por OME/secao vem da planilha de
-- quadros; nomenclatura e ocupantes continuam na QOD CONFERENCIA. O previsto da
-- unidade passa a ser o TOTAL do quadro, e nao mais a contagem de vagas FUNCIONAIS
-- da aba FUNCOES DPLAG (marts.previsto_organograma, mantida so para conferencia).
-- Schema novo: o etl_writer nao tem CREATE no banco, entao esta linha precisa ser
-- aplicada UMA vez por superusuario (datawarehouse-user).
CREATE SCHEMA IF NOT EXISTS raw_qod_quadros AUTHORIZATION etl_writer;

CREATE TABLE IF NOT EXISTS core.qod_quadro_unidade (
    rotulo              text PRIMARY KEY,   -- como o quadro GERAL 001 chama a unidade
    sigla_organograma   text,               -- NULL = nao casou (a carga avisa)
    cel integer, ten_cel integer,
    maj_qoc integer, cap_qoc integer, ten1_qoc integer, ten2_qoc integer,
    maj_qoa integer, cap_qoa integer, ten1_qoa integer, ten2_qoa integer,
    subten integer, sgt1 integer, sgt2 integer, sgt3 integer, cb integer, sd integer,
    total               integer NOT NULL,
    carregado_em        timestamptz NOT NULL DEFAULT now()
);

-- Previsto proprio por sigla do organograma. Comando Geral soma no GCG e
-- Subcomando Geral no GSG (as funcoes de comando ficam no gabinete), e a CPPA
-- soma na DGP, como no resto do app.
CREATE OR REPLACE VIEW marts.previsto_quadro AS
SELECT sigla_organograma AS sigla, sum(total)::int AS previsto
FROM core.qod_quadro_unidade
WHERE sigla_organograma IS NOT NULL
GROUP BY sigla_organograma;

GRANT SELECT ON marts.previsto_quadro TO app_reader, bi_reader;
