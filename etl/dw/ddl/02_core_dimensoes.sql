-- Dimensoes conformadas do DW. Ver DW_MODELO_DADOS.md, "Dimensoes
-- conformadas (proposta de 2026-08-24)".
--
-- Uma dimensao e conformada quando mais de um fato, vindo de mais de um
-- sistema, aponta para ela. E onde esta o valor do DW: hoje cada sistema tem
-- a sua lista de OMEs e ninguem consegue cruzar nada.

-- ---------------------------------------------------------------------------
-- dim_ome -- a espinha dorsal
-- ---------------------------------------------------------------------------
-- Autoridade: ovrsgp.tb_ome (82 linhas). NAO e limitada pelas OMEs que
-- aparecem no mapa de forca (31): a FK aponta do mapa de forca para o SGP,
-- nunca o contrario. Existem OMEs que nunca sao lancadas em servico.

CREATE TABLE IF NOT EXISTS core.dim_ome (
    sk_ome          integer     PRIMARY KEY,
    id_ome          integer     UNIQUE,          -- natural, do SGP. NULL em OME sintetica
    sigla           text        NOT NULL,
    nome            text        NOT NULL,
    tipo            text,                        -- AD (administrativa) / OP (operacional)
    nivel           integer,
    hierarquia      text,                        -- caminho materializado do SGP (ds_hiera_ome)
    sk_ome_pai      integer     REFERENCES core.dim_ome (sk_ome),
    municipio       text,
    latitude        numeric(12, 8),
    longitude       numeric(12, 8),
    status          text        NOT NULL,        -- ativa / inativa / extinta / planejada
    tipo_registro   text        NOT NULL,        -- ome / setor_vinculado / fantasma / situacao / planejada
    conta_efetivo   boolean     NOT NULL,        -- entra na contagem de efetivo?
    origem          text        NOT NULL,
    carregado_em    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN core.dim_ome.tipo_registro IS
  'ome: unidade normal. setor_vinculado: conta no filtro proprio e no rollup da mae (ex. CPPA dentro da DGP). '
  'fantasma: recorte sem existencia fisica (ex. ADIDOS). situacao: pseudo-OME que na verdade e estado funcional '
  '(INATIVOS, LIC/DGP, OUT SIT/DGP, CFHP 2017) -- nunca conta efetivo. planejada: existe no organograma, sem dado real.';

COMMENT ON COLUMN core.dim_ome.conta_efetivo IS
  'False para tipo_registro = situacao e para OME extinta/inativa. E o filtro que impede inativo e licenciado '
  'de entrarem no efetivo da DGP por rollup.';

-- Tabela de fechamento (closure) da hierarquia: uma linha por par
-- (ancestral, descendente), incluindo a propria OME com distancia 0.
-- E o que faz o rollup ser um JOIN simples em vez de CTE recursiva em toda
-- consulta -- e o que resolve CPPA e ADIDOS sem regra especial.
CREATE TABLE IF NOT EXISTS core.dim_ome_ancestral (
    sk_ome_ancestral   integer NOT NULL REFERENCES core.dim_ome (sk_ome),
    sk_ome_descendente integer NOT NULL REFERENCES core.dim_ome (sk_ome),
    distancia          integer NOT NULL,
    PRIMARY KEY (sk_ome_ancestral, sk_ome_descendente)
);

CREATE INDEX IF NOT EXISTS ix_ome_ancestral_desc ON core.dim_ome_ancestral (sk_ome_descendente);

-- ---------------------------------------------------------------------------
-- dim_tempo
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS core.dim_tempo (
    sk_tempo       integer PRIMARY KEY,          -- aaaammdd
    data           date    NOT NULL UNIQUE,
    ano            integer NOT NULL,
    mes            integer NOT NULL,
    dia            integer NOT NULL,
    trimestre      integer NOT NULL,
    nome_mes       text    NOT NULL,
    dia_semana     integer NOT NULL,             -- 0 = domingo
    nome_dia       text    NOT NULL,
    fim_de_semana  boolean NOT NULL,
    ano_mes        text    NOT NULL              -- aaaa-mm, para agrupar
);

-- ---------------------------------------------------------------------------
-- dim_militar
-- ---------------------------------------------------------------------------
-- Chave natural: matricula, normalizada como "sem hifen, com digito
-- verificador" -- e o formato do mapa de forca, que casa com 94,1% do efetivo
-- ativo do Peculio. Ver DW_CATALOGO_FONTES.md.
--
-- Fonte hoje: Peculio (efetivo ativo). Fonte futura: SGP. A coluna origem
-- existe para que a virada seja troca de precedencia, nao reescrita.

CREATE TABLE IF NOT EXISTS core.dim_militar (
    sk_militar        integer PRIMARY KEY,
    matricula         text    NOT NULL UNIQUE,   -- normalizada, sem hifen
    matricula_exibida text,                      -- como aparece no Peculio (704028-8)
    nome              text,
    nome_guerra       text,
    sexo              text,
    data_nascimento   date,
    data_ingresso     date,
    raca_cor          text,
    sk_posto_grad     integer,
    antiguidade       integer,                   -- No dentro do posto/graduacao
    antiguidade_geral integer,                   -- precedencia na corporacao inteira
    ativo             boolean NOT NULL,
    origem            text    NOT NULL,
    carregado_em      timestamptz NOT NULL DEFAULT now()
);

-- Antiguidade (2026-08-24). A planilha do Peculio e ordenada por precedencia:
-- bloco por posto/graduacao, do Cel ao Sd, e dentro de cada bloco a coluna
-- "No" reinicia em 1. Ou seja, o indice da planilha E a antiguidade -- nao
-- precisa ser calculada, so lida.
--
--   antiguidade        o "No" declarado na planilha, dentro do posto.
--                      E o numero que o militar cita ("sou o 269o 3o Sgt").
--   antiguidade_geral  posicao na planilha inteira, 1..N. Ordena a corporacao
--                      de ponta a ponta, o que a coluna acima nao faz: o No 1
--                      dos Cel e o No 1 dos Sd sao pessoas muito diferentes.
--
-- ALTER separado do CREATE porque o CREATE tem IF NOT EXISTS: num banco que
-- ja existe ele nao acrescentaria coluna nenhuma.
ALTER TABLE core.dim_militar ADD COLUMN IF NOT EXISTS antiguidade       integer;
ALTER TABLE core.dim_militar ADD COLUMN IF NOT EXISTS antiguidade_geral integer;

-- ---------------------------------------------------------------------------
-- dim_posto_grad
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS core.dim_posto_grad (
    sk_posto_grad    integer PRIMARY KEY,
    sigla            text    NOT NULL UNIQUE,
    classe           text,                       -- Oficial / Praca / (a confirmar)
    ordem_hierarquica integer,
    origem           text    NOT NULL
);

-- ---------------------------------------------------------------------------
-- dim_orgao_externo -- onde esta cada adido
-- ---------------------------------------------------------------------------
-- Fonte confirmada: Militar.orgao do Peculio (decisao de 2026-08-24). O SGP
-- tem lista tabelada (tb_unid_extrn) mas hoje esta pior: 254 dos 427 adidos
-- sem orgao utilizavel.
CREATE TABLE IF NOT EXISTS core.dim_orgao_externo (
    sk_orgao_externo integer PRIMARY KEY,
    nome             text    NOT NULL UNIQUE,
    origem           text    NOT NULL
);

-- ---------------------------------------------------------------------------
-- dim_viatura
-- ---------------------------------------------------------------------------
-- numero_ordem_norm e a coluna que liga esta dimensao ao mapa de forca:
-- numero sem zeros a esquerda e sem o sufixo "L" da Frota. Cobre 98,6% dos
-- lancamentos. Ver stg.de_para_viatura.
CREATE TABLE IF NOT EXISTS core.dim_viatura (
    sk_viatura            integer PRIMARY KEY,
    placa                 text    NOT NULL UNIQUE,
    id_frota              integer,
    chassi                text,
    renavam               text,
    patrimonio            text,
    tipo                  text,
    tipo_acronym          text,
    numero_ordem          text,
    numero_ordem_norm     text,
    marca                 text,
    modelo                text,
    ano                   integer,
    posse                 text,
    destinacao            text,
    combustivel           text,
    categoria_habilitacao text,
    rastreado             boolean,
    caracterizado         boolean,
    sk_ome                integer REFERENCES core.dim_ome (sk_ome),
    situacao              text,
    origem                text    NOT NULL,
    carregado_em          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_viatura_num_norm ON core.dim_viatura (numero_ordem_norm);

-- ---------------------------------------------------------------------------
-- Dimensoes do mapa de forca / escala
-- ---------------------------------------------------------------------------
-- Autoridade das quatro abaixo: ovresc. As FKs do mapa de forca apontam para
-- la, em outro servidor, sem constraint declarada -- 100% de casamento nas
-- quatro. Ver DW_CATALOGO_FONTES.md.

-- Ponto fisico de onde a guarnicao sai. Mais granular que a OME, e traz a
-- AIS (Area Integrada de Seguranca), recorte que nao existe em outra fonte.
CREATE TABLE IF NOT EXISTS core.dim_posto_servico (
    sk_posto_servico integer PRIMARY KEY,
    id_posto         integer UNIQUE,
    nome             text,
    sk_ome           integer REFERENCES core.dim_ome (sk_ome),
    municipio        text,
    bairro           text,
    ais              text,
    latitude         numeric(12, 8),
    longitude        numeric(12, 8),
    origem           text NOT NULL
);

CREATE TABLE IF NOT EXISTS core.dim_turno (
    sk_turno    integer PRIMARY KEY,
    id_turno    integer UNIQUE,
    nome        text,
    hora_inicio time,
    hora_fim    time,
    duracao_horas integer,
    origem      text NOT NULL
);

CREATE TABLE IF NOT EXISTS core.dim_tipo_servico (
    sk_tipo_servico integer PRIMARY KEY,
    id_tipo_servico integer UNIQUE,
    nome            text,
    natureza        text,
    origem          text NOT NULL
);

-- Funcao que o militar exerce NAQUELE servico (motorista, chefe de guarnicao,
-- socorrista). Nao confundir com a funcao administrativa da lotacao_funcao,
-- que vem da Repercussao Financeira.
CREATE TABLE IF NOT EXISTS core.dim_funcao_servico (
    sk_funcao_servico integer PRIMARY KEY,
    id_funcao         integer UNIQUE,
    nome              text,
    origem            text NOT NULL
);

CREATE TABLE IF NOT EXISTS core.dim_tipo_recurso (
    sk_tipo_recurso integer PRIMARY KEY,
    id_tipo_recurso integer UNIQUE,
    nome            text,
    origem          text NOT NULL
);

-- Origem da hierarquia (2026-08-24): o ORGANOGRAMA e a autoridade sobre quem
-- pende de quem; a tb_ome do SGP continua sendo o registro do que existe.
-- As duas divergem em pontos reais -- o SGP pendura DAS e CEFD na DGP, o
-- organograma as coloca sob DGA e DEIP -- e a decisao do usuario e seguir o
-- organograma. Para as OMEs que so existem no SGP, a hierarquia dele e
-- mantida, e estas colunas dizem qual dos dois mandou em cada linha.
ALTER TABLE core.dim_ome ADD COLUMN IF NOT EXISTS no_organograma boolean NOT NULL DEFAULT false;
ALTER TABLE core.dim_ome ADD COLUMN IF NOT EXISTS origem_hierarquia text;

COMMENT ON COLUMN core.dim_ome.no_organograma IS
  'True quando a unidade consta do organograma oficial (46 unidades).';
COMMENT ON COLUMN core.dim_ome.origem_hierarquia IS
  'organograma | sgp | regra -- de onde veio o sk_ome_pai desta linha.';
