# DW CBMPE — Arquitetura Técnica

> Ver [`DW_PLANEJAMENTO.md`](DW_PLANEJAMENTO.md) para o log de decisões que
> fundamenta este documento. Este arquivo descreve a arquitetura proposta —
> partes marcadas como "proposta" ainda não foram confirmadas pelo usuário.

## Visão geral

> Revisado em 2026-08-07 — arquitetura recalculada em torno de 3
> objetivos explícitos do usuário (coleta de fontes dispersas, banco
> central normalizado, conexão dupla comum + granular). Ver log de
> decisões em [`DW_PLANEJAMENTO.md`](DW_PLANEJAMENTO.md).

```
Fontes internas (sistemas já persistidos, ex. SGP)   Fontes externas (sistemas externos, Google Sheets...)
        │                                                       │
        │ (acesso direto p/ granular;                            ▼
        │  "principais dados" extraídos p/ core)         [Windmill self-hosted, rede interna]
        │                                                 coleta → grava em
        │                                                       │
        │                                                       ▼
        │                                     PostgreSQL (servidor interno da corporação)
        │                                        raw → staging  (fidelidade da fonte —
        │                                                         também serve consulta granular)
        │                                                       │
        │                                                       ▼
        └───────────────────────────────────────────►    core (NORMALIZADO, 3FN — integra
                                                            todas as fontes, "principais dados")
                                                                  │
                                                                  ▼
                                                            marts (DIMENSIONAL — fato/dimensão,
                                                             construído a partir do core)
                                                                  │
                                    ┌─────────────────────────────┴───────────────────────────┐
                                    ▼                                                           ▼
                          API (proposta: FastAPI) ──► App React                    Power BI / Metabase
                          consultas comuns/estatísticas                             (2 tipos de conexão:
                                                                                      1. core/marts — comum
                                                                                      2. direto nas fontes
                                                                                         originais — granular)
```

**Windmill** (decisão de 2026-08-07, ver log em
[`DW_PLANEJAMENTO.md`](DW_PLANEJAMENTO.md)) é o motor de execução do ETL:
já está self-hosted na rede interna da corporação. Nosso trabalho de
planejamento/implementação se resume, do lado do ETL, a identificar os
dados (catálogo de fontes) e escrever os scripts Python que o Windmill
roda. **O Windmill só grava no Postgres — ele não serve dados para o app**;
a camada de API descrita abaixo continua necessária e não é substituída
por ele. Para fontes **externas** (objetivo 1), o Windmill é quem faz a
coleta de fato (Google Sheets, sistemas externos) e grava em `raw`/
`staging`. Para fontes **internas** já persistidas (ex. SGP), o Windmill
extrai só os "principais dados" para popular o `core` — o restante do
dado da fonte interna não passa pelo Windmill, é acessado direto na
origem (ver seção de acesso granular abaixo).

## Infraestrutura

- **Banco**: PostgreSQL já existente em servidores internos da corporação
  (decisão de 2026-08-07, ver log em `DW_PLANEJAMENTO.md`).
- **Conectividade**: acesso via VPN já configurada a partir da máquina de
  desenvolvimento.
- **Ambientes**: um único ambiente por enquanto — sem dev/homolog/prod
  formal. Reavaliar quando o time crescer ou o volume de mudanças aumentar.
- **Provisionamento**: o usuário tem privilégios de administração no
  Postgres interno (pode criar databases/schemas diretamente).

## Execução do ETL: Windmill

- **Hospedagem**: self-hosted, dentro da rede interna da corporação — sem
  exposição para fora (nem restrita). Alcançável apenas de dentro da
  rede/VPN.
- **Papel**: executa os scripts Python de ETL (extração das fontes, carga
  nas camadas `raw`/`staging`/`core`/`marts` do Postgres). Não expõe
  dados para o app React nem para ferramentas de BI — essas leituras
  continuam passando pela API (proposta) e pela conexão direta ao schema
  `marts`, respectivamente.
- **Segredos**: credenciais de banco e de fontes de dados ficam nos
  *resources*/*variables* nativos do Windmill — os scripts as consomem em
  tempo de execução, sem `.env` local (ver detalhe em
  [`DW_ETL.md`](DW_ETL.md)).
- **Publicação dos scripts**: sincronização manual via CLI (`wmill sync
  push`, git sync oficial do Windmill — [docs](https://www.windmill.dev/docs/advanced/git_sync)),
  com um script wrapper no repositório para reduzir fricção. Não há CI
  automático: o Windmill só é alcançável de dentro da rede interna, e
  runners padrão do GitHub Actions (nuvem da GitHub) não chegam nele. Um
  self-hosted runner interno foi considerado e descartado por ora, em
  favor de simplicidade de manutenção solo — ver alternativa descartada
  em `DW_PLANEJAMENTO.md`.
- **Workspace**: ainda não existe — precisa ser criado pelo usuário antes
  de configurar o git sync (`wmill.yaml`) e gerar o token de API.
- **Agendamento**: usa o agendamento nativo do Windmill por script/flow
  (substitui a proposta anterior de Task Scheduler/cron — ver
  [`DW_ETL.md`](DW_ETL.md)), o que já acomoda a frequência variando por
  domínio.

## Camadas do banco (schema por camada, dentro do mesmo Postgres)

| Schema | Papel | Conteúdo |
|---|---|---|
| `raw` | Pouso dos dados brutos, sem transformação. **Também é o destino da coleta de fontes externas** (objetivo 1) | Uma tabela por fonte/extração, o mais próximo possível do formato original |
| `staging` | Limpeza, padronização de tipos, deduplicação | Dados já tipados, ainda por domínio de origem — fidelidade da fonte preservada |
| `core` | **Modelo relacional normalizado** (3FN-like) — integra dado de todas as fontes numa estrutura só, com FKs reais entre entidades | Uma tabela por entidade (unidade, militar, viatura...), com "principais dados" — ver critério de inclusão em `DW_PLANEJAMENTO.md` (ver [`DW_MODELO_DADOS.md`](DW_MODELO_DADOS.md)) |
| `marts` | Camada **dimensional** (fato/dimensão, estilo Kimball), construída a partir do `core` | Views/materialized views otimizadas para o app e consultas estatísticas comuns |

Motivo da separação: isola o impacto de mudanças na fonte (`raw`),
permite reprocessar transformações sem reextrair (`staging` → `core`), dá
um modelo central flexível pra cruzar qualquer entidade (`core`
normalizado — objetivo 2), e um contrato de leitura performático pra quem
consome com frequência (`marts` dimensional — objetivo 3).

**Mudança de 2026-08-07**: `core` deixou de ser desenhado como esquema
estrela por domínio (decisão original desta sessão de planejamento) e
passou a ser o banco centralizado normalizado descrito no objetivo 2 do
usuário. O esquema estrela não foi abandonado — migrou para `marts`, que
é construído a partir do `core` normalizado. As entidades já identificadas
na análise do SGP (militar, unidade, movimentação, promoção, afastamento,
inativação etc. — ver [`DW_MODELO_DADOS.md`](DW_MODELO_DADOS.md))
continuam válidas, só mudam de forma: viram tabelas normalizadas no
`core`, com views dimensionais correspondentes em `marts`.

## Acesso granular às fontes originais (objetivo 3)

Consultas de alta granularidade/especificidade — o que o Comandante Geral
quer poder fazer sobre *qualquer* dado da corporação — não passam pelo
`core`/`marts`. Acontecem por **conexão direta às fontes originais**:

- **Fontes internas já persistidas** (ex. SGP, schema `ovrsgp`): conexão
  direta ao banco de origem. O `core` do DW só tem os "principais dados"
  extraídos dessa fonte — o resto continua só lá, acessível por quem tem
  essa conexão.
- **Fontes externas coletadas** (objetivo 1): conexão direta às camadas
  `raw`/`staging` do próprio Postgres do DW, que preservam a fidelidade
  da fonte original (não passam pela normalização do `core`).
- **Mecanismo**: ferramenta de BI (Power BI/Metabase) com múltiplas
  conexões configuradas — uma para `core`/`marts` (visão analítica
  comum), outra(s) direto nas fontes originais (visão granular). Decisão
  de 2026-08-07, ver `DW_PLANEJAMENTO.md`.
- **Acesso do Comandante Geral**: irrestrito a tudo isso, incluindo dado
  sensível (saúde, bancário, dependentes do SGP), sem camada extra de
  auditoria — decisão explícita do usuário, por definição do cargo máximo
  da corporação. Demais perfis seguem o controle de acesso por role/schema
  de [`DW_GOVERNANCA.md`](DW_GOVERNANCA.md).
- Configuração prática (quantas conexões, credenciais por fonte) fica
  para a fase de implementação — ver pergunta em aberto em
  `DW_PLANEJAMENTO.md`.

## Camada de API (proposta em aberto)

**Atualização de 2026-09-23 — não confundir com o backend que já existe.**
Desde 2026-09-23 há um backend Node/Express pequeno em `backend/`: autentica
via SGU, e serve/edita o estado administrativo do app (organograma,
atribuições de perfil — `backend/data/*.json`, sem banco próprio). Ele
**não** é a API descrita nesta seção — não consulta `marts` nem qualquer
schema do DW, só arquivos JSON locais ao próprio backend. A pergunta em
aberto abaixo (API que consulta `marts` pra servir `fetchUnidades()` etc.
com dado real, em vez dos mocks de `src/data/organograma.js`) continua sem
resposta — o app React continua uma SPA que não se conecta ao Postgres
diretamente, só que agora tem esse backend auxiliar para autenticação e
estado editável.

O app React hoje é uma SPA estática sem backend de dados — não pode se
conectar diretamente ao Postgres a partir do navegador (nem por segurança,
nem tecnicamente). É necessária uma API intermediária.

**Proposta inicial**: Python/FastAPI.
- Motivo: mesmo stack do ETL (Python), permite reaproveitar modelos de dados
  e código de acesso ao banco (ex. SQLAlchemy), e o time é uma pessoa só —
  menos contexto para alternar entre linguagens.
- Alternativa possível: Node/Express, para manter o app inteiro em
  JavaScript/TypeScript. Não descartada, apenas não é a proposta inicial.
- **Esta escolha não foi confirmada pelo usuário — está registrada como
  pergunta em aberto em `DW_PLANEJAMENTO.md`.**

A API consultaria o schema `marts` (nunca `raw`/`staging`/`core`
diretamente) e exporia endpoints consumidos pelos pontos de integração já
existentes em `src/lib/cbmpe.js`: `fetchUnidades()`, `fetchIndicadores()`,
`fetchDashboards()`, `fetchAlertas()` — hoje mockados a partir de
`src/data/organograma.js`, e documentados no próprio `AGENTS.md` como o
seam de troca para uma fonte real.

## Conexão com Power BI / Metabase

Duas finalidades distintas, não confundir:

1. **Consulta comum/estatística**: acesso direto ao schema `marts` via um
   usuário Postgres **somente leitura**, sem passar pela API. Padrão de
   mercado para ferramentas de BI que já falam nativamente com Postgres —
   evita duplicar lógica de acesso a dado na API só para servir essas
   ferramentas.
2. **Consulta granular** (objetivo 3): conexões adicionais, diretas às
   fontes originais — ver seção "Acesso granular às fontes originais"
   acima. Mesma ferramenta, conexões diferentes.

## Nota crítica: conexão do app antes da migração para o servidor interno

Hoje o app roda só na Vercel (fora da rede interna da corporação). Enquanto
isso for verdade:
- O app **não deve** ter acesso direto ao Postgres interno — ele está numa
  rede pública, e o banco tem dado sensível (PII, ver
  [`DW_GOVERNANCA.md`](DW_GOVERNANCA.md)).
- Expor a futura API publicamente para a Vercel conseguir chamá-la
  entraria em conflito com a política de acesso só-VPN da infraestrutura
  interna.

**Isto é uma decisão em aberto, não resolvida nesta fase**: a estratégia de
conexão pré-migração (app na Vercel) vs. pós-migração (app + API dentro da
rede interna) precisa ser definida antes de implementar a API. Duas linhas
possíveis a avaliar quando chegarmos lá:
1. Adiantar a migração do app para o servidor interno antes de ligar a API
   real (evita expor qualquer coisa publicamente).
2. Expor só um subconjunto de endpoints agregados (sem PII) publicamente,
   atrás de autenticação, até a migração acontecer.

## Dependências entre documentos

- O modelo de dados (`DW_MODELO_DADOS.md`) define o que existe em `core` e
  `marts`.
- O catálogo de fontes (`DW_CATALOGO_FONTES.md`) define o que chega em
  `raw` e com que frequência.
- O desenho de ETL (`DW_ETL.md`) define como os dados se movem entre as
  camadas.
- A governança (`DW_GOVERNANCA.md`) define quem pode acessar o quê em cada
  camada.

## Deploy no CapRover (documentado em 2026-08-24)

A Seção de Sistemas já tem plataforma de deploy interna: **CapRover** em
`caprover-01` (`10.193.1.252`), PaaS sobre Docker Swarm. É o mesmo servidor
onde o DW está. Procedimento completo em
`docs/intranet/operacao-e-recuperacao-de-desastre.md`.

Isso resolve o impasse de rede: **a Vercel não alcança o DW** (`10.193.1.252`
é endereço privado), e por isso o app hoje só consome JSON estático gerado
pelos extratores. Rodando no CapRover, o app fica do lado de dentro.

### O que já está pronto no repositório

| Arquivo | Papel |
|---|---|
| `Dockerfile` | Multi-stage: build do Vite, depois nginx servindo `dist/` |
| `nginx.conf` | `try_files ... /index.html` — necessário para o BrowserRouter |
| `captain-definition` | Aponta o CapRover para o `Dockerfile` |

Deploy: `caprover deploy -a <app> -b main`. O CapRover recebe o código e
constrói a imagem — não há registry, o build é do zero a cada vez.

### O que NÃO está no repositório e será esquecido

O wiki é enfático sobre isso, e a advertência vale igual para nós:

1. **Port Mapping manual no painel.** É configuração de painel, não de
   arquivo. Para o `auth-api` é `9090 → 3000`; **para o nosso app o destino é
   a porta 80**, que é onde o nginx do `Dockerfile` escuta. Sem isso, o
   `proxy_pass` bate em porta fechada e não há mensagem de erro que aponte
   para a causa.
2. **Vhost no proxy reverso.** A entrada pública passa por `srv-nginx01`
   (`10.193.0.19`), com um `location` por sistema. Depende de quem administra
   esse servidor.
3. **As envs vão para os App Configs do CapRover**, que a documentação trata
   como fonte da verdade — e os valores, para o cofre `cofre-sistemas.kdbx`.
   Ver `DW_GOVERNANCA.md`.
4. **Sem `Has Persistent Data`**: nosso app é stateless, igual ao `auth-api`.

### O app exige a raiz de um host (verificado em 2026-08-26)

Achado ao preparar a solicitação de deploy, e que precisa ser resolvido
**antes** do primeiro deploy: o `vite.config.js` não define `base` e o
`App.jsx` usa `BrowserRouter` sem `basename`. O `dist/index.html` gerado
referencia os arquivos como `/assets/...`, em caminho absoluto.

Consequência: se o app for publicado sob um subcaminho — no padrão do
`location /sgu` que a Seção usa hoje — a página carrega em branco e as rotas
internas dão 404. O padrão vigente da Intranet é justamente o subcaminho, ou
seja, a colisão é o caso provável, não o excepcional.

Duas saídas, e a escolha é de quem administra o proxy reverso:

| Caminho | Custo |
|---|---|
| Subdomínio/host próprio (ex.: `bi.intranet.bombeiros.pe.gov.br`) | Zero — funciona como está |
| Subcaminho | Definir `base` no Vite e `basename` no `BrowserRouter`, recompilar e testar |

### Duas lições do sistema vizinho, de graça

O wiki registra que o `.env.example` do `auth-api` está defasado e que o
GitHub Actions do repositório ainda dispara deploy para um destino que não é
produção. As duas coisas envelhecem em silêncio e só aparecem no dia em que
alguém precisa recriar o sistema. Vale conferir periodicamente que o nosso
`.env.example` acompanha o `.env.local` — ele estava defasado até 2026-08-24.

