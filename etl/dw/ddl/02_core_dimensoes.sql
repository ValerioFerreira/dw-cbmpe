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
-- dim_viatura -- SCD tipo 2 (desde 2026-08-26)
-- ---------------------------------------------------------------------------
-- numero_ordem_norm e a coluna que liga esta dimensao ao mapa de forca:
-- numero sem zeros a esquerda e sem o sufixo "L" da Frota. Ver
-- stg.de_para_viatura.
--
-- Por que virou SCD2. O numero de ordem e RECICLADO: quando uma viatura e
-- devolvida ou descarregada, a que entra no lugar herda o numero. Medido em
-- 2026-08-26: 86 numeros repetidos, 177 viaturas envolvidas, 413 pares
-- (acronimo, numero) ambiguos. Com uma linha por viatura nao ha como saber
-- qual delas estava em servico no dia do lancamento -- e o mapa de forca
-- pergunta exatamente isso. Com vigencia, a data resolve.
--
-- O grao passa a ser UMA LINHA POR VERSAO da viatura. Uma versao nova nasce
-- a cada mudanca de OME (raw_frota.transfers) ou de situacao
-- (raw_frota.vehicle_statuses) -- os dois unicos atributos que mudam ao longo
-- da vida do veiculo. O resto (placa, chassi, tipo, numero) e carregado junto
-- em todas as versoes, repetido de proposito: quem consulta uma versao quer a
-- viatura inteira, nao um fragmento.
--
-- sk_viatura = id_frota * 100 + sequencia da versao. E deterministico, o que
-- resolve para viatura a pendencia de chaves substitutas instaveis: o
-- row_number() antigo trocava a chave de cada viatura a cada carga. Cabe
-- folgado -- o maior id da Frota e 859 e a viatura com mais versoes tem 27.
--
-- valido_de = 1900-01-01 na primeira versao nao e lixo: o historico da Frota
-- comeca em 2023-12-06 e o mapa de forca em 2021-05-07, entao sem abrir a
-- primeira versao para tras dois anos e meio de lancamento ficariam sem
-- casar. Mas isso vale so para UMA viatura por numero de ordem -- a que
-- chegou primeiro. Abrir todas devolveria a ambiguidade que o SCD2 veio
-- resolver: as duas donas do mesmo numero ficariam vigentes no mesmo dia.
-- valido_ate NULL = versao aberta (versao_atual = true).
--
-- placa deixou de ser UNIQUE: com SCD2 ela se repete entre as versoes da
-- mesma viatura. A unicidade agora e (id_frota, valido_de).
CREATE TABLE IF NOT EXISTS core.dim_viatura (
    sk_viatura            integer PRIMARY KEY,
    placa                 text    NOT NULL,
    id_frota              integer NOT NULL,
    valido_de             date    NOT NULL DEFAULT DATE '1900-01-01',
    valido_ate            date,
    versao_atual          boolean NOT NULL DEFAULT true,
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
    -- still_usable do proprio catalogo da Frota: false para Descarregada e
    -- Devolvida. E o que desempata numero de ordem reciclado quando duas
    -- viaturas ficam vigentes no mesmo dia -- a que saiu de servico nao
    -- estava rodando. Sozinho, esse filtro leva a resolucao do mapa de forca
    -- de 91,9% para 97,5% dos lancamentos.
    em_servico            boolean,
    origem                text    NOT NULL,
    carregado_em          timestamptz NOT NULL DEFAULT now()
);

-- Migracao em cima de um DW ja criado (o CREATE acima so vale para banco
-- novo). A dim_viatura e inteiramente derivada e reconstruida a cada carga,
-- entao ALTER e seguro -- e evita o DROP CASCADE, que levaria junto as FKs
-- de fato_lancamento_viatura, fato_frota_diaria e stg.de_para_viatura.
ALTER TABLE core.dim_viatura ADD COLUMN IF NOT EXISTS valido_de date NOT NULL DEFAULT DATE '1900-01-01';
ALTER TABLE core.dim_viatura ADD COLUMN IF NOT EXISTS valido_ate date;
ALTER TABLE core.dim_viatura ADD COLUMN IF NOT EXISTS versao_atual boolean NOT NULL DEFAULT true;
ALTER TABLE core.dim_viatura DROP CONSTRAINT IF EXISTS dim_viatura_placa_key;
ALTER TABLE core.dim_viatura ADD COLUMN IF NOT EXISTS em_servico boolean;
ALTER TABLE core.dim_viatura ALTER COLUMN id_frota SET NOT NULL;

CREATE INDEX IF NOT EXISTS ix_viatura_num_norm ON core.dim_viatura (numero_ordem_norm);
-- O indice que o mapa de forca usa de fato: numero + janela de vigencia.
CREATE INDEX IF NOT EXISTS ix_viatura_num_vigencia
    ON core.dim_viatura (numero_ordem_norm, valido_de, valido_ate);
CREATE UNIQUE INDEX IF NOT EXISTS ux_viatura_frota_vigencia
    ON core.dim_viatura (id_frota, valido_de);
CREATE INDEX IF NOT EXISTS ix_viatura_atual ON core.dim_viatura (versao_atual) WHERE versao_atual;

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

-- ---------------------------------------------------------------------------
-- Alargamento da dim_militar (2026-08-24) -- fonte: planilha do Peculio
-- ---------------------------------------------------------------------------
-- A dim_militar carregava 10 dos 38 campos que a aplicacao usa. Estes fecham
-- a diferenca, com tres criterios:
--
--   1. DATA entra; DURACAO nao. A planilha traz idade, tempo de servico e
--      tempo na OBM ja calculados -- numeros que envelhecem sozinhos. Medido:
--      a idade declarada ja diverge do calculo em 126 dos 2.658, e o tempo de
--      servico bate com (hoje - data de praca) em 2.653. Guardamos as datas e
--      derivamos em marts.militar, que nunca fica velho.
--   2. "Ano de ingresso" nao entra: e o ano da data de praca em 2.657 de
--      2.658. Coluna redundante nao vira coluna.
--   3. Telefone vai para tabela separada (core.contato_militar), nao para ca:
--      um SELECT * na dimensao nao pode vazar contato de 2.043 militares.
ALTER TABLE core.dim_militar ADD COLUMN IF NOT EXISTS data_ultima_promocao  date;
ALTER TABLE core.dim_militar ADD COLUMN IF NOT EXISTS sk_principio_promocao integer;
ALTER TABLE core.dim_militar ADD COLUMN IF NOT EXISTS ome_anterior          text;
ALTER TABLE core.dim_militar ADD COLUMN IF NOT EXISTS data_movimentacao_sp  date;
ALTER TABLE core.dim_militar ADD COLUMN IF NOT EXISTS sk_suplemento         integer;
ALTER TABLE core.dim_militar ADD COLUMN IF NOT EXISTS acumulo_cargos        text;
ALTER TABLE core.dim_militar ADD COLUMN IF NOT EXISTS observacao            text;

-- ---------------------------------------------------------------------------
-- dim_principio_promocao -- por que o militar foi promovido
-- ---------------------------------------------------------------------------
-- 5 valores: ANTIGUIDADE (2.140), MERECIMENTO (353), ANTIGUIDADE DECENAL
-- (160), PROMOCAO REQUERIDA (2), RESSARCIMENTO DE PRETERICAO (2).
CREATE TABLE IF NOT EXISTS core.dim_principio_promocao (
    sk_principio_promocao integer PRIMARY KEY,
    principio             text    NOT NULL UNIQUE,
    origem                text    NOT NULL
);

-- ---------------------------------------------------------------------------
-- dim_suplemento_pessoal -- o ato que publicou a movimentacao
-- ---------------------------------------------------------------------------
-- "SP no 013/2026" e afins: 103 publicacoes distintas. Vira dimensao porque
-- numero e data andam juntos e se repetem em centenas de militares -- o SP
-- 013/2026 sozinho move 548 pessoas.
CREATE TABLE IF NOT EXISTS core.dim_suplemento_pessoal (
    sk_suplemento    integer PRIMARY KEY,
    numero_ano       text    NOT NULL UNIQUE,
    data_publicacao  date,
    origem           text    NOT NULL
);

-- ---------------------------------------------------------------------------
-- dim_tipo_afastamento -- LE, LTS, LTIP, LM
-- ---------------------------------------------------------------------------
-- Afastamento superior a 90 dias publicado em SP. Cuidado: a coluna da
-- planilha tem lixo digitado (siglas de OME no lugar do tipo) -- entra como
-- esta e o validar.py reporta, porque corrigir na origem nao e nosso.
CREATE TABLE IF NOT EXISTS core.dim_tipo_afastamento (
    sk_tipo_afastamento integer PRIMARY KEY,
    sigla               text    NOT NULL UNIQUE,
    origem              text    NOT NULL
);

-- ---------------------------------------------------------------------------
-- contato_militar -- telefone, separado de proposito
-- ---------------------------------------------------------------------------
-- Tabela propria, e nao colunas na dim_militar, para que o contato seja uma
-- decisao explicita de quem consulta em vez de carona num SELECT *. Fonte:
-- as abas de telefone da planilha (DIRETORIAS tem prioridade sobre
-- GRUPAMENTOS, mesma regra do script que alimenta o app hoje).
-- Ver DW_GOVERNANCA.md.
CREATE TABLE IF NOT EXISTS core.contato_militar (
    sk_militar  integer PRIMARY KEY REFERENCES core.dim_militar (sk_militar),
    telefone_1  text,
    telefone_2  text,
    origem      text NOT NULL
);
