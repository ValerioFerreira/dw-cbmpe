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
