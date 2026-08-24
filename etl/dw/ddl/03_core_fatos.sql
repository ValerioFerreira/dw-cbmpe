-- Fatos do DW. Ver DW_MODELO_DADOS.md, "Fatos propostos".

-- ---------------------------------------------------------------------------
-- Snapshot diario de efetivo -- 1 militar x 1 dia
-- ---------------------------------------------------------------------------
-- E daqui que sai todo KPI de efetivo, inclusive serie temporal (que hoje nao
-- existe: a fonte so tem o estado atual, e o extrator sobrescreve).
--
-- A regra dos adidos cai na hierarquia, nao em codigo: o adido tem
-- sk_ome = ADIDOS (que pende do COMANDO GERAL, nao da DGP) e sk_orgao_externo
-- preenchido. Some no orgao externo, na OME fantasma, no rollup do Comando
-- Geral e no total -- as quatro visoes, com uma linha so.
CREATE TABLE IF NOT EXISTS core.fato_efetivo_diario (
    sk_tempo         integer NOT NULL REFERENCES core.dim_tempo (sk_tempo),
    sk_militar       integer NOT NULL REFERENCES core.dim_militar (sk_militar),
    sk_ome           integer NOT NULL REFERENCES core.dim_ome (sk_ome),
    sk_posto_grad    integer REFERENCES core.dim_posto_grad (sk_posto_grad),
    sk_orgao_externo integer REFERENCES core.dim_orgao_externo (sk_orgao_externo),
    adido            boolean NOT NULL DEFAULT false,
    afastado         boolean,
    le               boolean,
    ltip             boolean,
    readaptado       boolean,
    pcd              boolean,
    carga_id         bigint  REFERENCES stg.carga (carga_id),
    PRIMARY KEY (sk_tempo, sk_militar)
);

CREATE INDEX IF NOT EXISTS ix_efetivo_diario_ome ON core.fato_efetivo_diario (sk_tempo, sk_ome);

-- ---------------------------------------------------------------------------
-- Snapshot diario de frota -- 1 viatura x 1 dia
-- ---------------------------------------------------------------------------
-- Substitui o TRUNCATE do etl/viaturas/windmill-viaturas.py, que hoje apaga o
-- historico da frota a cada execucao.
CREATE TABLE IF NOT EXISTS core.fato_frota_diaria (
    sk_tempo    integer NOT NULL REFERENCES core.dim_tempo (sk_tempo),
    sk_viatura  integer NOT NULL REFERENCES core.dim_viatura (sk_viatura),
    sk_ome      integer REFERENCES core.dim_ome (sk_ome),
    situacao    text,
    odometro    double precision,
    carga_id    bigint REFERENCES stg.carga (carga_id),
    PRIMARY KEY (sk_tempo, sk_viatura)
);

-- ---------------------------------------------------------------------------
-- Mapa de forca -- tres fatos, porque o lancamento tem tres coisas penduradas
-- com graos diferentes
-- ---------------------------------------------------------------------------

-- 1 militar em 1 lancamento. E o unico fato que liga militar, viatura, OME e
-- tempo -- o que permite sair de "quantos a unidade tem" para "quantos a
-- unidade empregou".
CREATE TABLE IF NOT EXISTS core.fato_lancamento_militar (
    sk_lancamento_militar bigint  PRIMARY KEY,   -- id de launch_militaries
    id_lancamento         bigint  NOT NULL,
    sk_tempo              integer NOT NULL REFERENCES core.dim_tempo (sk_tempo),
    sk_militar            integer REFERENCES core.dim_militar (sk_militar),
    matricula_origem      text,                  -- guardada mesmo quando nao casa com dim_militar
    posto_origem          text,                  -- posto no ato do lancamento (historico congelado)
    sk_ome                integer REFERENCES core.dim_ome (sk_ome),
    sk_posto_servico      integer REFERENCES core.dim_posto_servico (sk_posto_servico),
    sk_turno              integer REFERENCES core.dim_turno (sk_turno),
    sk_tipo_servico       integer REFERENCES core.dim_tipo_servico (sk_tipo_servico),
    sk_funcao_servico     integer REFERENCES core.dim_funcao_servico (sk_funcao_servico),
    status                integer,
    carga_id              bigint REFERENCES stg.carga (carga_id)
);

CREATE INDEX IF NOT EXISTS ix_lanc_mil_tempo_ome ON core.fato_lancamento_militar (sk_tempo, sk_ome);
CREATE INDEX IF NOT EXISTS ix_lanc_mil_militar ON core.fato_lancamento_militar (sk_militar);

-- 1 viatura em 1 lancamento.
-- sk_viatura fica NULL quando a reconciliacao nao resolve: o mapa de forca
-- grava tipo + numero digitado a mao, sem FK para a Frota. Cobertura medida
-- em 98,6% (ver stg.de_para_viatura). Manter o par de origem e proposital --
-- e o que permite auditar a reconciliacao depois.
CREATE TABLE IF NOT EXISTS core.fato_lancamento_viatura (
    sk_lancamento_viatura bigint  PRIMARY KEY,   -- id de launch_vehicles
    id_lancamento         bigint  NOT NULL,
    sk_tempo              integer NOT NULL REFERENCES core.dim_tempo (sk_tempo),
    sk_viatura            integer REFERENCES core.dim_viatura (sk_viatura),
    acronimo_origem       text,
    numero_origem         text,
    sk_ome                integer REFERENCES core.dim_ome (sk_ome),
    sk_posto_servico      integer REFERENCES core.dim_posto_servico (sk_posto_servico),
    sk_turno              integer REFERENCES core.dim_turno (sk_turno),
    sk_tipo_servico       integer REFERENCES core.dim_tipo_servico (sk_tipo_servico),
    status                integer,
    carga_id              bigint REFERENCES stg.carga (carga_id)
);

CREATE INDEX IF NOT EXISTS ix_lanc_via_viatura ON core.fato_lancamento_viatura (sk_viatura, sk_tempo);
CREATE INDEX IF NOT EXISTS ix_lanc_via_tempo_ome ON core.fato_lancamento_viatura (sk_tempo, sk_ome);

-- 1 tipo de recurso em 1 lancamento, COM quantidade -- este e aditivo, os
-- outros dois sao contagem.
CREATE TABLE IF NOT EXISTS core.fato_lancamento_recurso (
    sk_lancamento_recurso bigint  PRIMARY KEY,
    id_lancamento         bigint  NOT NULL,
    sk_tempo              integer NOT NULL REFERENCES core.dim_tempo (sk_tempo),
    sk_tipo_recurso       integer REFERENCES core.dim_tipo_recurso (sk_tipo_recurso),
    sk_ome                integer REFERENCES core.dim_ome (sk_ome),
    sk_posto_servico      integer REFERENCES core.dim_posto_servico (sk_posto_servico),
    quantidade            integer,
    carga_id              bigint REFERENCES stg.carga (carga_id)
);

CREATE INDEX IF NOT EXISTS ix_lanc_rec_tempo ON core.fato_lancamento_recurso (sk_tempo, sk_tipo_recurso);

-- ---------------------------------------------------------------------------
-- Reserva remunerada -- fonte: sistema de controle de reserva (Neon)
-- ---------------------------------------------------------------------------
-- Este e o unico dominio em que o Neon NAO e cache: e o sistema de origem.
-- Nenhuma outra fonte nossa conhece averbacao. Ver DW_CATALOGO_FONTES.md.
--
-- Averbacao SOMA tempo (INSS, FFAA, PMPE, PM/BM de outros estados);
-- afastamento SUBTRAI (LTIP, ferias nao gozadas). Sao dois fatos separados
-- porque sao eventos diferentes, com atributos diferentes -- a averbacao tem
-- processo do INSS, o afastamento nao. Quem quer o liquido usa
-- marts.tempo_reserva_por_militar, que une os dois com sinal.
--
-- Transacionais: a origem guarda o historico com id proprio e estavel, entao
-- full refresh reproduz o mesmo resultado.

CREATE TABLE IF NOT EXISTS core.fato_averbacao (
    sk_averbacao          integer PRIMARY KEY,   -- id da origem
    sk_militar            integer NOT NULL REFERENCES core.dim_militar (sk_militar),
    tipo                  text,                  -- INSS / FFAA / PMPE / ...
    dias                  integer,
    processo_sei_militar  text,
    processo_sei_inss     text,
    observacao            text,
    criado_em             timestamp,
    atualizado_em         timestamp,
    carga_id              bigint REFERENCES stg.carga (carga_id)
);

CREATE INDEX IF NOT EXISTS ix_averbacao_militar ON core.fato_averbacao (sk_militar);

-- Nao confundir com o `afastado` de fato_efetivo_diario: la e "afastamento
-- superior a 90 dias publicado em SP", marcado na planilha do Peculio. Aqui
-- e o tempo que o sistema de reserva desconta da contagem.
CREATE TABLE IF NOT EXISTS core.fato_afastamento_reserva (
    sk_afastamento        integer PRIMARY KEY,   -- id da origem
    sk_militar            integer NOT NULL REFERENCES core.dim_militar (sk_militar),
    tipo                  text,                  -- LTIP / FERIAS NAO GOZADAS / ...
    dias                  integer,
    processo_sei_militar  text,
    observacao            text,
    criado_em             timestamp,
    atualizado_em         timestamp,
    carga_id              bigint REFERENCES stg.carga (carga_id)
);

CREATE INDEX IF NOT EXISTS ix_afast_reserva_militar ON core.fato_afastamento_reserva (sk_militar);

-- Snapshot: as datas de reserva sao PREVISAO, e mudam quando uma averbacao
-- entra. A origem so guarda a previsao vigente -- o historico de como ela
-- mudou so existe se nos guardarmos, exatamente como em fato_efetivo_diario.
CREATE TABLE IF NOT EXISTS core.fato_previsao_reserva (
    sk_tempo              integer NOT NULL REFERENCES core.dim_tempo (sk_tempo),
    sk_militar            integer NOT NULL REFERENCES core.dim_militar (sk_militar),
    data_reserva_requerimento date,
    data_reserva_compulsoria  date,
    abono_permanencia     boolean,
    data_inicio_abono     date,
    processo_sei_abono    text,
    carga_id              bigint REFERENCES stg.carga (carga_id),
    PRIMARY KEY (sk_tempo, sk_militar)
);

-- Estados que variam no tempo, entao vivem no snapshot diario e nao na
-- dimensao (2026-08-24).
ALTER TABLE core.fato_efetivo_diario ADD COLUMN IF NOT EXISTS horario_especial    boolean;
ALTER TABLE core.fato_efetivo_diario ADD COLUMN IF NOT EXISTS sk_tipo_afastamento integer;
