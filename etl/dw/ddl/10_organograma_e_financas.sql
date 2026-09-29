-- Views na SIGLA DO ORGANOGRAMA do app, para o backend (/dados/metricas) --
-- e a camada de Financas, que ate 2026-09-29 so existia no Neon.
--
-- Regra unica de pertencimento: cada OME do DW conta para o ancestral mais
-- proximo (ela mesma inclusive) que existe no organograma do app
-- (stg.de_para_ome, sistema = 'organograma', gravado por carga_core.py). Isso
-- reproduz, sem regra especial, as decisoes que o front aplicava a mao: CPPA
-- soma na DGP (a CPPA pende da DGP e nao esta no organograma), os adidos
-- contam no Comando Geral (a OME ADIDOS pende do CG), as CAT numeradas somam
-- na CAT base.

-- ---------------------------------------------------------------------------
-- Normalizacao de sigla -- espelho de normalizar() dos scripts Python
-- (maiusculas, sem acento, so letras e numeros: '1º GB' e '1ºGB' -> '1GB').
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION stg.normalizar_sigla(texto text)
RETURNS text
LANGUAGE sql IMMUTABLE AS $$
    SELECT regexp_replace(
        upper(translate(coalesce(texto, ''),
            'ÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇáàãâäéèêëíìîïóòõôöúùûüç',
            'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc')),
        '[^A-Z0-9]', '', 'g')
$$;

-- Texto monetario da planilha -> numero. Espelho de normalizar_valor() do
-- script "DF Metabase" do Windmill, para o DW e o Metabase lerem o mesmo
-- numero: tira tudo que nao e digito/virgula/ponto/sinal; com virgula e
-- formato brasileiro (ponto = milhar); sem virgula e ponto decimal; o que nao
-- vira numero vira NULL (nunca erro -- uma celula torta nao derruba a carga).
CREATE OR REPLACE FUNCTION stg.valor_monetario(texto text)
RETURNS numeric
LANGUAGE sql IMMUTABLE AS $$
    WITH l AS (SELECT regexp_replace(coalesce(texto, ''), '[^0-9,.\-]', '', 'g') AS v)
    SELECT CASE
             WHEN v = '' THEN NULL
             WHEN v LIKE '%,%' THEN
                  CASE WHEN replace(replace(v, '.', ''), ',', '.') ~ '^-?[0-9]+(\.[0-9]+)?$'
                       THEN replace(replace(v, '.', ''), ',', '.')::numeric END
             WHEN v ~ '^-?[0-9]+(\.[0-9]+)?$' THEN v::numeric
           END
    FROM l
$$;

-- Dono de cada OME no organograma do app.
CREATE OR REPLACE VIEW stg.ome_dono_organograma AS
SELECT DISTINCT ON (a.sk_ome_descendente)
       a.sk_ome_descendente AS sk_ome,
       d.valor_origem       AS sigla_organograma,
       a.distancia
FROM core.dim_ome_ancestral a
JOIN stg.de_para_ome d ON d.sistema = 'organograma' AND d.sk_ome = a.sk_ome_ancestral
ORDER BY a.sk_ome_descendente, a.distancia;

-- ---------------------------------------------------------------------------
-- Efetivo proprio por sigla do organograma, no ultimo dia carregado.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW marts.efetivo_organograma AS
SELECT d.sigla_organograma                   AS sigla,
       t.data                                AS data_referencia,
       count(*)                              AS efetivo_proprio,
       count(*) FILTER (WHERE f.adido)       AS adidos
FROM core.fato_efetivo_diario f
JOIN core.dim_tempo t ON t.sk_tempo = f.sk_tempo
JOIN core.dim_ome o   ON o.sk_ome = f.sk_ome AND o.conta_efetivo
JOIN stg.ome_dono_organograma d ON d.sk_ome = f.sk_ome
WHERE f.sk_tempo = (SELECT max(sk_tempo) FROM core.fato_efetivo_diario)
GROUP BY d.sigla_organograma, t.data;

-- ---------------------------------------------------------------------------
-- Viaturas proprias por sigla do organograma (versao atual, sem as
-- descarregadas -- mesma regra de marts.frota_por_ome e do app).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW marts.frota_organograma AS
SELECT d.sigla_organograma AS sigla,
       count(*)            AS viaturas
FROM core.dim_viatura v
JOIN stg.ome_dono_organograma d ON d.sk_ome = v.sk_ome
WHERE v.versao_atual
  AND (v.situacao <> 'Descarregada' OR v.situacao IS NULL)
GROUP BY d.sigla_organograma;

-- ---------------------------------------------------------------------------
-- Financas
-- ---------------------------------------------------------------------------
-- De-para dos destinos da planilha que NAO convergem sozinhos para a sigla do
-- organograma pela normalizacao (os demais casam direto). sigla NULL =
-- confirmadamente nao e unidade (pessoa fisica, rubrica central) e fica fora
-- do total por unidade. Migrado de etl/financas/mapeamento_unidades.json,
-- onde estao as justificativas de cada linha.
CREATE TABLE IF NOT EXISTS stg.de_para_destino_financas (
    chave       text PRIMARY KEY,       -- destino normalizado (stg.normalizar_sigla)
    sigla       text,                   -- sigla do organograma; NULL = fora
    observacao  text
);

INSERT INTO stg.de_para_destino_financas (chave, sigla, observacao) VALUES
    ('CATAGR',     'CAT/AG',    'grafia'),
    ('CATSERTAO',  'CAT/SE',    'grafia'),
    ('CATST',      'CAT/SE',    'grafia'),
    ('DINTER1',    'DINTER I',  'grafia'),
    ('DINTER2',    'DINTER II', 'grafia'),
    ('CPPA',       'DGP',       'CPPA soma na DGP'),
    ('GBINORONHA', 'GBI',       'destacamento do GBI em Fernando de Noronha'),
    ('AOMESMO',    NULL, 'auxilio funeral pago a familia (pessoa fisica)'),
    ('AOSMESMO',   NULL, 'auxilio funeral pago a familia (pessoa fisica)'),
    ('AOSMESMOS',  NULL, 'auxilio funeral pago a familia (pessoa fisica)'),
    ('AMESMA',     NULL, 'auxilio funeral pago a familia (pessoa fisica)'),
    ('ASMESMAS',   NULL, 'auxilio funeral pago a familia (pessoa fisica)'),
    ('DAFO',       NULL, 'rubrica/setor central, nao e unidade do organograma'),
    ('DPAFO',      NULL, 'rubrica/setor central (folha de pagamento)'),
    ('SEGI',       NULL, 'rubrica/setor central'),
    ('SGD',        NULL, 'rubrica/setor central')
ON CONFLICT (chave) DO UPDATE SET sigla = EXCLUDED.sigla, observacao = EXCLUDED.observacao;

-- Um lancamento por linha de cada bloco da aba "Banco de Dados - NAO MEXER"
-- (carga_core.py, carregar_fato_financeiro). Valores ja convertidos para
-- numero; o texto original continua em raw_financas.
CREATE TABLE IF NOT EXISTS core.fato_financeiro (
    bloco            text    NOT NULL,   -- autorizacao / carnaval_2026 / sfi_ordinario
    linha            integer NOT NULL,   -- linha da planilha (raw_financas.*.linha)
    destino          text,
    enquadramento    text,               -- NULL no SFI Ordinario (nao tem a coluna)
    situacao         text,
    natureza         text,               -- so no SFI Ordinario
    mes              text,
    valor            numeric(14, 2),
    valor_liquidado  numeric(14, 2),
    valor_pago       numeric(14, 2),
    PRIMARY KEY (bloco, linha)
);
-- "Operacao" das diarias no painel DF (2026-09-29).
ALTER TABLE core.fato_financeiro ADD COLUMN IF NOT EXISTS ficha_financ text;

-- Destino -> sigla do organograma: casa direto pela normalizacao ou pelo
-- de-para acima. Destino que nao casa em nenhum dos dois aparece em
-- marts.financas_destino_sem_mapeamento (e validar.py acusa).
CREATE OR REPLACE VIEW stg.financas_destino AS
SELECT f.bloco, f.linha, f.destino, f.enquadramento, f.situacao, f.natureza, f.mes,
       f.valor, f.valor_liquidado, f.valor_pago,
       CASE WHEN dp.chave IS NOT NULL THEN dp.sigla ELSE o.sigla END AS sigla_organograma,
       (dp.chave IS NULL AND o.sigla IS NULL)                        AS sem_mapeamento
FROM core.fato_financeiro f
LEFT JOIN stg.de_para_destino_financas dp ON dp.chave = stg.normalizar_sigla(f.destino)
LEFT JOIN (SELECT DISTINCT sigla FROM app.organograma_unidade) o
       ON stg.normalizar_sigla(o.sigla) = stg.normalizar_sigla(f.destino);

-- O numero do card "Financas" do app. Regra confirmada com o usuario
-- (DW_PLANEJAMENTO.md, 2026-08-07): so EMPENHADO; SFI Ordinario inteiro;
-- Autorizacao e Carnaval so enquadramento SI; valor = valor PAGO.
CREATE OR REPLACE VIEW marts.financas_organograma AS
SELECT sigla_organograma                     AS sigla,
       sum(valor_pago)                       AS valor_pago,
       sum(valor_liquidado)                  AS valor_liquidado,
       sum(valor)                            AS valor_autorizado,
       count(*)                              AS lancamentos
FROM stg.financas_destino
WHERE situacao = 'EMPENHADO'
  AND (bloco = 'sfi_ordinario' OR enquadramento = 'SI')
  AND sigla_organograma IS NOT NULL
GROUP BY sigla_organograma;

CREATE OR REPLACE VIEW marts.financas_destino_sem_mapeamento AS
SELECT destino, bloco, count(*) AS lancamentos, sum(valor_pago) AS valor_pago
FROM stg.financas_destino
WHERE sem_mapeamento AND nullif(trim(destino), '') IS NOT NULL
  AND situacao = 'EMPENHADO' AND (bloco = 'sfi_ordinario' OR enquadramento = 'SI')
GROUP BY destino, bloco;

-- ---------------------------------------------------------------------------
-- Frescor por dominio (D8): a ultima carga boa da fonte de cada dominio. O
-- app mostra isso para ninguem confundir dado velho com dado de hoje.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW marts.carga_status AS
SELECT dominio, max(concluido_em) AS ultima_carga
FROM (
    SELECT CASE
             WHEN tabela = 'raw_peculio.planilha'     THEN 'efetivo'
             WHEN tabela LIKE 'raw_frota.%'           THEN 'viaturas'
             WHEN tabela LIKE 'raw_financas.%'        THEN 'financas'
             WHEN tabela LIKE 'raw_mapa_forca.%'      THEN 'mapa_forca'
             WHEN tabela LIKE 'raw_vacina.%'          THEN 'vacinacao'
             WHEN tabela LIKE 'raw_roe.%'             THEN 'ocorrencias'
             WHEN tabela LIKE 'raw_qod.%'             THEN 'qod'
             WHEN tabela LIKE 'raw_reserva.%'         THEN 'reserva'
             WHEN tabela LIKE 'raw_cim.%'             THEN 'intencao_movimentacao'
           END AS dominio,
           concluido_em
    FROM stg.carga
    WHERE status = 'ok'
) x
WHERE dominio IS NOT NULL
GROUP BY dominio;

GRANT SELECT ON ALL TABLES IN SCHEMA marts TO app_reader, bi_reader;
