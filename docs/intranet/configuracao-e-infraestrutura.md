# Configuração e infraestrutura

Fonte da verdade: **as envs do app `auth-api` no CapRover** (App Configs). O `.env.example`
do repositório está **defasado** — não cita `SGDB_*`, `ldap_*` nem `API_CONSULTAS_*`.

🔒 **Os valores de TODAS as variáveis abaixo estão no cofre** `cofre-sistemas.kdbx`, entrada
**`SGU — auth-api (CapRover)`**, no campo *Notas*, espelhando o `.env` inteiro (e não só as
sensíveis — quem for recriar o app precisa de todas). **Nenhum valor nesta página.**
O 🔑 marca as que são **segredo**: se vazarem, não basta trocar no cofre, tem que
**rotacionar na origem** (AD, banco, SMTP).

| Variável | Para que serve |
|---|---|
| `RAILS_ENV`, `environment` | ambiente (`production`) |
| `host` | `www.intranet.bombeiros.pe.gov.br/sgu` — usado nos links dos e-mails |
| `SGDB_ENDPOINT` | host do PostgreSQL |
| `SGDB_USER` | usuário do banco |
| 🔑 `SGDB_PWD` | senha do banco |
| `ldap_host`, `ldap_port` | servidor do AD (LDAPS) |
| `ldap_base` | OU onde vivem os usuários |
| `ldap_attribute` | atributo de login (`samaccountname`) |
| `ldap_admin_user` | conta de serviço que faz o bind |
| 🔑 `ldap_admin_password` | senha da conta de serviço |
| `API_CONSULTAS_URL`, `API_CONSULTAS_VERSION` | endereço da `consultas-api` |
| `email`, `address_email`, `port_email`, `domain_email`, `username_email` | relay SMTP |
| 🔑 `password_email` | senha do SMTP |
| 🔑 `SECRET_KEY_BASE` | chave de assinatura do Rails |
| `SGU_URL` | ⚠️ aponta para o próprio SGU. O SGU não consome a si mesmo — provável env copiada do `mapa-de-forca-api` e esquecida. **Não remover sem testar** |

⚠️ **Não definidas** (o `database.yml` cai no fallback do código):
`SGDB_DB` → banco **`sgu_api_production`**; `SGDB_PORT` → **5432**.

## Onde roda

| | |
|---|---|
| Entrada pública | `https://www.intranet.bombeiros.pe.gov.br/sgu` (NAT `200.196.160.29`) |
| Proxy reverso | `srv-nginx01` `10.193.0.19` — nginx 1.10.3, TLS Let's Encrypt, vhost `default`, `location /sgu` |
| Servidor da aplicação | `caprover-01` `10.193.1.252` |
| App no CapRover | **`auth-api`** — imagem `img-captain-auth-api:3` (construída pelo CapRover a partir do `Dockerfile` do repo, via `captain-definition`) |
| Container | `srv-captain--auth-api` |
| Porta | **Port Mapping manual `9090 → 3000`** (modo ingress) |
| Volumes | **nenhum** — stateless |
| Banco | PostgreSQL em **`10.193.0.20:5432`**, base **`sgu_api_production`**, usuário `ctic` |
| AD | `10.193.0.17:636` LDAPS, base `ou=SGU_Users,dc=cbmpe,dc=intranet` |

> 📌 **Correção ao mapa de infraestrutura do plano:** o `10.193.0.20` estava registrado
> apenas como MySQL/MariaDB. Ele roda **PostgreSQL também** (porta 5432 aberta, verificado).