# Guia de integração

## Como plugar um sistema novo no SGU

URL base: **`https://www.intranet.bombeiros.pe.gov.br/sgu/api/v1`**
(o `/sgu` é do nginx; direto no container o caminho é sem ele — ver *Gotchas e achados críticos*, item 2).

**Passo 1 — login**

```
POST /auth/sign_in
Content-Type: application/json

{ "username": "<CPF, só dígitos>", "password": "<senha do AD>" }
```

⚠️ O campo é **`username`**, não `cpf` nem `email` (`authentication_keys: [:username]`).

**Passo 2 — pegar os tokens nos CABEÇALHOS da resposta, não no corpo**

O corpo traz os dados do usuário; o que autentica vem nos headers:
`access-token`, `client`, `uid` (mais `expiry` e `token-type`).
Guarde os **três primeiros** — é a armadilha nº 1 de quem integra pela primeira vez.

> Em navegador isso só funciona porque o CORS do SGU declara
> `expose: ['access-token','expiry','token-type','uid','client']`. Sem esse `expose`, o
> JavaScript **não enxerga** os headers mesmo com a resposta chegando 200.

**Passo 3 — usar os três headers em toda requisição autenticada**

```
uid: <uid>
client: <client>
access-token: <access-token>
```

- Validade: **24 horas**.
- O token **não** rotaciona a cada requisição (`change_headers_on_each_request = false`),
  então pode ser guardado e reusado. Em versões que rotacionam, o cliente teria que
  reescrever o token a cada resposta — aqui, não.
- **Não existe refresh token.** Expirou, o usuário loga de novo.

**Passo 4 — validar a sessão**

```
GET /auth/validate_token     (com os três headers)
```

A resposta traz os dados do usuário **e a chave `military`** com os dados funcionais
vindos da `consultas-api`. É assim que um sistema descobre posto/OBM sem ter base própria.

> **Servidor para servidor:** o `mapa-de-forca-api` chama esse mesmo endpoint passando os
> três valores como **query params** em vez de headers (`app/models/sgu/user.rb`) — também
> funciona, e é o caminho mais simples para um backend validar o token que recebeu do front.

**Passo 5 — trocar senha (usuário logado)**

```
PUT /auth/password     (com os três headers)
{ "current_password": "...", "password": "...", "password_confirmation": "..." }
```
Isso escreve **direto no AD**. Se o `cn` do AD divergir do `name` no Postgres, falha — ver *Gotchas e achados críticos*, item 5.

**Passo 6 — "esqueci minha senha" (3 chamadas, nessa ordem)**

1. `GET /find_user_by_cpf?cpf=<cpf>` → devolve o usuário, de onde se extrai o **e-mail**.
   *(É por isso que essa rota é pública: o usuário esqueceu a senha, logo não tem token.)*
2. `POST /auth/password` com `{ "email": "...", "redirect_url": "<url do seu front>" }`
   → o SGU envia e-mail pelo relay.
3. O link do e-mail aponta para `/auth/password/edit?...&reset_password_token=...&redirect_url=...`,
   que redireciona para o seu front **preservando a query string**. O front então faz
   `PUT /auth/password?<a mesma query string>` com `{ password, password_confirmation }`.

🔴 **O que o SGU NÃO faz: autorização.** Ele responde "esta pessoa é quem diz ser" e nada
mais — não há papéis, grupos nem permissões. Cada sistema implementa o seu próprio
controle de acesso. E note o mau exemplo a não copiar: o `portalcbmpe` criou os middlewares
`AuthSGU` e `VerifySguToken` e **deixou os dois vazios** — a API dele parece protegida no
`Kernel.php` e não valida absolutamente nada.

## Como criar usuário pelos endpoints

```
POST /api/v1/auth
{ "name": "...", "cpf": "...", "email": "...", "password": "..." }
```

O que realmente acontece (`User#create_ldap_user` → `LdapSync.create_user`):

- O usuário é criado **no Active Directory**, na OU `ou=SGU_Users`, com DN
  `cn=<NOME EM MAIÚSCULAS>`.
- ⚠️ **O campo `password` enviado é IGNORADO.** A senha gravada no AD é sempre o
  **CPF** (`unicodepwd => encode_passwd(cpf)`). Mandar uma senha forte no payload não
  muda nada — a pessoa vai continuar entrando com o CPF.
- `userAccountControl = 66048` → conta **ativa** e **senha nunca expira**.
- `description` fica como `"Created by SGU <data>"` — é assim que se identifica depois
  quem foi criado por esta rota.
- ⚠️ **O registro local no Postgres NÃO é criado aqui.** Ele nasce depois: no primeiro
  login da pessoa (`config.ldap_create_user = true`) ou quando alguém chamar
  `/find_user_by_cpf`. Portanto, logo após criar, o usuário **não aparece** em `/users`.
- 🔴 **Esta rota não exige autenticação nenhuma** (achado nº 3, na página *Gotchas e achados críticos*). Qualquer um que alcance a
  URL cria conta no AD do CBMPE.