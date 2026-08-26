-- Camada stg: padronizacao e de-para entre sistemas.
--
-- E aqui que mora a reconciliacao -- o dado que NAO existe em nenhuma origem
-- e que e o valor real do DW. Cada sistema chama a mesma OME de um nome
-- diferente, e a mesma viatura de outro numero.

-- ---------------------------------------------------------------------------
-- de_para_ome -- como cada sistema chama cada OME
-- ---------------------------------------------------------------------------
-- tipo distingue:
--   grafia          variacao de escrita da mesma OME (1oGB -> 1o GB). A sigla
--                   de destino e a forma correta; mostra-la e o certo.
--   setor_vinculado unidade semanticamente distinta que soma dentro da mae
--                   mas mantem identidade propria (CPPA dentro da DGP).
--   fusao           duas linhas da fonte que sao a mesma unidade (DGP id 25 e
--                   DGP. id 8) -- decisao do usuario de 2026-08-24: somar.
--
-- A ausencia dessa distincao foi a causa do bug da CPPA no app (commit
-- 824b425): a grafia sobrescrevia a OME de origem, e o setor vinculado ficava
-- sem nenhum militar.
CREATE TABLE IF NOT EXISTS stg.de_para_ome (
    sistema      text    NOT NULL,
    valor_origem text    NOT NULL,
    sk_ome       integer NOT NULL REFERENCES core.dim_ome (sk_ome),
    tipo         text    NOT NULL,
    observacao   text,
    PRIMARY KEY (sistema, valor_origem)
);

-- ---------------------------------------------------------------------------
-- normalizar_numero_ordem -- a chave que liga Frota e mapa de forca
-- ---------------------------------------------------------------------------
-- A Frota grava 39L / 92L / 24L; o mapa de forca grava 039 / 092 / 024. Tirar
-- o sufixo L e os zeros a esquerda leva a cobertura de 80,6% para 98,6%.
-- Existe como funcao porque a mesma regra e aplicada em tres lugares
-- (dim_viatura, de_para_viatura e a resolucao do fato) e ja divergiu uma vez.
-- O espelho em Python e normalizar_numero() em carga_core.py.
CREATE OR REPLACE FUNCTION stg.normalizar_numero_ordem(numero text)
RETURNS text
LANGUAGE sql IMMUTABLE AS $$
    SELECT coalesce(
        nullif(ltrim(regexp_replace(upper(trim(numero)), 'L$', ''), '0'), ''),
        upper(trim(numero)))
$$;

-- ---------------------------------------------------------------------------
-- de_para_viatura -- liga o lancamento do mapa de forca a viatura da Frota
-- ---------------------------------------------------------------------------
-- Os dois sistemas nao estao ligados: o mapa de forca tem catalogo proprio de
-- tipos e um numero digitado a mao. Tres chaves foram testadas em 12 meses de
-- lancamento:
--   acronimo + numero .................... 59,9%
--   so o numero .......................... 80,6%
--   numero normalizado (sem zeros a
--   esquerda, sem o sufixo L da Frota) ... 98,6%   <- a usada
--
-- O acronimo e a parte NAO confiavel: em 26% dos casos que casam pelo numero
-- o tipo diverge, porque no mapa de forca ele e escolhido numa lista propria
-- no ato do lancamento.
--
-- Desde 2026-08-26 esta tabela NAO e mais a chave de resolucao: a
-- dim_viatura virou SCD2 e o fato casa direto por (numero_norm, data dentro
-- da vigencia). O papel dela agora e de RELATORIO DE QUALIDADE -- e o que
-- alimenta marts.qualidade_reconciliacao e o que permite auditar depois por
-- que um lancamento nao casou.
--
-- situacao:
--   resolvido          1 viatura para o numero em toda a linha do tempo
--   resolvido_por_data mais de uma viatura ja teve o numero, e a vigencia
--                      desempatou -- este e o ganho do SCD2
--   ambiguo            mais de uma candidata VIGENTE na mesma data; a
--                      vigencia nao bastou (ver desempate por acronimo e por
--                      situacao utilizavel em carga_core.py)
--   sem_casar          nenhuma viatura da Frota com aquele numero
--
-- sk_viatura so e preenchido quando situacao = 'resolvido': nos demais casos
-- a resposta depende da data e nao cabe numa coluna so.
CREATE TABLE IF NOT EXISTS stg.de_para_viatura (
    acronimo_origem text    NOT NULL,
    numero_origem   text    NOT NULL,
    numero_norm     text    NOT NULL,
    sk_viatura      integer REFERENCES core.dim_viatura (sk_viatura),
    situacao        text    NOT NULL,
    candidatos      integer NOT NULL DEFAULT 0,
    acronimo_diverge boolean,
    lancamentos            integer NOT NULL DEFAULT 0,
    lancamentos_resolvidos integer NOT NULL DEFAULT 0,
    PRIMARY KEY (acronimo_origem, numero_origem)
);

ALTER TABLE stg.de_para_viatura ADD COLUMN IF NOT EXISTS lancamentos integer NOT NULL DEFAULT 0;
ALTER TABLE stg.de_para_viatura ADD COLUMN IF NOT EXISTS lancamentos_resolvidos integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS ix_de_para_viatura_norm ON stg.de_para_viatura (numero_norm);
