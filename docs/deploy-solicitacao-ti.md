# Solicitação de deploy — CBMPE BI (Painel do Comandante)

Documento para encaminhamento à Seção de Tecnologia. Descreve o que já está
pronto do nosso lado, o que precisa ser feito no ambiente da corporação, e as
decisões que dependem do TI antes de começarmos.

> **Dimensionamento e portas atualizados em `docs/deploy-pedido-vm-ati.md` (2026-10-08).**

Repositório: `dw-cbmpe` · Branch `main` · Data: 26/08/2026
(revisado em 26/08/2026 — ver seção 1, item 3: apareceu um segundo caminho de
exposição de dado nominal que não existia quando este documento foi escrito)

---

## 1. O que é o sistema

Duas partes, que hoje vivem separadas e precisam ser reunidas no ambiente
interno:

| Parte | O que é | Onde está hoje |
|---|---|---|
| **Aplicação** | SPA React (Vite), estática, sem backend próprio | Vercel (nuvem pública) |
| **Data warehouse** | PostgreSQL, banco `dw`, no `caprover-01` (`10.193.1.252`) | Já em produção interna |

Hoje a aplicação **não lê o data warehouse**. Ela consome arquivos JSON
estáticos, gerados manualmente por scripts que rodam na máquina do
desenvolvedor via VPN e são commitados no repositório. Isso funciona, mas tem
dois limites que motivam este deploy:

1. **A Vercel está fora da rede da corporação** e não alcança `10.193.1.252`.
   Enquanto a aplicação estiver lá, o dado só se atualiza quando alguém roda a
   extração à mão e faz um novo deploy.
2. **O dado publicado é efetivamente público, e inclui dado nominal.** Os JSONs
   são embutidos no pacote JavaScript em tempo de compilação. O login da
   aplicação é feito no próprio navegador, ou seja, **o pacote com os dados é
   entregue antes de qualquer autenticação**. Quem abrir as ferramentas de
   desenvolvedor lê o conteúdo sem logar.

   O que está nesse pacote hoje, medido em 26/08/2026 no arquivo gerado:
   **nome completo, matrícula, idade e sexo dos 2.658 militares da ativa**, e,
   dentro do sub-objeto `completo` de cada um, **raça/cor (2.658 registros),
   telefone (2.043), PCD, readaptado, licenças (LE/LTIP), afastamento acima de
   90 dias e datas de ingresso, promoção e movimentação**
   (`efetivo_lista.json`, 2,7 MB). Some-se a função por matrícula de outros
   2.356 (`lotacao_funcao.json`, 1,0 MB — **removido em 2026-10-06**, agora só pelo backend). Raça/cor e dado de saúde são
   categoria especial pela LGPD.

   Isso foi uma exceção deliberada, registrada em `DW_PLANEJAMENTO.md`
   (2026-08-07 e 2026-08-11), tomada quando a suposição era que o login
   protegia o conteúdo. **A suposição estava errada** — e é o principal motivo
   técnico para trazer a aplicação para dentro da rede.

3. **Há um segundo caminho, mais direto que o primeiro, aberto depois que este
   documento foi escrito.** O painel de Mapa de Força não embute os dados no
   pacote: ele os **busca em tempo de execução** de arquivos servidos como
   conteúdo estático, em `/dados/mapa-forca/`. **(Resolvido em 2026-10-06: os
   arquivos foram removidos; o Mapa de Força passou a vir do backend, com login
   e recorte por perfil.)** Eram **91 arquivos, 11,5 MB**, um por dia dos
   últimos 90 dias.

   Cada lançamento traz a guarnição nominal — **matrícula, posto/graduação,
   nome de guerra e função** de cada militar escalado. Em 24/08/2026 são 570
   militares escalados em 290 lançamentos; na janela inteira, 73.627 registros
   de escala.

   A diferença em relação ao item 2 é que aqui **não é preciso nem abrir o
   pacote JavaScript**: basta pedir a URL do arquivo. Qualquer pessoa com o
   endereço do site baixa a escala de serviço de 90 dias com um `curl`. Isso
   torna a migração para a rede interna mais urgente, não menos.

Trazer a aplicação para dentro resolve os três de uma vez.

---

## 2. O que já está pronto (nada a fazer pelo TI)

### 2.1 Data warehouse — em produção

Roda no PostgreSQL do `caprover-01` (`10.193.1.252`), banco `dw`, em quatro
camadas (`raw_*` → `stg` → `core` → `marts`):

- **15 tabelas de dimensão** (militar, OME, posto/graduação, viatura, tempo,
  tipo de serviço, órgão externo, entre outras)
- **8 tabelas fato** (efetivo diário, frota diária, lançamentos operacionais,
  averbação, afastamento e previsão de reserva)
- **10 views de consumo** no schema `marts`
- Todas as verificações de regra de negócio do `etl/dw/validar.py` passando

> O schema `public` desse mesmo banco pertence ao Metabase e **não é tocado**
> por nós.

### 2.2 Arquivos de deploy — prontos no repositório

| Arquivo | O que faz |
|---|---|
| `Dockerfile` | Build multi-stage: `node:20-alpine` compila a SPA, `nginx:1.27-alpine` serve. `EXPOSE 80` |
| `nginx.conf` | `try_files $uri $uri/ /index.html` — obrigatório, o roteamento é client-side |
| `captain-definition` | `schemaVersion 2`, apontando para o `Dockerfile` |

O comando de deploy é o mesmo padrão dos demais apps da Seção:

    caprover deploy -a <nome-do-app> -b main

`npm run build` foi executado e passa. Medido em 26/08/2026:

| Item | Tamanho |
|---|---|
| Pacote JavaScript | 5,9 MB (879 KB comprimido) |
| `dist/` inteiro | **21 MB** |
| — dos quais `dados/` (Mapa de Força, buscado em execução) | 11,5 MB |
| — dos quais `insignias/` (39 PNG de brasão) | 2,4 MB |

O `dist/` é conteúdo estático puro: nginx serve, não há processo de aplicação.
Consumo de memória e CPU é o do próprio nginx.

> ⚠️ **Ressalva honesta:** a **imagem Docker nunca foi construída**. Não há
> Docker instalado na máquina de desenvolvimento. O passo que costuma falhar
> — o `npm run build` — está verificado; o empacotamento em si, não. Espere
> possibilidade de ajuste no primeiro build.

### 2.3 Autenticação — o caminho já está definido

O sistema **não terá base de senhas própria**. Vai autenticar pelo **SGU**
(`auth-api`), como os demais sistemas da Intranet:

    POST https://www.intranet.bombeiros.pe.gov.br/sgu/api/v1/auth/sign_in
    { "username": "<CPF, só dígitos>", "password": "<senha do AD>" }

Tokens vêm nos **cabeçalhos** da resposta (`access-token`, `client`, `uid`),
validade de 24h, sem refresh.

Medimos a cobertura: **2.615 dos 2.658 militares da ativa (98,4%) já possuem
conta no SGU**. Praticamente ninguém precisa de cadastro novo.

O SGU faz **apenas identidade**. A autorização (quem vê o quê) é nossa e já
está modelada no repositório, resolvida contra a hierarquia do nosso próprio
organograma.

---

## 3. O que pedimos ao TI

### 3.1 Duas decisões, antes de qualquer configuração

**Decisão A — endereço público: subdomínio ou subcaminho?**

Este é o ponto mais importante e precisa ser respondido antes de mexermos no
código.

A aplicação hoje **assume que é servida na raiz de um host**. Os arquivos são
referenciados como `/assets/...` e o roteador não tem prefixo configurado. Se
for publicada sob um subcaminho — no padrão do `location /sgu` — a página
carrega em branco e as rotas internas dão 404.

| Opção | O que implica |
|---|---|
| **Subdomínio ou host próprio** (ex.: `bi.intranet.bombeiros.pe.gov.br`) — **recomendada** | Funciona sem nenhuma alteração no código. Deploy imediato |
| **Subcaminho** (ex.: `.../bi`) | Precisamos do caminho exato para ajustar o `base` do Vite e o `basename` do roteador, recompilar e testar. Some ~1 dia |

Não há opção "tanto faz": qualquer uma serve, mas precisamos saber **qual**
antes do primeiro deploy.

**Decisão B — a aplicação sai da Vercel ou convive com ela?**

Se **migra**, os JSONs estáticos deixam de existir e a aplicação passa a ler o
data warehouse — é o desenho que recomendamos.

Se **convive**, é preciso antes remover o dado nominal do pacote publicado
(seção 1, item 2) — hoje ele sai junto, sem autenticação. Manter a versão
pública só é aceitável com o conteúdo reduzido a números agregados.

### 3.2 Criação do app no CapRover

Servidor `caprover-01` (`10.193.1.252`) — o mesmo onde o data warehouse já
roda.

1. Criar o app. **Sem `Has Persistent Data`** — o container é stateless, todo
   o estado está no PostgreSQL.
2. **Configurar o Port Mapping em *HTTP Settings* com destino a porta 80.**

   > 🔴 **Este é o passo que costuma ser esquecido.** Está registrado na
   > documentação da própria Seção como o "calcanhar de aquiles" do deploy do
   > SGU. Não está no `captain-definition` nem em nenhum arquivo do
   > repositório — é configuração manual no painel. Sem ele, o `proxy_pass`
   > bate em porta fechada e o sintoma não aponta para a causa.
   >
   > Atenção ao valor: no `auth-api` o mapeamento é `9090 → 3000` porque o
   > Rails escuta na 3000. **No nosso caso o destino é a porta 80**, que é
   > onde o nginx do `Dockerfile` escuta.

3. Cadastrar as variáveis em *App Configs* (seção 3.4).
4. Deployar.

### 3.3 Proxy reverso — `srv-nginx01` (`10.193.0.19`)

Criar a entrada pública conforme a Decisão A. Sem isso o app sobe no CapRover
e não tem endereço acessível.

**Precisamos saber quem administra este servidor** — é a dependência externa
com maior chance de travar o cronograma, e não sabemos a quem recorrer.

Observação técnica, para registro: do nginx até o container o tráfego é HTTP
puro dentro da rede interna. Como o login trafega CPF e senha, isso já vale
para o SGU hoje e valerá para nós.

### 3.4 Variáveis de ambiente

Cadastrar em *App Configs*, com os valores vindos do cofre
`cofre-sistemas.kdbx` — não de arquivo `.env` avulso. Sugerimos criar a entrada
`CBMPE BI (CapRover)` espelhando o `.env` inteiro, no mesmo padrão da entrada
do SGU.

| Variável | Para que serve |
|---|---|
| `VITE_AUTH_API_URL` | Endereço público do backend (login pelo SGU). Não há mais login administrativo fixo desde 2026-09-25 |
| `DATABASE_URL_DW` | Conexão de leitura do data warehouse |

> ⚠️ Variáveis `VITE_*` são embutidas em texto claro no pacote gerado. Não são
> segredo de servidor e não devem receber credencial de banco. A conexão com o
> data warehouse só passa a existir quando houver camada de servidor
> (seção 4.1).

### 3.5 Rotação de credenciais — pedido formal

Cinco credenciais deste projeto circularam em texto claro durante o
desenvolvimento e **precisam ser rotacionadas na origem**:

| Credencial | Situação |
|---|---|
| `datawarehouse-user` (PostgreSQL `10.193.1.252`) | **É superusuário.** Deveria ser um usuário comum |
| Dois usuários `neondb_owner` (bancos Neon) | Expostos |
| Usuário do banco de Frota | Exposto |
| Usuário `ctic` do SGP (`10.193.0.16`) | Exposto |
| Senha do administrador do BookStack (wiki da Seção) | Exposta — chegou até nós em texto claro |

Pedimos também a criação de três papéis de acesso separados, substituindo o uso
do superusuário:

- `etl_writer` — escrita nas camadas de carga
- `bi_reader` — leitura de `marts` (Metabase, Power BI)
- `app_reader` — leitura restrita, para a aplicação

Todos os valores novos devem ir para o `cofre-sistemas.kdbx`.

---

## 4. O que ainda falta do nosso lado

Transparência sobre o que **não** está pronto, para o cronograma não ser
montado sobre premissa falsa.

### 4.1 A aplicação ainda não lê o data warehouse

Uma SPA estática não abre conexão PostgreSQL. Para a aplicação consumir o DW é
preciso uma camada de servidor entre os dois. Ela **não existe ainda** e é o
maior item pendente. Enquanto isso, o deploy no CapRover entrega a aplicação
atual — com os mesmos JSONs estáticos, porém dentro da rede.

Ou seja: **o deploy pode acontecer antes disso e já tem valor**, mas não
entrega dado ao vivo.

### 4.2 Chaves estáveis nas dimensões

`dim_militar` e `dim_viatura` ainda geram chaves por ordem de linha, o que faz
a chave de um militar mudar entre cargas. Isso impede agendar a carga diária,
porque três tabelas de fato guardam foto diária e passariam a apontar para o
militar errado. É trabalho nosso, sem dependência do TI.

### 4.3 Repontar os extratores

Dois scripts ainda leem dos bancos Neon em vez do data warehouse. Precisam ser
migrados.

### 4.4 Integração com o SGU — desenhada, não implementada

O fluxo está documentado e a cobertura medida, mas o código de login ainda não
existe. Depende da camada de servidor (4.1).

---

## 5. Uma ressalva de segurança que precisa constar

Ao estudar o SGU, encontramos na documentação da própria Seção dois fatos que,
combinados, afetam o que este sistema pode exibir:

1. Usuário criado pelo SGU nasce com **senha igual ao próprio CPF**, com
   `userAccountControl = 66048` — **senha que nunca expira**.
2. A rota `GET /users` do SGU esteve **pública na internet**, devolvendo nome,
   CPF e e-mail de mais de 2.500 pessoas.

Juntos: quem nunca trocou a senha tem, como senha, um dado que esteve público.

Isso **não é motivo para não usar o SGU** — é a autenticação da corporação,
cobre 98,4% do efetivo, e construir outra seria pior. É motivo para duas
exigências no nosso sistema, que assumimos como requisito:

- **Exigir troca de senha no primeiro acesso** ao BI (ou, no mínimo, recusar
  senha igual ao CPF).
- **Não exibir lista nominal** a usuário autenticado apenas pelo SGU enquanto
  o item acima não existir. Números agregados, sim.

Vale registrar que hoje a situação é pior do que o cenário acima descreve: o
dado nominal descrito na seção 1 sai **sem autenticação nenhuma**. A exigência
de troca de senha trata do passo seguinte; o passo imediato é a aplicação parar
de embarcar esse dado no pacote público.

Adotamos ainda a regra já registrada pela Seção de que **logs do SGU contêm CPF
e não devem ser colados em ferramentas externas**.

---

## 5.1 Dá para fazer o deploy hoje?

**Dá — com uma condição.** O que está pronto do nosso lado é suficiente para o
app subir no CapRover e atender pela rede interna: `Dockerfile`, `nginx.conf`,
`captain-definition`, build compilando, e o conteúdo é estático (sem processo
de aplicação, sem banco em tempo de execução, sem volume).

A condição é a **borda**. Enquanto o login for o que é hoje — verificação
feita no próprio navegador, com a senha embutida em texto claro no pacote —,
ele **não protege nada**: os arquivos de `/dados/` respondem a qualquer
requisição, autenticada ou não. Então:

- **Publicar apenas dentro da rede interna, sem exposição para a internet**,
  até a integração com o SGU existir. É a condição mínima, e é o que o
  `srv-nginx01` já faz para os demais sistemas.
- Se houver qualquer chance de o vhost ficar acessível de fora, pedir ao TI
  uma proteção na borda (restrição por faixa de IP ou autenticação básica no
  proxy) enquanto a autenticação de verdade não entra.

Com essa condição atendida, o deploy **melhora** a situação atual em vez de
piorá-la: hoje o mesmo conteúdo está na Vercel, aberto para a internet inteira.

## 6. Resumo executivo

**Pronto:** data warehouse em produção interna, validado; `Dockerfile`,
`nginx.conf` e `captain-definition` no repositório; build compilando; caminho
de autenticação definido com 98,4% de cobertura.

**Depende do TI:** responder as duas decisões da seção 3.1; criar o app no
CapRover **com Port Mapping para a porta 80** e sem volume; criar a entrada no
`srv-nginx01`; cadastrar as variáveis a partir do cofre; rotacionar as cinco
credenciais e criar os três papéis de leitura.

**Ainda nosso:** camada de servidor para a aplicação ler o DW; chaves estáveis
nas dimensões; repontar os extratores; implementar o login pelo SGU.

**Não verificado:** a imagem Docker nunca foi construída — não há Docker na
máquina de desenvolvimento.

**Condição para subir:** publicar só na rede interna enquanto o login não
passar pelo SGU. Ver seção 5.1.

## Atualização de 01/10/2026

O deploy está em **standby**: o TI informou que está pedindo à ATI uma VM com os acessos ao
firewall interno. Dados já medidos para o pedido: banco `dw` com 626 MB; o app não
armazena nada além do banco (o backend é Node/Express, sem estado em disco desde 25/09). O
**quadro de recursos** (vCPU, RAM, disco, IOPS, backup) e a **lista de portas de firewall**
ainda precisam ser fechados antes do envio. Novidade para o TI: o JSON de Finanças saiu do
pacote; os demais domínios seguem a migração para o DW.
