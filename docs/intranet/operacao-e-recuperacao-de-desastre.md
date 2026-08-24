# Operação e recuperação de desastre

## Deploy
Pelo **CapRover CLI**, igual aos demais apps da Seção — o CapRover recebe o código e
constrói a imagem a partir do `Dockerfile` do repositório (`captain-definition`):

```bash
caprover deploy -a auth-api -b master
```

(`img-captain-auth-api:3` = terceira versão construída assim.)

⚠️ Antes de deployar, lembre que **o build é do zero**: Ruby 2.6.3 e as gems são baixadas
na hora, e uma delas (`devise_ldap_authenticatable`) vem **de um fork no GitHub**, não do
RubyGems. Se aquele repositório sair do ar ou a branch `default` mudar, **o build quebra** —
e não há imagem versionada em registry para voltar atrás. Um deploy que falha aqui deixa o
login de todo mundo dependendo do container antigo continuar de pé.

⚠️ O `.github/workflows/main.yml` do repositório faz deploy via **dokku** para
`200.196.160.29:22193`. Isso é **herança morta** — produção é o CapRover. O workflow ainda
dispara a cada push no `master`; deveria ser removido para não confundir quem vier depois.

## Logs
```bash
ssh ctic@10.193.1.252
docker service logs --since 24h srv-captain--auth-api
```
⚠️ Os logs contêm **CPF nos parâmetros** de login. Não colar em ferramentas externas nem
em contexto de IA. O `filter_parameter_logging.rb` filtra senha e token, **mas não o CPF**.

## Backup
🔴 **Nenhum backup conhecido.** O único estado que importa é o banco `sgu_api_production`
em `10.193.0.20` — e ❓ **não se sabe quem administra esse servidor nem se ele tem rotina
de backup**. Nunca houve teste de restore.

O que precisaria ser salvo:
- `sgu_api_production` (Postgres `10.193.0.20`) — `pg_dump`;
- as **envs do app no CapRover** (não estão no git; se o app for perdido, os valores
  só existem no cofre);
- o **AD** em si, que é a fonte da verdade das senhas — backup é responsabilidade de quem
  administra o `10.193.0.17`. ❓ **A confirmar.**

O container **não** precisa de backup (stateless, reconstruível pelo repositório).

## Como subir do zero (disaster recovery)

1. Clonar `git@gitlab.com:cbmpe-dev/sgu-api.git`.
2. Criar o app **`auth-api`** no CapRover (**sem** `Has Persistent Data` — não usa volume).
3. Preencher **todas** as envs listadas na página *Configuração e infraestrutura*, com os valores do cofre.
4. ⚠️ **Configurar o Port Mapping `9090 → 3000`** em *HTTP Settings*. **Este é o passo que
   será esquecido.** Sem ele o `proxy_pass` da `srv-nginx01` bate em porta fechada e o
   login de todos os sistemas fica fora do ar, sem nenhuma mensagem de erro que aponte
   para a causa.
5. Deployar (build do `Dockerfile` do repo).
6. Restaurar o banco `sgu_api_production` no `10.193.0.20` — **se houver backup**.
7. Validar: `curl https://www.intranet.bombeiros.pe.gov.br/sgu/` deve responder
   `"CTIC/CBMPE API"`; depois testar um login real na Intranet.

> ⚠️ Se o `10.193.0.20` for perdido junto e não houver dump, os registros locais **se
> reconstroem sozinhos** conforme cada pessoa fizer login (o `ldap_create_user` recria o
> usuário a partir do AD). Perde-se o histórico de acesso, não o acesso. **O que não se
> reconstrói é o AD.**