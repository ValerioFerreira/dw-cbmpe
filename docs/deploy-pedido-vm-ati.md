# Pedido de VM e liberação de firewall — CBMPE BI

Versão para envio à Seção de Tecnologia / ATI (2026-10-08). **Substitui os dados de
dimensionamento e de portas de `deploy-solicitacao-ti.md`** (de agosto; o restante daquele
documento ainda vale como contexto, mas a aplicação mudou: hoje há backend e o dado vem do
data warehouse, sem JSON no pacote).

## 1. O que vai rodar na VM

Dois contêineres, sem estado em disco (todo o estado está no PostgreSQL do DW):

| Contêiner | O que é | Porta | Referência |
|---|---|---|---|
| `app` | nginx servindo a SPA estática | 80 (mapeada em 8080 no compose) | `Dockerfile`, `nginx.conf` |
| `backend` | Node 20 / Express: login pelo SGU, consulta ao DW, recorte por perfil | 4000 | `backend/Dockerfile`, `docker-compose.yml` |

Pode rodar com `docker compose` na própria VM ou como dois apps no CapRover — o que a ATI
preferir. O build do front para o ambiente interno usa `VITE_APP_INTERNO=1` (sem login local e
sem dado pessoal no pacote).

## 2. Quadro de recursos

| Recurso | Pedido | Por quê |
|---|---|---|
| vCPU | **2** | Carga leve e rajadas curtas: o backend monta respostas de até ~20 MB (ocorrências) |
| RAM | **4 GB** | Node com heap folgado para essas respostas (~1 GB) + nginx + sistema; sobra margem |
| Disco | **40 GB** (SSD/qualquer) | Sistema, imagens Docker e logs. **Não guarda dado**: pode ser recriada a partir do repositório |
| IOPS | padrão da plataforma | Sem leitura/escrita relevante em disco |
| Backup da VM | opcional (imagem pontual) | Stateless; o que importa é o banco |
| Backup do banco `dw` | **confirmar com quem administra o `caprover-01`** | Banco `dw` com ~234 MB hoje (era 626 MB antes da retenção de 30 dias do Mapa de Força); crescimento previsto baixo (dezenas de MB por mês). Precisamos saber se já há `pg_dump`/snapshot diário e por quanto tempo |
| SO | Linux com Docker (ou CapRover) | |

## 3. Regras de firewall

**Saída da VM (origem = VM):**

| Destino | Porta | Para quê |
|---|---|---|
| `10.193.1.252` (`caprover-01`, PostgreSQL do DW) | TCP **54301** | O backend lê `marts` e lê/grava o schema `app` (papel `app_backend`, não superusuário) |
| `10.193.0.16` (SGP) | TCP **5432** | Só no login: CPF → matrícula (hoje com um papel amplo; será trocado por um papel de leitura de uma tabela — ver `docs/seguranca-origens-grants.sql`) |
| `www.intranet.bombeiros.pe.gov.br` (SGU) | TCP **443** (HTTPS) | Autenticação (`/sgu/api/v1/auth/sign_in`) |
| DNS e NTP da corporação | 53 e 123 | Resolução de nomes e horário (o JWT tem validade) |
| Registro de imagens / pacotes (npm, Docker Hub) | 443 | Só se o **build** for feito na VM; dispensável se a imagem vier pronta |

**Entrada na VM:** a partir da rede interna (ou só do `srv-nginx01`, `10.193.0.19`): TCP 80/8080
(front) e 4000 (backend). Não expor à internet.

**Não precisam de acesso a partir da VM:** Frota (54329), ROE (15432), Mapa de Força/Vacina
(`10.193.0.20`) e o Windmill. Essas fontes são lidas pelo ETL, que já roda no Windmill e grava no
DW; o backend só lê o DW. Nenhuma regra nova para o Windmill/ETL.

## 4. Decisões que dependem do TI

- **A. Endereço:** subdomínio/host próprio (recomendado, ex.: `bi.intranet.bombeiros.pe.gov.br`,
  não exige mudança de código) ou subcaminho (~1 dia de ajuste de `base` e `basename`). O front
  precisa saber a URL pública do backend (`VITE_AUTH_API_URL`, embutida no build) — ideal:
  mesmo host com `/api` roteado ao backend pelo `srv-nginx01`, para evitar CORS.
- **B. Migração da Vercel:** decidida — o sistema passa a ser servido pela rede interna e lê o
  DW. A Vercel fica apenas como apresentação enquanto a VM não existe.
- **C. TLS:** terminado no `srv-nginx01` (HTTP interno até a VM), como os demais sistemas.
- **D. Quem administra o `srv-nginx01`**, e o contato para abrir o vhost.
- **E. Segredos:** as variáveis do backend (`JWT_SECRET`, `DATABASE_URL_DW` do papel
  `app_backend`, `DATABASE_URL_SGP`, `SGU_URL`, `CORS_ORIGIN`) vão para o cofre e para as
  App Configs; nenhum valor em arquivo no repositório.

## 5. Pré-requisitos do nosso lado (já prontos ou em andamento)

- DW em produção e carga diária automática às 05:30 (Windmill), com validação.
- Backend com login SGU e recorte de dados por perfil em todas as rotas nominais.
- Mapa de Força, Efetivo, Viaturas, Finanças, Ocorrências e painéis vindos do DW.
- A trocar antes do go-live: credenciais de superusuário nas origens (SQL de papéis restritos
  pronto em `docs/seguranca-origens-grants.sql`, para o DBA aplicar) e segredos nos scripts do
  Windmill (`docs/seguranca-credenciais.md`).
- Exigência já adotada: recusar senha igual ao CPF e não exibir lista nominal a quem entrou só
  pelo SGU sem o perfil correspondente.
