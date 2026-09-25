-- Estado editavel do app (decisao do usuario em 2026-09-25, ver
-- DW_INGESTAO.md secao 6): o organograma e as atribuicoes de perfil saem de
-- backend/data/*.json e passam a viver aqui, no banco `dw`, com o backup do
-- servidor e sem depender de volume Docker persistente.
--
-- Nao e uma camada do DW (nao e raw/stg/core/marts): e o banco de aplicacao
-- do backend. Quem escreve e so o backend (backend/services/*Store.js); o
-- ETL so LE app.organograma_unidade (carga_core.py -- o organograma e a
-- autoridade sobre quem pende de quem, decisao de 2026-08-24).

CREATE SCHEMA IF NOT EXISTS app;
COMMENT ON SCHEMA app IS 'Estado editavel do app CBMPE BI (organograma, perfis de acesso). Escrito so pelo backend.';

CREATE TABLE IF NOT EXISTS app.organograma_unidade (
    id              text PRIMARY KEY,
    sigla           text NOT NULL UNIQUE,
    nivel           smallint NOT NULL CHECK (nivel BETWEEN 1 AND 6),
    -- DEFERRABLE: o backend regrava a arvore inteira numa transacao, e a
    -- ordem de insercao nao precisa respeitar pai-antes-de-filho.
    parent_id       text REFERENCES app.organograma_unidade (id) DEFERRABLE INITIALLY DEFERRED,
    fixo            boolean NOT NULL DEFAULT false,
    ordem           numeric NOT NULL DEFAULT 0,
    funcao_coronel  boolean NOT NULL DEFAULT false,
    atualizado_em   timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE app.organograma_unidade IS 'Hierarquia do organograma editada em /adm. Autoridade de hierarquia para core.dim_ome_ancestral.';

-- Perfil PRINCIPAL de cada usuario. `usuario` = matricula so com digitos,
-- ou PENDENTE-xxxxxx enquanto a matricula nao e encontrada no SGP.
CREATE TABLE IF NOT EXISTS app.atribuicao (
    usuario             text PRIMARY KEY,
    perfil              text NOT NULL,
    unidade             text,
    titular             text,
    unidade_concedida   text,
    matricula_pendente  boolean NOT NULL DEFAULT false,
    -- Excecao documentada em DW_GOVERNANCA.md: so para registros PENDENTES,
    -- para o retry em lote achar a matricula depois. Apagado assim que
    -- resolve. Nunca devolvido por GET /atribuicoes.
    cpf_pendente        text,
    atualizado_em       timestamptz NOT NULL DEFAULT now(),
    CHECK (cpf_pendente IS NULL OR matricula_pendente)
);
COMMENT ON TABLE app.atribuicao IS 'Perfil de acesso principal por usuario (matricula), atribuido em /adm.';

-- Perfis A MAIS de um usuario (suporte a mais de um perfil, 2026-09-25).
-- `posicao` preserva a ordem em que foram adicionados.
CREATE TABLE IF NOT EXISTS app.atribuicao_adicional (
    usuario             text NOT NULL REFERENCES app.atribuicao (usuario) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
    perfil              text NOT NULL,
    unidade             text,
    titular             text,
    unidade_concedida   text,
    posicao             smallint NOT NULL DEFAULT 0,
    PRIMARY KEY (usuario, perfil)
);
COMMENT ON TABLE app.atribuicao_adicional IS 'Perfis adicionais de um usuario, alem do principal em app.atribuicao.';
