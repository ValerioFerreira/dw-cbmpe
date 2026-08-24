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
-- situacao:
--   resolvido  1 viatura para o numero
--   ambiguo    numero de ordem reciclado (viatura baixada, nova herdou o
--              numero). Resolve por vigencia quando a dim_viatura virar SCD2.
--   sem_casar  ~1,4% do volume
CREATE TABLE IF NOT EXISTS stg.de_para_viatura (
    acronimo_origem text    NOT NULL,
    numero_origem   text    NOT NULL,
    numero_norm     text    NOT NULL,
    sk_viatura      integer REFERENCES core.dim_viatura (sk_viatura),
    situacao        text    NOT NULL,
    candidatos      integer NOT NULL DEFAULT 0,
    acronimo_diverge boolean,
    PRIMARY KEY (acronimo_origem, numero_origem)
);

CREATE INDEX IF NOT EXISTS ix_de_para_viatura_norm ON stg.de_para_viatura (numero_norm);
