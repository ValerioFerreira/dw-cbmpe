# Build: compila a SPA estática (Vite) — mesmo build usado hoje na Vercel.
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# Vars VITE_* só existem no bundle final se estiverem presentes NESTE
# momento do build (Vite as substitui em tempo de build, não em runtime do
# container) — por isso viram ARG/ENV aqui, em vez de env_file do serviço no
# docker-compose.yml, que só afetaria um processo já compilado.
ARG VITE_ADMIN_USUARIO
ARG VITE_ADMIN_SENHA
ARG VITE_AUTH_API_URL
ENV VITE_ADMIN_USUARIO=$VITE_ADMIN_USUARIO \
    VITE_ADMIN_SENHA=$VITE_ADMIN_SENHA \
    VITE_AUTH_API_URL=$VITE_AUTH_API_URL

RUN npm run build

# Serve: nginx servindo os arquivos estáticos gerados, com fallback de
# rotas para index.html (necessário pro BrowserRouter do react-router-dom).
FROM nginx:1.27-alpine AS serve
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
