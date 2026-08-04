# CBMPE BI — Command Center

Painel de Business Intelligence do Corpo de Bombeiros Militar de Pernambuco:
organograma interativo, indicadores, dashboards e alertas por unidade.

Aplicação React + Vite pura — sem backend ou plataforma de terceiros.

## Rodando localmente

Pré-requisitos: Node.js 18+.

```bash
npm install
npm run dev
```

Abra a URL impressa pelo Vite (normalmente http://localhost:5173).

## Scripts

```bash
npm run dev        # servidor de desenvolvimento
npm run build      # build de produção em ./dist
npm run preview    # serve o build de produção localmente
npm run lint       # eslint
npm run typecheck  # checagem de tipos via jsconfig.json
```

## Dados

Os dados de organograma, indicadores, dashboards e alertas são estáticos e
ficam em [`src/data/organograma.js`](src/data/organograma.js) — sem backend,
sem variáveis de ambiente necessárias. A hierarquia, siglas, cargos e
divisões internas foram portadas do organograma de referência do CBMPE; os
números de efetivo/viaturas/materiais/finanças/atividades são fictícios,
porém coerentes, exatamente como no arquivo de referência original.

Quando houver uma fonte de dados real (API, planilha, banco), troque apenas
os `fetch*` de [`src/lib/cbmpe.js`](src/lib/cbmpe.js) — o restante do app já
consome esse contrato.

## Autenticação

As telas de Login/Registro/Recuperação de senha existem, mas usam um stub
local em [`src/lib/authClient.js`](src/lib/authClient.js) sem validação real
de credenciais (nenhum backend está envolvido). Troque esse módulo por um
provedor real (Supabase, Firebase Auth, API própria etc.) quando necessário,
mantendo a mesma assinatura de funções para não precisar alterar as telas.

## Deploy na Vercel

Projeto padrão Vite — a Vercel detecta automaticamente `npm run build` e a
pasta `dist`. O arquivo [`vercel.json`](vercel.json) garante que rotas do
React Router (`/organograma`, `/diretoria/:id` etc.) funcionem em acesso
direto/refresh.
