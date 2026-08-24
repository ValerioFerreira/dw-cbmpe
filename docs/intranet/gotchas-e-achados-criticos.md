# Gotchas e achados críticos

## Conhecimento tribal

1. **O Port Mapping 9090 é o calcanhar de aquiles.** Ver o passo 4 de *Como subir do zero*, na página *Operação e recuperação de desastre*. Não está no
   `captain-definition` nem em nenhum arquivo do repositório: é configuração manual no
   painel. Recriar o app sem ele derruba o login de todo mundo.
2. **O prefixo `/sgu` não existe no Rails.** Quem testa direto no container
   (`http://10.193.1.252:9090/api/v1/...`) usa **sem** o `/sgu`; pela URL pública, **com**.
   Confundir os dois é a causa mais provável de "está dando 404 e eu não entendo".
3. **Do nginx até o container o tráfego é HTTP puro.** O TLS termina na `srv-nginx01`; de
   `10.193.0.19` a `10.193.1.252` o **CPF e a senha** de cada login atravessam a rede
   interna em texto claro.
4. **Usuário novo nasce com senha = o próprio CPF**, e com `userAccountControl = 66048`,
   que significa **senha nunca expira**. Ou seja: quem nunca trocou a senha continua com
   o CPF como senha, indefinidamente — e o CPF de todo mundo estava público no `/users`.
5. **O DN do usuário no AD é montado pelo NOME** (`cn=<nome>,ou=SGU_Users,...`), tanto na
   criação quanto na troca de senha. Duas consequências: **homônimos colidem**, e se o
   `name` no Postgres divergir do `cn` no AD (por acento, espaço duplo ou correção feita
   direto no AD), a **troca de senha falha** — e o erro que aparece é do LDAP, não algo
   que aponte para a divergência de nome.
6. **`find_user_by_cpf` é um GET que escreve**: ao ser chamado, se o CPF existir no AD, ele
   **cria o registro local**. Um simples "consultar" altera a base.
   ⚠️ E ele é **público por necessidade**, não por descuido: o "esqueci minha senha" da
   Intranet chama essa rota **antes** do login, para descobrir o e-mail a partir do CPF
   (repositório `cbmpe-intranet-react`, arquivo `src/services/auth.js`). Diferente do `/users`, **fechar esta rota
   quebra a recuperação de senha de todo mundo** — proteger sim, mas com plano.
7. **O `/ldap_sync` é resto do tempo do Expresso** (`200.238.107.3`). Zero chamadas em 72h.
   Está aberto e, se alguém chamar por acidente, dispara uma sincronização em massa.
8. **Rotacionar a senha do AD exige atualizar a env `ldap_admin_password`** do app no
   CapRover **no mesmo momento**. Esquecer isso derruba o login de todos os sistemas.
9. **O GitHub Actions ainda dispara a cada push** para um destino dokku que não é produção.
10. **`SGU_URL` no próprio SGU** não faz sentido (ver *Configuração e infraestrutura*) — mas não remova sem testar.

## 🔴 Achados críticos

| # | Achado | Gravidade |
|---|---|---|
| 1 | **`GET /users` público na internet** devolve nome, CPF, e-mail e username de **2.500+ pessoas** (~1 MB de JSON), **sem autenticação** — verificado em 01/08/2026. **0 chamadas legítimas em 72h**, ou seja, dá para remover hoje sem quebrar nada | 🔴 vazamento de dado pessoal em massa (LGPD) |
| 2 | **Senha da conta de serviço do AD em texto puro no código** (`app/models/ldap_sync.rb`, método `sgu_bind`, e comentários do `ldap_sync_controller.rb`) e em **todo o histórico do git**. É a conta `ca@cbmpe.intranet`, a mesma que **cria usuário e troca senha** de todo o efetivo. **Precisa ser rotacionada no AD** — apagar do código não resolve | 🔴 comprometimento total do AD |
| 3 | `POST /api/v1/auth` **cria usuário no AD sem autenticação nenhuma** | 🔴 |
| 4 | `/find_user_by_cpf` e `/ldap_sync` abertos — enumeração de CPF e disparo de sincronização por qualquer um. ⚠️ O `find_user_by_cpf` **sustenta o "esqueci minha senha"**: não pode ser simplesmente fechado (ver *Conhecimento tribal*, item 6). O `/ldap_sync` pode | 🟠 |
| 4b | **Senha inicial = CPF, que nunca expira, e o CPF estava público no `/users`** — os achados 1 e 4 combinados significam que qualquer pessoa na internet tinha a lista de logins e a senha padrão de quem nunca trocou | 🔴 |
| 5 | **Ruby 2.6 (EOL 2022) e Rails 6.0 (EOL 2023)** sem patch de segurança, num serviço de autenticação | 🔴 |
| 6 | **Sem backup** do banco e **sem responsável identificado** pelo `10.193.0.20` | 🔴 |
| 7 | **Bus-factor zero** — ninguém na Seção sabe operar, restaurar ou quem é o dono | 🔴 |
| 8 | LDAPS com `verify_mode: VERIFY_NONE` e `TLSv1_1` — sem validação de certificado, protocolo obsoleto | 🟠 |
| 9 | `CORS origins '*'` numa API de autenticação | 🟠 |
| 10 | Credenciais e senha em texto claro entre nginx e container (HTTP interno) | 🟠 |

---

❓ **Pendências desta página** — o que ainda não se sabe sobre o SGU:

| Pendência | Com quem |
|---|---|
| **Dono do sistema** — hoje não há | Chefia da Seção |
| Quem administra o **`10.193.0.20`** e se o `sgu_api_production` tem **backup** | ❓ a descobrir |
| Existe **backup do AD** (`10.193.0.17`)? É ele a fonte da verdade das senhas | quem administra o AD |
| A conta de serviço `ca@cbmpe.intranet` tem **quais privilégios** no AD? (cria usuário e troca senha — o resto é desconhecido) | quem administra o AD |
| **Quem tem acesso ao grupo `cbmpe-dev` no GitLab?** O código só existe lá; sem esse acesso não há como reconstruir o SGU | Seção de Sistemas |
| **Ninguém monitora o SGU.** Não há alerta nem registro de indisponibilidade — a queda por falta de energia em 29/07/2026 derrubou o login de todos os sistemas e só foi notada dias depois, por acaso, ao escrever esta página | Seção de Sistemas |