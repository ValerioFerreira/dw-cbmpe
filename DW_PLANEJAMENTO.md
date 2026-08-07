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

## Pendências práticas (não bloqueiam o planejamento, mas são pré-requisito de implementação)

- **Workspace do Windmill**: ainda precisa ser criado pelo usuário
  (confirmado 2026-08-07); é pré-requisito para configurar o git sync
  (`wmill.yaml`) e gerar o token de API usado pelo `wmill sync push`.
- **Lista de fontes externas**: sistemas externos e planilhas (Google
  Sheets) usados pela corporação ainda precisam ser levantados — é o
  próximo passo prático mais urgente (objetivo 1), com prioridade sobre
  aprofundar sistemas internos.

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
