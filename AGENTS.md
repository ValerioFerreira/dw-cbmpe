# AGENTS.md

## Project Context

CBMPE BI — Command Center. React + Vite SPA, no backend, deployed as a
static site (Vercel). No Base44 dependency of any kind remains in this repo.

Start with `README.md` for local setup and deploy notes.

## Key Files

- `src/`: frontend application source.
- `src/data/organograma.js`: static org-chart/indicator/dashboard/alert data
  (replaces what used to come from a backend).
- `src/lib/cbmpe.js`: data-fetching + hierarchy helpers. Swap the `fetch*`
  functions here if a real API/backend is introduced later.
- `src/lib/authClient.js`: local auth stub behind the Login/Register/Forgot/
  Reset screens — no real credential validation. Swap for a real auth
  provider (same function signatures) when needed.
- `vite.config.js`: plain Vite + `@vitejs/plugin-react`, with `@` aliased to
  `./src`.
- `vercel.json`: SPA rewrite so React Router routes work on direct load.

## Working Notes

- `npm run dev` starts the frontend against local static data — no env vars
  or external services required.
- Run `npm run lint` and `npm run typecheck` before finishing code changes.
- Keep the data shape in `src/data/organograma.js` (UnidadeOrganizacional /
  Indicador / Dashboard / Alerta — see `src/lib/cbmpe.js` for field usage)
  stable if you swap in a real data source, since pages consume it directly.

## Data Warehouse (planejamento em andamento)

Desde 2026-08-07 está em construção o data warehouse real do CBMPE — ETL,
arquitetura de banco (PostgreSQL em servidor interno da corporação),
modelo de tabelas, e conexão com o app e com ferramentas de BI externas
(Power BI/Metabase). **O contrato de dados atual em `src/data/
organograma.js`/`src/lib/cbmpe.js` é só um mock de UI — não é a
especificação do DW real**, e nenhuma visualização atual está congelada.

Documentação completa (viva, atualizada a cada sessão de planejamento) na
raiz do projeto:

- [`DW_PLANEJAMENTO.md`](DW_PLANEJAMENTO.md) — documento-mestre: contexto,
  log de decisões, perguntas em aberto, roadmap por fases. Comece por aqui.
- [`DW_ARQUITETURA.md`](DW_ARQUITETURA.md) — arquitetura técnica.
- [`DW_MODELO_DADOS.md`](DW_MODELO_DADOS.md) — modelo de dados (hipótese
  inicial, sujeita a validação).
- [`DW_CATALOGO_FONTES.md`](DW_CATALOGO_FONTES.md) — catálogo de fontes de
  dados por domínio.
- [`DW_ETL.md`](DW_ETL.md) — desenho do pipeline de ETL (Python).
- [`DW_GOVERNANCA.md`](DW_GOVERNANCA.md) — segurança, LGPD e controle de
  acesso.
- [`DW_PROCESSO_INTEGRACAO.md`](DW_PROCESSO_INTEGRACAO.md) — como agir
  quando o usuário envia uma nova fonte de dados.

Qualquer trabalho relacionado a dados reais, ETL, schema de banco ou
integração com o DW deve começar lendo `DW_PLANEJAMENTO.md` primeiro.

**Regra permanente**: sempre que o usuário compartilhar uma nova fonte de
dados para o DW, siga `DW_PROCESSO_INTEGRACAO.md` — esclareça todas as
dúvidas possíveis sobre a fonte primeiro; só depois de entendê-la por
completo, desenhe como ela se integra à estrutura atual (tabelas, chaves,
relações). Nunca pule direto para o desenho da integração.
