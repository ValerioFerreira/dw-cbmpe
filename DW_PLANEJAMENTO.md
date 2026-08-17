# DW CBMPE — Planejamento (documento-mestre)

> Este é o documento-âncora do planejamento do data warehouse do CBMPE.
> Toda decisão relevante é registrada aqui primeiro, com data e motivo, antes
> de ser refletida nos demais documentos `DW_*.md`. O objetivo é nunca perder
> a linha de raciocínio entre sessões de trabalho.

## Documentos relacionados

- [`DW_ARQUITETURA.md`](DW_ARQUITETURA.md) — arquitetura técnica (camadas do
  banco, infraestrutura, API, conexão com ferramentas de BI).
- [`DW_MODELO_DADOS.md`](DW_MODELO_DADOS.md) — modelo de dados (dimensões e
  fatos), hipótese inicial sujeita a validação.
- [`DW_CATALOGO_FONTES.md`](DW_CATALOGO_FONTES.md) — catálogo de fontes de
  dados por domínio, checklist de descoberta.
- [`DW_ETL.md`](DW_ETL.md) — desenho do pipeline de ETL.
- [`DW_GOVERNANCA.md`](DW_GOVERNANCA.md) — segurança, LGPD e controle de
  acesso.
- [`DW_PROCESSO_INTEGRACAO.md`](DW_PROCESSO_INTEGRACAO.md) — como
  trabalhamos toda vez que uma nova fonte de dados é integrada ao DW.
  **Leitura obrigatória antes de propor qualquer integração de fonte.**

## Contexto e objetivo

O `dw-cbmpe` hoje é uma SPA React+Vite estática, sem backend, rodando sobre
dados fictícios gerados em `src/data/organograma.js` (ver
[`AGENTS.md`](AGENTS.md)). A partir de 2026-08-07 começamos a construção do
**data warehouse real** do CBMPE — desde a concepção até a entrega —
cobrindo aquisição de dados (ETL), arquitetura do banco, modelo de tabelas e
conexão com as ferramentas de consumo (o app React e, futuramente, Power
BI/Metabase).

**Premissa fundamental**: nenhuma suposição sobre onde os dados reais estão
hoje ou como estão modelados deve ser feita a priori. O contrato de dados do
app atual (`organograma.js`, `src/lib/cbmpe.js`) é **referência histórica de
UI**, não especificação — nenhuma visualização atual está congelada; as
visualizações finais serão definidas com o gestor principal da corporação em
uma fase futura (ver [Perguntas em aberto](#perguntas-em-aberto)).

## Log de decisões

Formato: data · decisão · motivo/contexto · alternativas descartadas (quando
houver).

### 2026-08-07 — Escopo da Fase 1 do DW
**Decisão**: cobrir os domínios Organograma, Efetivo/RH, Frota, Financeiro e
Atividades Operacionais. Materiais/Patrimônio fica para uma fase posterior.
**Motivo**: já existem dados suficientes para montar a base nesses domínios,
mesmo que nenhum esteja 100% completo; Materiais foi explicitamente
excluído por ora.

### 2026-08-07 — Fontes de dados são mistas
**Decisão**: os dados reais vêm de uma combinação de sistemas internos,
planilhas e sistemas externos, variando por domínio. Não há uma fonte única.
**Motivo**: resposta direta do usuário; nenhuma fonte específica foi
assumida previamente.
**Próximo passo**: levantamento fino por domínio em
[`DW_CATALOGO_FONTES.md`](DW_CATALOGO_FONTES.md).

### 2026-08-07 — Infraestrutura: PostgreSQL interno já existente
**Decisão**: o DW será construído sobre um banco **PostgreSQL** já existente
em servidores internos da corporação. O app React (hoje só na Vercel) será,
em uma fase futura, também deployado nesse servidor interno.
**Motivo**: infraestrutura institucional já disponível, evita provisionar
banco gerenciado externo.

### 2026-08-07 — Conectividade via VPN
**Decisão**: a máquina de desenvolvimento acessa a rede interna (e portanto
o Postgres) através de uma VPN já configurada.
**Motivo**: resposta direta do usuário — permite desenvolver e testar já
apontando para infraestrutura real, sem precisar de um banco local
intermediário.

### 2026-08-07 — Time de manutenção
**Decisão**: só o usuário mantém o projeto, com apoio do Claude Code.
**Motivo**: define o critério de simplicidade em todas as escolhas técnicas
seguintes — preferir poucas peças móveis a arquiteturas sofisticadas de
time grande.

### 2026-08-07 — Stack do ETL: Python
**Decisão**: o ETL será construído em Python.
**Motivo**: ecossistema mais forte para engenharia de dados (pandas,
psycopg2/SQLAlchemy, agendadores), aceito mesmo introduzindo uma 2ª
linguagem no repositório (o app é Node/React).
**Alternativa descartada**: Node.js/TypeScript (manteria um único stack,
mas ecossistema de ETL mais pobre).

### 2026-08-07 — Frequência de atualização varia por domínio
**Decisão**: não existe uma cadência única; cada domínio terá sua própria
frequência (a definir no catálogo de fontes — ex. financeiro semanal,
atividades diário, organograma raramente muda).
**Motivo**: resposta direta do usuário.

### 2026-08-07 — Sensibilidade de dados é mista (LGPD)
**Decisão**: os dados de RH/efetivo incluem uma mistura de dado
identificável (PII) e dado agregado, dependendo do relatório. O modelo de
dados e o controle de acesso precisam separar essas duas camadas.
**Motivo**: resposta direta do usuário; implica em classificação de
sensibilidade por domínio (ver [`DW_GOVERNANCA.md`](DW_GOVERNANCA.md)).

### 2026-08-07 — Consumo do DW: app React + BI externo
**Decisão**: o DW deve alimentar não só o app React, mas também ferramentas
de BI como Power BI/Metabase.
**Motivo**: resposta direta do usuário — implica em modelo de dados limpo o
suficiente para ser consumido por ferramentas de BI externas (schema
`marts`), não só por queries ad-hoc do app.

### 2026-08-07 — Um único ambiente por enquanto
**Decisão**: sem separação formal dev/homologação/produção nesta fase.
**Motivo**: simplicidade para manutenção solo; será formalizado mais
adiante se necessário.

### 2026-08-07 — Provisionamento de banco
**Decisão**: o usuário tem privilégios de administração no PostgreSQL
interno e pode criar databases/schemas diretamente, sem depender de DBA.
**Motivo**: resposta direta do usuário — simplifica o fluxo de
provisionamento nas próximas fases.

### 2026-08-07 — Modelagem: esquema estrela por domínio
**Decisão**: o modelo de dados usará esquema estrela (dimensões + fatos)
por domínio, **sem** amarrar ao formato genérico "Indicador" do mock atual.
**Motivo**: nenhuma visualização do app atual está definida ou congelada —
o usuário vai definir com o gestor principal da corporação quais gráficos e
visualizações são necessários. Logo, não faz sentido desenhar o modelo em
função do contrato de UI existente.
**Alternativas descartadas**: manter o padrão genérico de "Indicador"
(rejeitado por não ser o objetivo real); modelo híbrido com camada de
compatibilidade com o app atual (rejeitado pelo mesmo motivo — não há
contrato de UI a preservar).

### 2026-08-07 — Camada de API entra no planejamento agora
**Decisão**: o desenho da API que vai conectar o app React ao DW entra
nesta fase de planejamento, junto com o desenho do banco.
**Motivo**: o app não tem backend hoje (SPA estática) e não pode se
conectar diretamente ao Postgres a partir do navegador — a API é uma peça
obrigatória da arquitetura, não um detalhe posterior.

### 2026-08-07 — DGA: posição confirmada no organograma, unidade ainda não criada
**Decisão**: a DGA (Diretoria de Gestão Administrativa) **ainda não existe
de fato** na corporação — será criada — mas deve permanecer no organograma
na posição já presente no sistema: subordinada direta de `SUBCOMANDO
GERAL` (junto de DGO, GSG, AJG, CPP), tipo `diretoria`, com DGP, DVP, DJD,
DF, DAS, DTIC, DLOG, DEIP e DPLAG como subordinadas diretas dela. Essa
posição hierárquica é confirmada pelo usuário — deixa de ser hipótese
derivada do mock e passa a ser fato institucional a preservar.
`dim_unidade` (ver [`DW_MODELO_DADOS.md`](DW_MODELO_DADOS.md)) ganha um
atributo `status` (`ativa` / `planejada`) para representar isso: a DGA
existe estruturalmente no modelo desde já, mas não deve ter linhas em
tabelas fato até ser oficialmente criada.
**Motivo**: resposta direta do usuário — o sistema precisa já considerar a
DGA no organograma, sem gerar dados reais para ela antes de existir.
**Alternativa descartada**: não modelar a DGA agora e só adicioná-la
quando for criada de fato (rejeitada — o usuário quer a posição reservada
desde já).

### 2026-08-07 — Fluxo de trabalho para integrar novas fontes de dados
**Decisão**: sempre que o usuário compartilhar uma nova fonte de dados, o
fluxo é: (1) ele envia a fonte; (2) antes de qualquer proposta de
integração, esclarecer todas as dúvidas possíveis sobre ela; (3) só depois
de entendimento completo, desenhar como ela se integra à estrutura atual
do DW (tabelas, chaves, relações), atualizando os documentos `DW_*.md`
pertinentes. Esse processo está detalhado em
[`DW_PROCESSO_INTEGRACAO.md`](DW_PROCESSO_INTEGRACAO.md) e é uma regra
permanente do projeto, válida em qualquer sessão futura.
**Motivo**: resposta direta do usuário — evita desenhar integração de
dados antes de compreender completamente a fonte, e garante que esse
comportamento não se perca entre sessões (`/compact`, `/clear`).
**Como foi garantido**: o usuário escolheu combinar três mecanismos de
persistência — regra curta em `AGENTS.md` (carregado automaticamente em
toda sessão), o documento `DW_PROCESSO_INTEGRACAO.md` com o passo a passo
completo, e uma skill de projeto
(`.claude/skills/integrar-fonte-dw/SKILL.md`) para ritualizar/auto-sugerir
o fluxo quando uma fonte nova aparecer.

### 2026-08-07 — Motor de execução do ETL: Windmill self-hosted
**Decisão**: todo o ETL (coleta e carga no DW) é executado pelo
**Windmill**, já self-hosted e conectado à rede interna da corporação —
não por um agendador genérico (cron/Task Scheduler) como havia sido
proposto inicialmente em `DW_ETL.md`. Nosso trabalho de planejamento passa
a ser: identificar os dados (catálogo de fontes) e escrever os scripts
Python que o Windmill executa; o app/sistema então lê os resultados do
Postgres (DW) — **o Windmill não serve dados para o app** (não substitui a
API já registrada como pergunta em aberto).
**Motivo**: infraestrutura de orquestração já existe e já está na rede
interna — reaproveitar em vez de montar agendamento próprio.
**Alternativa descartada**: Task Scheduler/cron por script, proposto antes
de sabermos da existência do Windmill (ver versão anterior de
`DW_ETL.md`).

### 2026-08-07 — Segredos do ETL via Windmill (resources/variables)
**Decisão**: credenciais de banco e de fontes de dados usadas pelos
scripts Python ficam nos **resources/variables nativos do Windmill**, não
em `.env` local.
**Motivo**: resposta direta do usuário — evita duplicar gestão de segredo
fora da ferramenta que já vai executar os scripts.
**Alternativa descartada**: `.env` versionado fora do Windmill (proposta
anterior em `DW_ETL.md`, superada).

### 2026-08-07 — Sincronização dos scripts com o Windmill: manual via CLI
**Decisão**: publicar os scripts Python deste repositório no Windmill via
sincronização **manual** com o CLI oficial (`wmill sync push`, mecanismo
de git sync documentado em windmill.dev/docs/advanced/git_sync), com um
script wrapper no repositório para reduzir fricção (ex.
`scripts/sync-windmill.ps1`) — a criar na fase de implementação, não
nesta etapa de planejamento.
**Motivo**: o Windmill é self-hosted e só acessível de dentro da rede
interna/VPN — runners do GitHub Actions hospedados na nuvem da GitHub não
alcançam essa instância. Automatizar via CI exigiria um self-hosted
runner rodando dentro da rede interna, o que é mais infraestrutura e
provavelmente exige aprovação de TI/segurança da corporação.
**Alternativa descartada**: CI com self-hosted runner interno (mais
automação, mas mais peça pra manter — descartada em favor de
simplicidade para manutenção solo; pode ser revisitada se a publicação
manual virar gargalo).

### 2026-08-07 — Primeira fonte real: SGP (`ovrsgp`) para Efetivo/RH
**Decisão**: o usuário enviou o DDL real do "SGP" (Sistema de Gestão de
Pessoal), schema `ovrsgp`, seguindo o processo de
`DW_PROCESSO_INTEGRACAO.md`. Confirmado nessa análise:
- `tb_pess` é a tabela viva/autoritativa de militares; `tb_pess_bkp` é
  backup/legado congelado — **não extrair de `tb_pess_bkp`**.
- Data de ingresso confiável: `tb_pess.dt_ingrs` (não `dt_incl`, que é só
  timestamp de criação do registro).
- Extração direto das tabelas base (`tb_pess`, `tb_movim`, `tb_prom`,
  `tb_afast`, `tb_inatv` etc.), não das views `vw_metabase_*` já
  existentes — a lógica de negócio (quem conta como "ativo", tratamento
  de Adido/Agregado) é nossa a definir, não herdada dessas views.
- Os 4 eventos de pessoal (movimentação, promoção, afastamento,
  inativação) viram entidades/tabelas separadas no `core`, não uma
  tabela genérica de evento — cada uma tem estrutura própria.
- `tb_ome`/`tb_secao` são candidatas a fonte da estrutura organizacional,
  mas podem divergir em detalhes do organograma oficial já documentado
  (incluindo a DGA planejada) — reconciliação pendente de uma amostra de
  dados real (só temos o schema/DDL até agora).
**Pendências explícitas desta fonte** (não resolver por suposição):
- Regra de "efetivo ativo" e tratamento de Adido/Agregado no cômputo por
  unidade — usuário pediu mais tempo pra pensar.
- Conexão com o SGP (host, credenciais, alcance de rede pro Windmill).
- Frequência de atualização específica deste domínio.
- Mapeamento exato `tb_qdro` → categorias Oficiais/Praças/Alunos/Cadetes.
**Nota**: o escopo de campos desta fonte foi inicialmente discutido como
"máximo de dado possível" (ver decisão seguinte, que revisita isso à luz
dos 3 objetivos do projeto).

### 2026-08-07 — Critério de inclusão de dados no `core` (revisão do "máximo de dados")
**Decisão**: nem todo dado de uma fonte entra no `core` do DW. Critério
adotado, válido para toda fonte futura — três perguntas por campo/tabela:
1. Aparece em algum indicador/relatório/cruzamento entre sistemas?
2. Precisamos do histórico dele, e a fonte original só guarda o estado
   atual (sobrescreve)?
3. É dado sensível cujo valor analítico é só hipotético, sem uso
   concreto hoje?
Uma resposta "sim" em (1) ou (2) justifica entrar no `core`. Uma resposta
"sim" isolada em (3) **não** justifica — o dado fica na fonte original
até um uso concreto aparecer, e entra depois pelo mesmo processo de
`DW_PROCESSO_INTEGRACAO.md`.
**Motivo**: na primeira análise do SGP, o usuário havia pedido "o máximo
de dado possível" no DW (raça/cor, saúde, dados bancários, dependentes,
características físicas, foto). Ao recalcular a rota do projeto (ver
decisão seguinte, "3 objetivos"), ficou claro que isso é resolvido de
outra forma: o `core` guarda os *principais dados* de todas as fontes, e
o acesso a *tudo* — incluindo dado sensível — é resolvido por conexão
direta às fontes originais, não por replicar tudo no DW central.
**Alternativa descartada**: replicar o máximo possível de cada fonte no
`core` (descartada por aumentar a superfície de risco/LGPD sem ganho
analítico correspondente — o mesmo resultado prático é alcançado com
menos risco pela decisão de acesso granular abaixo).

### 2026-08-07 — Recalculando a rota: 3 objetivos do projeto
**Decisão**: o projeto passa a ser guiado por três objetivos explícitos,
definidos pelo usuário:
1. **Coleta de dados dispersos fora dos sistemas internos** — sistemas
   externos usados pela corporação e planilhas (Google Sheets) precisam
   de rotinas de coleta e armazenamento próprias. Sistemas internos já
   têm banco próprio (ex. SGP) — não são prioridade de *coleta* (embora
   continuem entrando no `core` pelos principais dados).
2. **Banco centralizado normalizado** — com relações definidas entre
   tabelas, contendo os principais dados de todas as fontes (internas e
   externas), permitindo cruzá-las livremente dentro do que os dados
   permitirem.
3. **Conexão dupla do sistema de visualização** — ao banco central
   (consultas comuns/estatísticas, "menos capilares") e às fontes
   originais (consultas granulares/específicas). O Comandante Geral
   precisa de visão analítica **e** acesso a absolutamente todos os
   dados da corporação.
**Motivo**: reflexão do usuário após a primeira rodada de modelagem do
SGP — "máximo de dado no DW central" não escala bem com múltiplas fontes
ricas e dispersas.

### 2026-08-07 — `core` deixa de ser esquema estrela e vira modelo normalizado
**Decisão**: `core` (ver `DW_ARQUITETURA.md`) passa a ser um banco
relacional **normalizado** (estilo 3FN) — uma tabela por entidade
(unidade, militar, viatura...), com chaves estrangeiras reais entre si,
integrando dado de todas as fontes. `marts` passa a ser a camada
**dimensional** (fato/dimensão, estilo Kimball), construída a partir do
`core`, para consumo do app e de consultas estatísticas comuns.
**Motivo**: atende ao objetivo 2 (conectar livremente, "de forma
normalizada") sem perder performance de consulta pro app/BI (objetivo 3),
que passa a consumir `marts`, não o `core` diretamente.
**Alternativa descartada**: `core` já como esquema estrela por domínio
(decisão original desta mesma sessão de planejamento, agora superada —
esquema estrela otimiza consulta, não integração/flexibilidade de
relação entre entidades de fontes diferentes).

### 2026-08-07 — `raw`/`staging` ganham papel duplo: coleta externa + acesso granular
**Decisão**: as camadas `raw`/`staging` do Postgres do DW (mesmo banco,
schemas separados — não uma instância à parte) passam a ser também o
destino da coleta de fontes externas (objetivo 1), e servem de fonte de
consulta granular para essas fontes (objetivo 3), preservando a
fidelidade da fonte original. Para fontes internas (ex. SGP), a consulta
granular é direta no banco de origem — sem duplicar em `raw`/`staging`.
**Motivo**: resposta direta do usuário — evita multiplicar
infraestrutura (banco único, mais simples de administrar sozinho).

### 2026-08-07 — Acesso granular via ferramenta de BI com conexões diretas
**Decisão**: consultas de alta granularidade (direto nas fontes
originais, não no DW consolidado) acontecem via Power BI/Metabase com
conexões diretas — ao banco de origem de sistemas internos (ex. SGP) e às
camadas `raw`/`staging` para fontes externas coletadas. O app React não
serve esse tipo de consulta.
**Motivo**: resposta direta do usuário.

### 2026-08-07 — Acesso do Comandante Geral: irrestrito, sem controle adicional
**Decisão**: o Comandante Geral tem acesso irrestrito a todos os dados da
corporação, incluindo dado sensível (saúde, bancário, dependentes do
SGP), sem camada extra de log/auditoria — por definição do cargo máximo
da corporação. Os demais perfis continuam sob o controle de acesso por
role/schema já definido em `DW_GOVERNANCA.md`.
**Motivo**: resposta direta do usuário.

### 2026-08-07 — Efetivo real (apresentação) vem do Neon, não do SGP
**Decisão**: para conectar dados reais ao KPI de Efetivo no app (demanda
de apresentação, fora da sequência de aprofundamento do SGP), a fonte
usada é um banco **Neon** (Postgres gerenciado) já mantido pelo usuário —
tabela `Militar`, alimentada por um script Windmill que sincroniza de uma
planilha Google Sheets. Contagem = `ativo = true` (militares presentes na
última sincronização da planilha). O SGP (`ovrsgp`) continua sendo a fonte
de referência para o aprofundamento futuro do domínio Efetivo/RH — as duas
fontes não são a mesma coisa e não devem ser confundidas.
**Motivo**: resposta direta do usuário ("os dados de efetivo virão de uma
outra fonte, que já está mais organizada").

### 2026-08-07 — Coluna `ome` adicionada ao Neon + unidade CPPA criada no organograma
**Decisão**: o banco Neon não tinha lotação (`ome`) na tabela `Militar` —
editado o script Windmill (`windmill-neon.py`, mantido fora do repositório)
para gravar `ome` também no Neon, sem alterar mais nada do fluxo existente
(ALTER TABLE ADD COLUMN IF NOT EXISTS, upsert incluindo `ome`). Ao mapear
os valores reais de `ome` contra o organograma, apareceu uma unidade real
não modelada: **CPPA**, subordinada à DGP, 11 militares, responsável Maj BM
Primo. Criada em `src/data/organograma.js` (OFICIAIS, ARVORE, METRICAS,
TIPO_POR_SIGLA) e no layout do Organograma (`src/pages/Organograma.jsx`) —
DGA agora renderiza em 4 colunas: DPLAG (+ diretorias sem subordinadas),
DGP (+ CPPA), DLOG (+ subordinadas), DEIP (+ subordinadas).
**Motivo**: resposta direta do usuário, ao analisar o schema real do Neon.

**Correção (mesmo dia)**: a CPPA foi confirmada pelo usuário como unidade a
ser extinta ("confirmei aqui que a mesma será extinta"). Revertida a
criação em `organograma.js` (OFICIAIS/ARVORE/METRICAS/TIPO_POR_SIGLA) e o
layout de 4 colunas da DGA em `Organograma.jsx`, voltando ao layout
original (2 colunas empilhadas + 2 grupos). Os 11 militares da CPPA passam
a contar dentro de **DGP** no mapeamento (`ome = 'CPPA'` → sigla `DGP` em
`etl/efetivo/mapeamento_unidades.json`). Mesma regra replicada depois para
Viaturas (ver decisão de 2026-08-07 sobre a fonte de Frota).

### 2026-08-07 — Militares com `ome = 'ADIDO'` contam só no total geral
**Decisão**: 186 militares ativos (7% do efetivo) têm `ome = 'ADIDO'`, sem
unidade do organograma correspondente. Não são atribuídos a nenhuma
unidade específica — somam apenas no Efetivo consolidado do COMANDO GERAL
(topo da hierarquia). Nenhuma unidade tem seu número "inflado" por isso.
**Motivo**: resposta direta do usuário ("contam só no total geral").

### 2026-08-07 — Efetivo real cobre 100% das unidades, sem misturar com mock
**Decisão**: ao ligar o Efetivo real, **todas** as unidades do organograma
passam a usar o valor real extraído do Neon — inclusive `0` para unidades
sem ninguém alocado na fonte (ex. `DGA`, unidade "planejada", e `CPP`, que
não tem lotação direta nessa fonte). Nenhuma unidade mantém o número
fictício antigo de Efetivo ao lado de unidades com dado real — evita
confundir a plateia da apresentação sobre o que é real e o que é mock.
Viaturas, Materiais, Finanças e Atividades Específicas continuam com os
valores anteriores (mock ou "Em construção") até suas fontes serem
conectadas.
**Motivo**: minimizar risco de leitura incorreta numa apresentação
institucional.

### 2026-08-07 — Viaturas real (apresentação) vem do sistema de frotas próprio
**Decisão**: para o KPI de Viaturas, a fonte é o Postgres interno do
sistema de gestão de frotas (app Rails, `10.193.1.252:54329`, banco
`frotas_production`, schema `public`) — **não** é uma planilha nem o SGP.
`vehicles` não tem FK direta para OME nem para status atual: ambos são
derivados do registro **mais recente** em `transfers` (por
`transfer_date`) e `vehicle_statuses` (por `reference_date`),
respectivamente — mesma lógica implícita no trigger `check_transfer_ome`
do próprio sistema. Contagem = **todas as viaturas cadastradas**, sem
filtrar por status (`vehicle_status_types.still_usable`); a granularidade
de status fica para uma fase futura do dashboard, mas já é sincronizada
para o Neon agora para não precisar reeditar o Windmill depois.
**Motivo**: resposta direta do usuário; grão "por unidade" mantido
consistente com Efetivo.

### 2026-08-07 — Pipeline de Viaturas: Windmill grava por viatura, script local agrega
**Decisão**: o Windmill (`windmill-viaturas.py`, fora do repositório, mesma
convenção de segredo em texto plano do `windmill-neon.py`) grava 1 linha
por viatura (id, tipo, OME atual, status atual, `still_usable`) num Neon
**novo e dedicado** a Frota (não é o mesmo Neon do Efetivo). O script local
(`etl/viaturas/extract_viaturas.py`, `DATABASE_URL_VIATURAS` em
`.env.local`) agrega por unidade e gera `src/data/real/viaturas.json` — só
contagem agregada, nenhum dado de viatura individual (placa, chassi,
patrimônio) sai do Neon.
**Motivo**: resposta direta do usuário — mesma divisão de responsabilidade
usada em Efetivo (Neon guarda o granular, script local agrega), pra dar
flexibilidade de quebrar por tipo/status no futuro sem reeditar o
Windmill.

### 2026-08-07 — De-para de OMEs da Frota: GTA desconsiderado, CPPA soma em DGP, DTIC duplicado mesclado
**Decisão**: mapeamento em `etl/viaturas/mapeamento_unidades.json`,
chaveado pelo `id` da OME na base de frotas (não pelo texto do acrônimo —
evita ambiguidade de espaço/typo). Três exceções confirmadas com o
usuário: **GTA** (Grupamento Tático Aéreo, `omeId 41`) não existe em
nenhum lugar do organograma e não é a mesma coisa que nenhuma unidade
existente — desconsiderado (1 viatura, fica fora de `por_unidade` e do
`total_frota`, mas visível em `desconsiderados` no JSON gerado, nunca
perdido silenciosamente). **CPPA** (`omeId 43`) soma em `DGP`, mesma regra
já usada para Efetivo. **DTIC duplicado** (`omeId 22` e `omeId 45`, mesmo
nome completo, acrônimo do segundo com espaço em branco no final) tratado
como erro de cadastro no sistema de frotas — as viaturas de ambos os ids
somam juntas em `DTIC`.
**Motivo**: resposta direta do usuário a cada uma das três ambiguidades,
sem presumir.

### 2026-08-07 — Viaturas real cobre 100% das unidades, sem misturar com mock
**Decisão**: mesmo princípio já aplicado ao Efetivo — ao ligar o overlay de
Viaturas real em `organograma.js`, **todas** as unidades passam a usar o
valor real (`0` incluído) extraído de `viaturas.json`. Nenhuma unidade
mantém o número fictício antigo de Viaturas ao lado de unidades com dado
real.
**Motivo**: mesmo motivo do Efetivo — minimizar risco de leitura incorreta
numa apresentação institucional.

### 2026-08-07 — Finanças real (apresentação) vem da planilha de Finanças já carregada no Postgres interno
**Decisão**: a fonte é a planilha Google Sheets de Finanças que o usuário já
sincroniza para o Postgres interno (`10.193.1.252:54301`, banco `postgres`,
tabelas `fin_autorizacao`, `fin_carnaval_2026`, `fin_sfi_ordinario`) via um
script Windmill existente (`windmill-financas.py`, não alterado por esta
integração). Inspecionei a planilha publicada diretamente (link público de
export `.xlsx`) para entender a estrutura antes de propor qualquer desenho,
por `DW_PROCESSO_INTEGRACAO.md`.
**Achado que mudou o desenho**: o bloco "Autorização" mistura rubricas
institucionais centrais de grande valor (ex.: folha de pagamento em
`DPAFO`, aquisição de viaturas em `DLog`, R$6-23 milhões por lançamento —
mediana geral é R$10 mil) com despesas pequenas por unidade operacional.
Somar tudo por "destino" infla unidades que não são donas reais do gasto.
**Motivo**: resposta direta do usuário depois de eu apresentar esse achado
com números.

### 2026-08-07 — Escopo do KPI de Finanças: só Suprimento Individual + SFI Ordinário, situação EMPENHADO, valor pago
**Decisão**: o número de Finanças por unidade soma **valor pago** das
linhas com `situacao = 'EMPENHADO'`, restrito a: (1) todo o bloco **SFI
Ordinário** (já é, por definição, suprimento por unidade) e (2) linhas dos
blocos **Autorização** e **Carnaval 2026** com `enquadramento = 'SI'`
(Suprimento Individual). Isso exclui automaticamente, sem precisar de uma
regra à parte: rubricas institucionais centrais (`DPAFO`, `DLog` etc. —
nenhuma linha delas tem `enquadramento = 'SI'`) e auxílio funeral a pessoa
física (`Ao mesmo`/`Aos mesmos`/`À mesma` — enquadramento `FUNERAL`, não
`SI`). **Sem percentual de execução por enquanto** — `financaPct`/
`executadoPct` fica suprimido (`undefined`) nos indicadores de Finanças em
`organograma.js`, para nunca misturar um percentual (real ou do mock
antigo) com o valor real.
**Motivo**: resposta direta do usuário a cada uma das 4 perguntas
(escopo/valor/percentual/situação) mais 1 pergunta de acompanhamento
(Carnaval também entra no filtro SI, mesma regra da Autorização).

### 2026-08-07 — Pipeline de Finanças: Windmill grava por lançamento sem filtrar, script local aplica a regra de negócio
**Decisão**: novo script Windmill (`windmill-financas-sync.py`, fora do
repositório, mesma convenção de segredo em texto plano de
`windmill-viaturas.py`) lê as 3 tabelas do Postgres interno **sem
filtrar** e grava 1 linha por lançamento na tabela `FinancaLancamento`, no
**mesmo Neon já usado para Viaturas** (reaproveitado a pedido do usuário —
"vamos utilizar esse mesmo Neon"). Nunca copia `numero_oficio`/`sei`/
`descricao`/`observacao` — essas colunas têm nome, matrícula e CPF de
militar em texto livre (ex.: linhas de auxílio funeral e suprimento
individual). O filtro de escopo (SI + EMPENHADO, ver decisão acima) e o
de-para de unidade vivem no script local
(`etl/financas/extract_financas.py`, `DATABASE_URL_FINANCAS` em
`.env.local`, aponta para a mesma connection string de
`DATABASE_URL_VIATURAS`), não no Windmill — mesmo racional de Viaturas:
dar flexibilidade para ajustar a regra de negócio sem reeditar o Windmill.
**Motivo**: resposta direta do usuário (mesmo Neon) + minimização de dado
(`DW_GOVERNANCA.md`) + consistência com o padrão já estabelecido em
Efetivo/Viaturas.

### 2026-08-07 — De-para de unidades de Finanças: normalização automática + exceções explícitas
**Decisão**: `etl/financas/mapeamento_unidades.json` guarda só as
**exceções** (grafias que não convergem sozinhas para a sigla do
organograma) — não uma lista exaustiva de toda variante observada. O
script normaliza tanto a sigla do organograma quanto o destino bruto da
planilha (maiúsculas, sem acento, só letras e números) antes de comparar;
isso já resolve sozinho a maioria das variantes de digitação encontradas
(`"1º GB"`/`"1ºGB"`, `"GBMAR"`/`"GBMar"`, `"CAT RMR"`/`"CAT/RMR"`,
`"DLog"`/`"Dlog"`/`"DLOG"`). Ficam como exceção explícita no JSON:
`CAT AGR`→`CAT/AG`, `CAT SERTÃO`/`CAT ST`→`CAT/SE`, `DINTER 1`/`DINTER
2`→`DINTER I`/`DINTER II`, **CPPA→DGP** (mesma regra já usada em Efetivo/
Viaturas), e `DAFO`/`DPAFO`/`SEGI`/`SGD`/pessoas físicas (`Ao mesmo` etc.)
mapeados para `null` — confirmadamente não são unidade do organograma,
para nunca virar erro se aparecerem de novo. Rodando a extração real, zero
destinos ficaram sem mapear e zero caíram em `fora_do_organograma`.
**Motivo**: mesma disciplina de nunca perder dado silenciosamente
(`raise SystemExit` em destino desconhecido), com um mapeamento mais
enxuto/auditável que o de Viaturas por não ter uma chave numérica estável
como `omes.id` — o texto exige normalização.

### 2026-08-07 — Finanças real cobre 100% das unidades, sem misturar com mock
**Decisão**: mesmo princípio já aplicado a Efetivo e Viaturas — ao ligar o
overlay de Finanças real em `organograma.js`, **todas** as unidades passam
a usar o valor real (`0` incluído) extraído de `financas.json`. Total
apurado: R$ 2.310.957,65 somados em 40 unidades.
**Motivo**: mesmo motivo de Efetivo/Viaturas — minimizar risco de leitura
incorreta numa apresentação institucional.

### 2026-08-07 — Exceção deliberada à minimização de dados: tabela nominal de Efetivo e relação de Viaturas por unidade
**Decisão**: ao clicar no indicador de Efetivo ou Viaturas de uma unidade,
o painel mostra uma tabela — Posto/Graduação + Matrícula + Nome de Guerra
por militar (própria unidade, não agregado com subordinadas); Placa +
Modelo por viatura — com cada linha levando a uma página de detalhe
("Dados do Militar" / "Dados da Viatura") propositalmente **em
manutenção**. Isso é uma exceção **deliberada e explícita** ao princípio
de só publicar contagem agregada seguido em todo o resto do projeto
(Efetivo/Viaturas/Finanças): esses três campos por militar e os dois por
viatura passam a existir num JSON commitado e servido publicamente pela
Vercel, **sem autenticação** (`authClient.js` continua sendo só um stub —
pendência já registrada abaixo). Apresentei o risco (dado identificável +
questão de segurança operacional, tratando-se de órgão de segurança
pública) antes de implementar; o usuário confirmou seguir mesmo assim
como MVP. Campos deliberadamente **fora** da tabela/JSON: nome completo,
data de nascimento, sexo, endereço/telefone, saúde, chassi, patrimônio —
só os campos explicitamente pedidos saem do Neon.
**Pipeline**: `windmill-neon.py` (Efetivo, no Downloads do usuário) e
`windmill-viaturas.py` (Viaturas, no Desktop) foram estendidos para gravar
`nomeGuerra` e `placa`/`marca`/`modelo`, respectivamente, no Neon — campos
que existiam na fonte mas nunca tinham sido sincronizados. Os scripts
locais (`extract_efetivo.py`, `extract_viaturas.py`) agora também geram
`src/data/real/efetivo_lista.json` e `src/data/real/viaturas_lista.json`
(por unidade), além dos agregados já existentes.
**Motivo**: pedido explícito do usuário, com o trade-off de exposição
pública apresentado e confirmado antes de qualquer código ser escrito —
`DW_PROCESSO_INTEGRACAO.md`.

### 2026-08-11 — Efetivo Previsto real vem do QOD (planilha oficial de organização e distribuição)
**Decisão**: o "previsto" do Efetivo (antes um multiplicador aleatório do
atual) passa a vir da planilha QOD ("08 - QOD - AGOSTO - 2026.xlsx",
compartilhada pelo usuário), aba "GERAL 001" — coluna TOTAL por unidade,
mesma granularidade "própria" (não agregada) usada em `efetivo`/
`viaturas`/`financas` reais; a agregação por subárvore acontece do mesmo
jeito, em `totaisDaSigla()`. Inspecionei a planilha inteira (97 abas)
antes de propor qualquer desenho, por `DW_PROCESSO_INTEGRACAO.md`.
Confirmado com o usuário: (1) usar mesmo com o QOD marcado "a ser
publicado em BGE após homologação" (ainda não oficial); (2) ignorar as
abas "mergulho"/"sede"/"destacada" — são um estudo de reorganização à
parte de 2 seções do 2º GB (têm "qod sugerido" vs "qod atual" vs "SALDO"),
fora do escopo do previsto vigente; (3) CPPA soma dentro de DGP, mesma
regra do Efetivo atual/Viaturas/Finanças. A soma lida bateu exatamente com
o TOTAL GERAL da planilha (5.249) — script (`etl/efetivo/
extract_previsto.py`) recusa gravar o JSON se a soma não bater, pra nunca
publicar um previsto incompleto/mal mapeado.
**Motivo**: resposta direta do usuário a cada uma das 4 perguntas.

### 2026-08-11 — Granularidade de cargo/seção interna do QOD existe, mas fica para uma fase futura
**Superado em 2026-08-12** — ver entrada "Efetivo Previsto granular por
divisão implementado" abaixo; a granularidade descrita aqui foi mapeada e
já está no app. Entrada mantida como registro histórico da decisão
original.

**Achado**: além do previsto por unidade (aba GERAL 001), o QOD tem uma
aba por unidade (ex. "DGP 080", "3º GB 058") com o previsto por cargo/
seção interna (Chefe, Auxiliares, Núcleo de Assistência Social, Divisão de
Ativos etc.), incluindo casos de 0 vaga própria por ser "encargo" de outro
cargo — confirmado com o usuário que é exatamente esse nível de detalhe
que ele queria ver existir. **Não implementado ainda**: mapear cada linha
dessas abas para as divisões internas sintéticas já existentes em
`SUBSETORES`/`metricasDivisoesProprias()` (hoje "Em construção") é um
trabalho de correspondência unidade-a-unidade que não foi feito nesta
rodada — fica registrado como possível próxima fase, não como pendência
bloqueante.

### 2026-08-11 — Tabela de Efetivo na página de Indicador: escondida atrás de botão, com a subárvore inteira
**Decisão**: a tabela de militares (antes sempre aberta, só na própria
unidade) passa a: (1) ficar escondida por padrão atrás de um botão
"Exibir tabela com detalhes do efetivo", ao lado do card atual/previsto,
não mais aberta embaixo por padrão; (2) trazer o efetivo da unidade **e de
toda a subárvore de subordinadas** (usando `getSubordinados`), não só da
própria unidade — ex. Comando Geral mostra os ~2.472 militares mapeados de
toda a corporação (os 187 ADIDO continuam de fora, sem OME conhecida,
contam só no total agregado); (3) ganha as colunas Posto/Graduação
(rotulada "Posto" para postos de Aspirante a Coronel, "Graduação" para o
resto — `isOficial()`), Matrícula, Nome completo (nome de guerra em
negrito/caixa alta dentro do nome), Sexo, Idade (calculada a partir da
data de nascimento — só a idade sai no JSON, não a data, minimização
deliberada) e OME (sigla de origem, útil quando a subárvore mistura várias
unidades); (4) ganha filtros — busca autocompletada por nome/nome de
guerra, busca autocompletada por matrícula, seletor de Posto/Graduação,
seletor de Sexo; (5) ganha paginação client-side (25/página). O mesmo
padrão de botão (escondida por padrão) foi replicado em Viaturas, mas sem
virar subárvore (não foi pedido) e sem os filtros/paginação (poucas
dezenas de linhas por unidade).
**Motivo**: pedido explícito do usuário, detalhado campo a campo depois
que eu apresentei o catálogo completo de campos disponíveis (incluindo os
sensíveis por LGPD) para decisão consciente.

### 2026-08-11 — Painel "dados completos" do Efetivo: campos sensíveis LGPD, sob clique extra, coleta ainda pendente
**Decisão**: a tabela de Efetivo ganha um botão "Verificar dados
completos" que expande 21 colunas adicionais (raça/cor, PCD, telefones,
tempo de serviço, tempo na unidade atual, unidade anterior, órgão,
horário especial, readaptado, acúmulo de cargos, LE, LTIP, afastamento
>90 dias, suplementação de pessoal, aniversário hoje, última movimentação,
data de ingresso, data da última promoção, PCNH). O usuário pediu
explicitamente "todas as colunas possíveis, mesmo incluindo dados
sensíveis" depois de eu apresentar o catálogo completo com a classificação
de sensibilidade de cada campo — decisão informada, não presumida. Único
campo deliberadamente excluído: `observacao` (texto livre, risco
imprevisível de conter qualquer coisa). **A pedido explícito do usuário,
a coleta de dados fica pendente**: o código está todo pronto (
`windmill-neon.py`, no Downloads do usuário, com `ALTER TABLE`/upsert para
as novas colunas; `etl/efetivo/extract_efetivo.py` já monta o
sub-objeto `completo` por militar), mas o Windmill **não foi rodado** —
até isso acontecer, o painel mostra "—" em todas as 21 colunas
(comportamento gracioso, verificado no navegador, nenhum erro).
**Motivo**: resposta explícita do usuário (2 vezes, depois de ver o
catálogo completo) + pedido explícito de deixar a coleta pendente por
enquanto.

### 2026-08-11 — Setores Vinculados: (ADM) na linha própria da unidade, seções operacionais sempre por último
**Decisão**: (1) quando uma unidade tem subordinadas reais E efetivo
próprio (ex. DGO, DINTER I, DIM, DLOG, DEIP), a linha da própria unidade
na tabela de Setores Vinculados passa a mostrar "SIGLA (ADM)" (ex. "DGO
(ADM)") para distinguir da lista de unidades vinculadas de verdade; (2) as
seções operacionais internas (SB, SBI, SBAPH, SBS, SBSA, SBFN, SATec —
numeradas ou não, ex. "1ª SB/3º GB", "SBFN/GBI") sempre vão para o final
da lista de divisões internas, com o resto (comando, subcomando,
secretaria, divisões administrativas/de operações) mantendo a ordem já
declarada em `SUBSETORES` — implementado em `divisoesDaSigla()`
(`organograma.js`), reutilizado tanto para a linha "aberta" quanto para
unidades-folha sem subordinadas reais (ex. 3º GB, GBI).
**Motivo**: pedido explícito do usuário, com exemplo concreto (3º GB:
comando/subcomando/secretaria/2 divisões primeiro, 4 SBs por último).

### 2026-08-11 — KpiCard de Efetivo na página da unidade também mostra Previsto
**Decisão**: o card "Efetivo Atual" na página de uma unidade (`Diretoria.jsx`)
passa a mostrar uma linha secundária "Previsto: X" (reaproveitando o slot
`extra` do `KpiCard`, já usado antes só para Finanças/executadoPct — ver
`extraKpi()` em `cbmpe.js`), usando o mesmo previsto real agregado por
subárvore que já alimenta a página de Indicador.
**Motivo**: pedido explícito do usuário.

### 2026-08-12 — Efetivo Previsto granular por divisão implementado (supera a nota de 2026-08-11 acima)
**Decisão**: a granularidade de cargo/seção interna do QOD, até aqui
registrada como "fica para uma fase futura", foi implementada nesta
sessão. Varredura completa das ~44 abas de unidade do QOD (ex. "GBI 012",
"DGP 080", "3º GB 058") via `etl/efetivo/extract_previsto_divisoes.py`:
- Cada aba tem uma árvore de seções numeradas (ex. "1) Comando", "4.4) 1ª
  Seção de Bombeiros... - 1ª SBI/GBI"), cada uma com previsto na coluna
  TOTAL. O script casa cada divisão já existente em `SUBSETORES`
  (`organograma.js`) com o nó correspondente da árvore (texto exato →
  abreviação após hífen → nome sem abreviação → posição, nessa ordem de
  tentativa) e soma o previsto do nó **e de todos os descendentes que não
  são, eles mesmos, uma outra divisão reivindicada** (ex.: em GBI,
  "Divisão de Operações" soma Chefe/Auxiliares + núcleos internos, mas
  não as 1ª-4ª SBI/SBFN, que são divisões próprias na nossa lista).
- Resultado gravado em `src/data/real/efetivo_previsto_divisoes.json`
  (`{sigla: [{nome, previsto}]}`), consumido por
  `metricasDivisoesProprias()` em `organograma.js` — que deixa de gerar
  número sintético por divisão (RNG determinístico) e passa a devolver só
  o previsto real, sem campo de atual (não temos atual nesse nível de
  granularidade).
- Validação: soma das divisões de cada unidade bate exatamente com
  `efetivo_previsto.json` (já confirmado, 5.249) — script aborta se não
  bater. As únicas 2 unidades sem abas de divisão são Comando Geral e
  Subcomando Geral (previsto = 1 cada, é o próprio ocupante do cargo, sem
  divisão interna no modelo).
- **Duas correções de estrutura descobertas na varredura** (a planilha é
  a fonte de verdade, não o mock que já existia em `SUBSETORES`):
  1. DIESP: "Divisão de Isenção e Restituição - DIR" não existe no QOD
     como divisão própria — é na verdade "Seção de Isenção e Restituição
     - SIR", subseção de "Divisão de Atendimento ao Público - DAP".
     Renomeado em `SUBSETORES['DIESP']` para refletir a realidade.
  2. CPPA (Centro de Pagamento de Pessoal Ativo) tem aba própria no QOD
     ("CPPA 081") mas não é unidade própria no organograma — soma dentro
     de DGP, mesma regra já usada para o Efetivo atual (ver decisão de
     2026-08-07 "Coluna `ome` adicionada ao Neon + unidade CPPA criada no
     organograma", depois revertida). Adicionada como mais uma divisão de
     DGP (`'↳ CPPA'`) só para exibir seu previsto (17) na tabela — não
     virou nó da árvore/unidade própria.
- Na página de Diretoria, a coluna antes chamada "Efetivo" na tabela de
  Setores Vinculados foi renomeada para "Efetivo Atual/Previsto"
  (`rotuloColuna()`); as linhas de divisão/seção interna, que antes
  mostravam "Em construção" nessa coluna, agora mostram "x/{previsto}"
  (ex. "x/121") — o "x" deixa explícito que só o previsto é real,
  ainda não há efetivo atual nesse nível de granularidade. As outras 4
  colunas (Viaturas/Materiais/Finanças/Atividades Específicas) continuam
  "Em construção" para divisões.
**Motivo**: pedido explícito do usuário ("quero que isso já fique no
nosso sistema"), incluindo a instrução de checar se havia previsto no
nível máximo de granularidade na planilha antes de assumir que não havia.

### 2026-08-12 — Tabela de Efetivo migra para página própria, com filtros estilo planilha
**Decisão**: o botão "Exibir tabela com detalhes do efetivo" na página de
Indicador (só para o indicador Efetivo — Viaturas não muda) virou um
**card** clicável que navega para uma página nova, `/efetivo/:id`
(`src/pages/EfetivoDetalhe.jsx`), com a tabela completa de militares (a
mesma lógica de subárvore + paginação de antes, agora só nessa página).
Os filtros deixam de ser caixa de busca + `<select>` e passam a ser
**estilo Google Sheets**: um ícone de funil ao lado do nome de cada uma
das 6 colunas principais (Posto/Graduação, Matrícula, Nome completo,
Sexo, Idade, OME), que abre um dropdown com busca + checkboxes por valor
único + "Selecionar tudo"/"Limpar seleção" — os valores disponíveis em
cada dropdown são recalculados considerando os filtros já aplicados nas
outras colunas (cascata, igual planilha real). O painel "Verificar dados
completos" (21 colunas sensíveis LGPD) continua igual, sem filtro próprio
por enquanto. Viaturas mantém o padrão anterior (tabela inline, toggle
por botão, sem página própria) — não foi pedido mudar.
**Motivo**: pedido explícito do usuário.

### 2026-08-12 — Painel "dados completos" do Efetivo: coleta concluída, deixa de ser pendência
**Decisão/execução**: o usuário rodou o `windmill-neon.py` atualizado no
Windmill (colunas novas criadas/populadas na tabela `Militar` do Neon).
Reexecutei `etl/efetivo/extract_efetivo.py` — rodou sem erro e gravou
`efetivo_lista.json` com o sub-objeto `completo` preenchido para todos os
militares (raça/cor, PCD, telefones, tempo de serviço/na unidade, unidade
anterior, órgão, horário especial, readaptado, acúmulo de cargos, LE,
LTIP, afastamento >90 dias, suplemento pessoal, aniversário, última
movimentação, datas de ingresso/promoção, PCNH). O painel "Verificar
dados completos" da tabela de Efetivo deixa de mostrar "—" nessas 21
colunas. **Nota de volume**: o JSON gerado passou de ~1 MB pra ~2,4 MB
(o `completo` de ~2.658 militares ativos) — o bundle de produção subiu
de ~1,25 MB pra ~2,5 MB (gzip ~395 KB); segue dentro do padrão já adotado
de servir dado estático via JSON no repositório, sem paginação no
backend (não há backend) — se o volume crescer muito mais, code-splitting
ou uma API real viram necessários, mas não é o caso ainda.
**Motivo**: o usuário confirmou ter rodado o Windmill e pediu para
completar o restante.

### 2026-08-12 — Tabela de Efetivo: paginação configurável, tipos de coluna e agregadores estilo planilha
**Decisão**: três melhorias na página `/efetivo/:id`
(`EfetivoDetalhe.jsx`), pedidas explicitamente pelo usuário:
1. **Tamanho de página**: um seletor 10/20/50 registros por página, fora
   do card da tabela, centralizado embaixo, junto com os botões
   Anterior/Próxima (antes só existia paginação fixa de 25, dentro do
   card). Trocar o tamanho reseta pra página 1.
2. **Tipo de coluna**: cada coluna (as 6 principais e as 21 do painel
   "dados completos") ganha um seletor de tipo no cabeçalho — Texto
   (padrão, mantém a formatação já existente, ex. nome de guerra em
   negrito), Data (sempre `dd/mm/aaaa`, convertido a partir do ISO da
   fonte sem problema de fuso horário), Número inteiro ou Número decimal
   (formatados via `toLocaleString('pt-BR')`). Colunas de data no painel
   completo (ex. "Data de Ingresso") já nascem tipadas como Data por
   padrão; Idade/Tempo de Serviço/Tempo na Unidade já nascem como Número
   inteiro. Trocar o tipo de uma coluna incompatível com o dado (ex.
   forçar Matrícula pra número) mostra "—" — comportamento aceito, é uma
   escolha manual do usuário, igual planilha real.
3. **Seleção de coluna + agregadores**: clicar no rótulo de uma coluna
   "seleciona" ela (destaque visual no cabeçalho e nas células) e mostra,
   no canto inferior direito da tabela, Contagem e Contagem Distinta
   (sempre) e Soma/Média/Mínimo/Máximo (só quando a coluna está tipada
   como número) — calculados sobre os registros filtrados, não só a
   página atual, igual barra de status do Google Sheets.
**Motivo**: pedido explícito do usuário.

### 2026-08-12 — Filtro de coluna: causa raiz do balão deslocado, filtro em todas as colunas, tabela sempre completa, novo cabeçalho
**Achado/correção de bug**: o usuário relatou que o balão do filtro
aparecia "muito à direita, em alguns casos até fora da viewport".
Investigando, a causa raiz é `html { zoom: 1.25 }` (`src/index.css`,
técnica de escala da página inteira já usada pelo app — 1.05 no mobile,
1 na impressão): um elemento `position: fixed` dentro do `<html>`
zoomado interpreta `left`/`top` no espaço **local** (pré-zoom), enquanto
`getBoundingClientRect()`/`window.innerWidth` sempre devolvem pixels
**reais** (pós-zoom) — calcular a posição do balão sem dividir pelo zoom
faz ele "escorregar" proporcionalmente ao fator de zoom. Isso também
explica por que o `Popover` do Radix (usado antes) calculava a posição
errada dentro dessa tabela: sua lógica de colisão/posicionamento não
conhece o `zoom` custom da página. **Correção**: `FiltroColuna`
(`EfetivoDetalhe.jsx`) parou de usar `Popover`/`PopoverContent` do Radix
e passou a se posicionar manualmente — mede o botão do funil via
`getBoundingClientRect()`, divide pelo `zoom` computado
(`getComputedStyle(document.documentElement).zoom`) antes de aplicar
como `style.left`/`style.top` de um portal fixo, e limita (`clamp`) a
posição para nunca ultrapassar a borda direita da viewport. Reposiciona
em scroll/resize e fecha ao clicar fora.
**Decisão adicional**: já que a causa raiz foi corrigida, o filtro estilo
planilha foi estendido para **todas as 27 colunas** (as 21 do antigo
painel "dados completos" também ganharam funil, inclusive as booleanas,
que filtram por "Sim"/"Não" em vez de `true`/`false`).
**Decisão adicional**: o botão "Verificar dados completos" foi removido
— a tabela em `/efetivo/:id` já abre com todas as colunas visíveis
(antes escondidas atrás de um clique extra).
**Decisão adicional**: cabeçalho da página trocado — título "Militares
da Unidade" → "Militares da OME"; o nome da OME abaixo ganha o sufixo
"+ unidades vinculadas" quando a unidade tem subordinadas (`getSubordinados`);
o contador de registros do card ("296 de 296 registros (unidade +
subordinadas)") virou "Total: N" — ou "Total: N / Filtrado: M" só quando
há pelo menos um filtro de coluna ativo (`filtroAtivo`), não apenas
quando a contagem difere.
**Motivo**: pedido explícito do usuário — bug relatado + 3 mudanças de
UX pedidas na mesma mensagem.

### 2026-08-12 — Bug: tabela de Efetivo do Comando Geral não batia com o KPI (187 militares "ADIDO" faltando)
**Achado**: o usuário reportou que o Comando Geral mostra "Efetivo Atual"
2.658 no card, mas a tabela de detalhamento mostrava "Total: 2.471" —
diferença de exatamente 187, o mesmo número dos militares com
`ome = 'ADIDO'` no Neon (mapeados para `null` em
`mapeamento_unidades.json`, "não lotados" — decisão de 2026-08-07: contam
só no total geral, nunca atribuídos a uma unidade específica).
`organograma.js` já somava esses 187 ao `efetivo` de COMANDO GERAL (via
overlay de `efetivoNaoLotado`), mas `etl/efetivo/extract_efetivo.py`
**pulava** esses militares inteiramente ao montar `efetivo_lista.json`
(`if not sigla: continue`) — nunca apareciam em nenhuma tabela.
**Verificação de escopo**: comparei, para cada sigla, a contagem agregada
de `efetivo.json` contra o tamanho da lista em `efetivo_lista.json` — bate
exatamente em 100% das unidades reais (diff zero). Como o Comando Geral é
a raiz da árvore (não tem "ancestral" que também precisaria desse ajuste),
esse gap só podia se manifestar ali — confirmado, não é um problema
generalizado.
**Correção**: `extract_efetivo.py` agora atribui os militares "não
lotados" à lista de `COMANDO GERAL` (em vez de descartar), mesma regra do
agregado. Reexecutado — `efetivo_lista.json` soma 2.658 no total, e
`COMANDO GERAL` na lista bate exatamente com o KPI. Confirmado também que
Subcomando Geral (a outra unidade sem "valores próprios" no
`SEM_VALORES_PROPRIOS`) e GBI continuam batendo card ↔ tabela.
**Motivo**: correção de bug reportado pelo usuário.

### 2026-08-17 — Ajustes de UI (fundo, logout) e protótipo de controle de acesso por níveis
**Ajustes de UI pontuais**: fundo da aplicação passou a `#F5F5F5` (mais
contraste com os cards, que continuam brancos); botão "Voltar ao
indicador" removido da tabela de detalhamento do Efetivo (retorno só pelo
botão nativo do navegador); botão "Sair" adicionado ao `Topbar`, chamando
`useAuth().logout()`.

**Protótipo de controle de acesso por níveis** (`src/lib/accessControl.js`):
o usuário forneceu 5 perfis de demonstração, cada um com senha =
`USUARIO` em maiúsculo + `@GSG` (regra definida pelo usuário, hardcoded
de propósito — é protótipo, não credencial real):

| Usuário | Escopo |
|---|---|
| `4GB` | 4º GB e tudo abaixo (é folha na árvore atual — só o próprio card) |
| `DINTER2` | DINTER II e toda a subárvore (3º/4º/5º/9º GB, CAT/SE) |
| `DGO` | DGO e toda a subárvore (DIM, DINTER I, DINTER II, DIESP + filhos) |
| `DGP` | só o card da DGP + o atalho de KPI "Efetivo" no topo do organograma (sob CBMPE - Geral) — sem cascata para descendentes |
| `AGGD` | acesso total, todos os cards |

`authClient.js` continua aceitando o login admin (`VITE_ADMIN_USUARIO`/
`VITE_ADMIN_SENHA`, ver seção de 2026-08-12 acima) sem nenhuma restrição
visual — é o "modo irrestrito" técnico. Os 5 usuários de nível logam com
`role: "nivel"` e `nivelAcesso` = a chave (`"DGP"` etc.); `Organograma.jsx`
usa isso pra decidir se aplica alguma restrição visual.

**Comportamento visual no organograma**: o usuário de nível continua
vendo a árvore inteira (nenhuma unidade some), mas só os cards liberados
ficam clicáveis e recebem destaque (anel `ring-2 ring-primary` + glow); os
demais ficam com `pointer-events-none` + opacidade/saturação reduzidas
(sem efeito de hover — `:hover` não dispara em elemento com
`pointer-events: none`, então não precisei duplicar classes sem `hover:`).
`AGGD` (acesso total) portanto aparece com **todos** os cards destacados,
não "sem restrição" — é intencional: ele é um usuário de nível como os
outros, só que com escopo total, diferente do login admin que não passa
por essa lógica.

**Escopo é só de VISUALIZAÇÃO no organograma** — é um protótipo. Clicar
num card restrito não navega (onClick desabilitado), mas as rotas
`/diretoria/:id` e `/indicador/:id` continuam sem guarda: quem tiver o
link direto ainda acessa a página. Não implementei RBAC real nem guarda
de rota nesta rodada — ver pendência de RBAC já registrada em
`DW_GOVERNANCA.md`.

**Card "Bem-vindo, {usuário}"** adicionado ao `Topbar` (nome exibido =
`full_name` do usuário logado); aproveitei a mudança de layout do header
para colocar a caixa de busca centralizada (`grid-cols-[1fr_auto_1fr]`,
busca na coluna do meio) em vez de alinhada à esquerda.

**Correção de cor no organograma**: os cards de diretoria abaixo do
Subcomando Geral (DIM, DINTER I, DINTER II, DIESP, DGP, DVP, DJD, DPLAG,
DF, DAS, DTIC, DLOG, DEIP) usavam tons translúcidos (`bg-yellow-600/80` e
`/90`, herdados do protótipo Power BI de referência) — ficavam
visivelmente "lavados" comparados ao card da DGO/DGA (tom sólido). Unifiquei
todos para o mesmo tom sólido do DGO — pedido do usuário, não relacionado
ao controle de acesso.

**Motivo**: pedido explícito do usuário — protótipo de UI de controle de
acesso para validar com stakeholders antes de decidir se vale a pena
investir em RBAC real (autenticação/autorização de verdade continua
dependência futura, ver `DW_GOVERNANCA.md`).

### 2026-08-17 (mesma sessão) — Exportação Excel do Efetivo + desenho da fonte Lotação/Função (Pecúlio, QOD, CPPA)

**Exportação Excel**: adicionado botão "Exportar Excel" na tabela de
Efetivo Detalhe (`src/pages/EfetivoDetalhe.jsx`), usando a lib `xlsx`
(SheetJS) — gera um `.xlsx` client-side com as linhas atualmente
filtradas (respeitando filtros e tipo de coluna escolhidos pelo usuário),
nome do arquivo `Efetivo - {sigla da unidade}.xlsx`.

**Contexto da nova fonte**: o usuário quer resolver a lacuna de
granularidade "abaixo da OME" no domínio Efetivo/RH — hoje sabemos que um
militar está lotado no "GSG", mas não em que seção/divisão dele, nem que
função exerce. Ele descreveu 3 planilhas que, juntas, resolvem isso —
seguindo `DW_PROCESSO_INTEGRACAO.md` (esclarecer tudo antes de desenhar):

- **Pecúlio.xlsx** (DGP) — quem são os militares e em que OME estão.
  **Confirmado pelo usuário: é a mesma fonte que já alimenta o Neon/
  `efetivo_lista.json`** — não é integração nova.
- **QOD.xlsx** (DPlaG) — já documentado (`extract_previsto.py`/
  `extract_previsto_divisoes.py`): quantas vagas de função existem por
  unidade/seção, e que posto cada uma espera.
- **Repercussão Financeira.xlsx** (CPPA) — onde as unidades decidem quem
  ocupa qual função, cruzando a lista de efetivo (Pecúlio) com as vagas
  disponíveis (QOD).

**Inspeção da Repercussão Financeira.xlsx**: arquivo tem 12 abas; duas
relevantes:
- **`DIST_FUNCOES`** — grão 1 linha por (matrícula, função ocupada):
  matrícula, unidade, posto, nome completo, **nome da função e seção**
  (texto livre, ex. "Chefe da Divisão de Operações", "Comandante do(a) 5º
  Grupo de Salvamento da 1ª SBS", "Auxiliar da Seção de Tesouraria"),
  posto esperado pra função, portaria, BGE. **Confirmado pelo usuário
  como a fonte-alvo**: "DIST_FUNCOES está sendo atualizada, e irá conter
  todos os militares do pecúlio" — hoje tem 846 linhas de ~2.659
  militares ativos (cobertura parcial, ~32%, em expansão). Cobre todos os
  postos, não só chefias — verificado (223 Sd, 169 3º Sgt, 111 Cb,
  incluindo funções como "Combatente do Grupo de Salvamento", "Piloto do
  Grupo de Apoio aos Mergulhadores" — confirma o exemplo do usuário sobre
  guarda-vidas/auxiliares em funções rasas, que eu tinha avaliado errado
  numa primeira leitura por ter amostrado só a aba de um setor
  administrativo pequeno).
- **`REPERC_FINANC`** — grão 1 linha por militar (~2.531 linhas, cobertura
  maior), mas só com o **posto-tier da função** (ex. "CAP QOC"), sem nome
  de seção — parece existir pra reconciliar vagas disponíveis x ocupadas
  por posto (o "impacto financeiro" do nome do arquivo). **Não integrada
  agora** — redundante com `DIST_FUNCOES` pro nosso propósito
  (função+seção) e sem confirmação de que as duas abas estão sempre
  sincronizadas.

**De-para de unidades**: a coluna `UNIDADE` da Repercussão Financeira usa
nomes distintos do organograma (ex. "DIInter/1"/"DIInter/2" em vez de
"DINTER I"/"DINTER II", "CAT/Zona da Mata (Carpina)" em vez de "CAT/ZM")
— usuário autorizou construir por inferência de nome (mesmo padrão do
`mapeamento_previsto.json` do QOD), com revisão dele depois.

**Modelo proposto**: ver `DW_MODELO_DADOS.md` (nova seção "Efetivo/RH —
Lotação e Função"). Resumo: entidade `lotacao_funcao` (grão
matrícula+função, de `DIST_FUNCOES`) ligada a `militar` (via matrícula,
já existente) e a `unidade` (via de-para novo). Sem tentar casar
automaticamente com o nível de `SUBSETORES` do app hoje — o texto de
função de `DIST_FUNCOES` é mais granular em vários casos (ex. "grupo de
salvamento" dentro de uma SBS) do que as divisões que o app já exibe.

**Pendência explícita**: cobertura de `DIST_FUNCOES` é parcial (~32%) —
pro restante do efetivo, continuamos só com granularidade de OME
(Pecúlio/Neon) até a planilha ser completada pela CPPA. Não presumir
100% de cobertura em nenhuma extração futura.

**Status**: isto é só o desenho da integração (passo 3 do
`DW_PROCESSO_INTEGRACAO.md`) — nenhum script de extração foi escrito
ainda. Aguardando revisão do usuário antes de implementar.

### 2026-08-17 (mesma sessão) — Implementação da Lotação/Função: script, catálogo oficial e wiring no app

Continuação direta da entrada anterior (desenho). O usuário confirmou onde
isso deveria aparecer na UI e forneceu um 4º arquivo, mudando a estratégia
de casamento de texto:

**Novo arquivo: `Funções - DPlaG.xlsx`** (DPlaG, aba `QOD_FUNCOES`, 1.754
linhas) — catálogo oficial de toda função existente no CBMPE (ID_FUNCAO,
TIPO_FUNCAO, OME, SEÇÃO, FUNÇÃO, observações). **Confirmado pelo
usuário**: "Esse NOME DA FUNÇÃO E SEÇÃO/OME será preenchido, a partir da
próxima planilha, com os valores da coluna FUNÇÃO desta planilha que
enviei" — ou seja, o texto livre do `DIST_FUNCOES` vai deixar de ser
texto livre e passa a ser um valor exato deste catálogo. Isso muda
`extract_lotacao_funcao.py` de "heurística de texto pura" pra "casamento
por catálogo, com heurística só como fallback pra lançamentos antigos".

**Onde aparece na UI** (decisão do usuário, respondendo "de que forma
isso será adicionado ao sistema?"):
1. Nova coluna "Função" na tabela de Efetivo (`EfetivoDetalhe.jsx`).
2. Fonte da contagem de "efetivo atual" por seção/divisão nos Setores
   Vinculados de cada OME (`Diretoria.jsx`) — antes mostrava sempre "x"
   (nenhum dado atual nesse nível, só previsto).

**Implementação**:
- `etl/efetivo/extract_lotacao_funcao.py` (novo) — lê `DIST_FUNCOES`,
  casa cada matrícula com a unidade já conhecida em
  `efetivo_lista.json` (Pecúlio/Neon, nunca a coluna UNIDADE do próprio
  DIST_FUNCOES, que é só fallback/aviso de divergência), e casa o texto
  da função com uma divisão de `SUBSETORES` (organograma.js) em 3 camadas
  de prioridade: (1) catálogo oficial `Funções - DPlaG.xlsx`, (2)
  heurística de texto direto (normalização + contenção de substring +
  sobreposição de palavras + regras de Comando/Subcomando/Diretoria/
  Chefia), (3) rollup subindo a árvore real do QOD (reaproveitando a
  lógica de `extract_previsto_divisoes.py`) pra seções mais finas do que
  `SUBSETORES` reconhece hoje (ex. "Seção de Instrução" dentro de
  "Divisão de Operações"). Gera `src/data/real/lotacao_funcao.json` com
  `por_matricula` (função + posto esperado + portaria + BGE + antiguidade,
  lista pra suportar acúmulo de função) e `por_unidade_divisao` (sigla →
  divisão → lista de matrículas).
- Rodada de 2026-08-17: **716 de 2.659 militares ativos com função
  lançada (~27%)** — confirma a cobertura parcial já esperada. Desses,
  **629 (~88%) foram atribuídos a uma divisão específica** (386 via
  catálogo, 218 via heurística, 154 via rollup — alguns via mais de uma
  camada quando a primeira falhou); 87 ficaram "não classificados"
  (contam no total da unidade, não em nenhuma divisão) — resíduo aceito
  por ora, não vale a pena caçar cada caso residual dado que a cobertura
  de base (27% do efetivo) já é o gargalo principal, não a precisão do
  casamento textual.
- `src/data/organograma.js` (`metricasDivisoesProprias`) — passa a
  expor `efetivoAtual` por divisão (`null` quando a seção ainda não tem
  nenhuma função lançada, nunca `0` fingido).
- `src/pages/Diretoria.jsx` — `celulaPrevistoDivisao` mostra o atual real
  quando existe (`efetivoAtual/previsto`), "x" só quando não há dado
  ainda; legenda nova no rodapé da tabela de Setores Vinculados explicando
  que "x" é dado pendente de lançamento pela CPPA, não confirmação de
  efetivo zero — decisão deliberada pra não deixar a tabela sugerir
  "seção vazia" quando é só falta de lançamento na planilha.
- `src/pages/EfetivoDetalhe.jsx` — nova coluna "Função" (principal,
  filtrável, com o mesmo tratamento de "—" quando ausente); acúmulo de
  função (mesma matrícula, múltiplas linhas em `DIST_FUNCOES`) aparece
  concatenado com " + ".
- Também nesta rodada: botão "Exportar Excel" na tabela de Efetivo
  Detalhe (lib `xlsx`/SheetJS), nome do arquivo `Efetivo - {sigla}.xlsx`,
  respeita os filtros e tipos de coluna ativos.

**Pendência que continua de pé**: 73% do efetivo ainda sem função
lançada — a tabela/coluna vai ficando mais completa conforme a CPPA
avança o preenchimento de `DIST_FUNCOES`, sem precisar de mudança de
código (só re-rodar o script com o arquivo atualizado).

## Pendências práticas (não bloqueiam o planejamento, mas são pré-requisito de implementação)

- **Workspace do Windmill**: ainda precisa ser criado pelo usuário
  (confirmado 2026-08-07); é pré-requisito para configurar o git sync
  (`wmill.yaml`) e gerar o token de API usado pelo `wmill sync push`.
- **Lista de fontes externas**: sistemas externos e planilhas (Google
  Sheets) usados pela corporação ainda precisam ser levantados — é o
  próximo passo prático mais urgente (objetivo 1), com prioridade sobre
  aprofundar sistemas internos.
- ~~Rodar o `windmill-neon.py` atualizado (2026-08-11)~~ — **feito em
  2026-08-12**, ver log de decisões abaixo.

## Perguntas em aberto

- **Catálogo de fontes por domínio**: quais sistemas/planilhas exatos
  alimentam cada um dos 5 domínios da Fase 1? (ver
  [`DW_CATALOGO_FONTES.md`](DW_CATALOGO_FONTES.md), hoje cheio de
  placeholders "A LEVANTAR").
- **Visualizações/KPIs reais**: a definir em sessão com o gestor principal
  da corporação — vai determinar o grão final de cada tabela fato em
  [`DW_MODELO_DADOS.md`](DW_MODELO_DADOS.md).
- **Stack da API**: proposta inicial é Python/FastAPI (mesmo stack do ETL),
  mas não foi formalmente confirmada pelo usuário — ver
  [`DW_ARQUITETURA.md`](DW_ARQUITETURA.md). Confirmado em 2026-08-07: o
  Windmill **não** resolve essa pergunta — ele só executa o ETL e grava no
  Postgres, o app continua precisando de uma camada própria para ler o DW.
- **Conexão do app com o DW antes da migração para o servidor interno**:
  enquanto o app estiver só na Vercel, como (ou se) ele acessa o Postgres
  interno com segurança — ver nota em
  [`DW_ARQUITETURA.md`](DW_ARQUITETURA.md).
- **Autenticação/autorização real**: `src/lib/authClient.js` é hoje um stub
  local sem validação — o desenho de RBAC real para separar acesso a dado
  PII vs. agregado é dependência de uma fase futura (ver
  [`DW_GOVERNANCA.md`](DW_GOVERNANCA.md)).
- **Lista de fontes externas**: quais sistemas externos e planilhas
  (Google Sheets) a corporação usa hoje — ainda não levantado (ver
  pendência prática acima).
- **Mecanismo técnico de conexão do Power BI/Metabase às múltiplas
  fontes** (core/marts + fontes originais simultaneamente): decisão de
  usar conexões diretas já feita, mas a configuração prática (quantas
  conexões, quais credenciais por fonte) fica pra fase de implementação.

## Roadmap por fases

| Fase | Objetivo | Status |
|---|---|---|
| 0 | Planejamento fundacional: decisões-base + documentação (este conjunto de docs) | ✅ Em andamento — concluindo nesta sessão |
| 1 | Levantar fontes **externas** dispersas (sistemas externos, Google Sheets) — prioridade do objetivo 1 | ⏳ Não iniciada |
| 2 | Construir rotinas de coleta (Windmill) para essas fontes externas → `raw`/`staging` | ⏳ Não iniciada |
| 3 | Continuar descoberta de fontes **internas** por domínio (SGP já iniciado), preenchendo `DW_CATALOGO_FONTES.md` | ⏳ Não iniciada |
| 3.5 | Sessão com o gestor principal da corporação para definir visualizações/KPIs reais | ⏳ Não iniciada |
| 4 | Modelar e popular `core` normalizado com os principais dados de todas as fontes (critério de inclusão já definido) | ⏳ Não iniciada |
| 5 | Construir `marts` dimensional sobre o `core`, para o app e consultas estatísticas comuns | ⏳ Não iniciada |
| 6 | Implementar API (proposta: FastAPI) sobre `marts`, plugando em `src/lib/cbmpe.js` | ⏳ Não iniciada |
| 7 | Conectar Power BI/Metabase: acesso comum (`core`/`marts`) + acesso granular (conexões diretas às fontes originais) | ⏳ Não iniciada |
| 8 | Deploy do app + API no servidor interno da corporação, aposentar dados mock | ⏳ Não iniciada |

## Fora de escopo na Fase 0

- Qualquer criação real de schema/tabelas no Postgres.
- Qualquer código de ETL, scaffold de projeto Python, ou API.
- Levantamento fino, sistema por sistema, de cada fonte de dados.
- Sessão de definição de visualizações/KPIs com o gestor da corporação.
