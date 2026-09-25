# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./

# ---- Development: hot-reload via nodemon, codigo montado como volume ----
FROM base AS dev
RUN npm install
COPY . .
EXPOSE 4000
CMD ["npm", "run", "dev"]

# ---- Dependencias de producao, sem devDependencies ----
FROM base AS deps
RUN npm ci --omit=dev

# ---- Producao: imagem minima, usuario nao-root, healthcheck ----
FROM node:20-alpine AS production
WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY app.js index.js ./
COPY config ./config
COPY controllers ./controllers
COPY errors ./errors
COPY middlewares ./middlewares
COPY routes ./routes
COPY services ./services
COPY utils ./utils
# data/*.json (organograma.json, atribuicoes.json) e o armazenamento de
# estado editavel do backend (ver services/organogramaStore.js,
# atribuicoesStore.js) -- faltava aqui desde que esses arquivos foram
# criados, entao POST/PUT/DELETE em /organograma e /atribuicoes sempre
# falhavam com ENOENT em qualquer imagem construida (achado ao testar o
# build real em 2026-09-25). --chown pro dono do processo poder escrever
# (as duas stores gravam em arquivo temporario no mesmo diretorio e
# renomeiam, pra escrita atomica).
COPY --chown=appuser:appgroup data ./data

USER appuser

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "index.js"]
