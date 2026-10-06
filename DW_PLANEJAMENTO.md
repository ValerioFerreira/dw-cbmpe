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

## Estado atual — onde retomar (atualizado 2026-10-06)

> **2026-10-06 — Windmill destravado, flow rodando e mais dois domínios no DW.**
> (1) O worker do Windmill estava parado desde 01/10 (11:00 em Recife; TI reiniciou).
> A fila andou e a 1ª rodada com o código novo **falhou no `carga_core`** por culpa nossa:
> `marts.chefe_organograma` dependia de `stg.peculio`, e a carga faz `DROP VIEW` dela. Corrigido
> com `ddl/18_peculio_titular.sql` (tabela `stg.peculio_titular`, recarregada por
> `carregar_peculio_titular()`; a view lê dela). A 2ª rodada falhou por um **bug antigo**: os
> snapshots diários só traduziam `sk_militar`/`sk_viatura` pela chave natural, e voltavam com
> `sk_orgao_externo`/`sk_posto_grad`/`sk_tipo_afastamento` antigos — que mudam quando o Pecúlio
> ganha ou perde um valor (um órgão saiu → violação de FK; antes disso, o histórico podia
> apontar para o órgão errado sem aviso). Agora `SNAPSHOT_FKS` traduz todas pelo valor
> natural. **A 3ª rodada passou inteira** (raw, core, validar: "todas as verificações
> passaram"; 15.922 snapshots restaurados). (2) **Mapa de Força nominal saiu do front**: views
> `marts.mapa_forca_*` (`ddl/16`, janela de 30 dias), rotas `GET /dados/mapa-forca/indice` e
> `/dia/:data` (login SGU, recorte por perfil como Ocorrências); `public/dados/mapa-forca/`
> (91 arquivos, 11,5 MB, públicos) **removido**; o catálogo de postos (sem dado pessoal) vai
> em `backend/data/mapa_forca_postos.json`. (3) **Painel 09** passou a vir do DW
> (`ddl/17`, `marts.painel_cim_*`, `GET /dados/painel/movimentacao`, só acesso total ou
> perfil DGP) com os **dois cards reais do Metabase** (top 10 OMEs por opção; origem por
> `ome_atual`) e filtros Categoria e Motivo; JSON e extrator removidos. **Ainda em aberto**
> (ver "Em aberto e próximos passos"): corte físico dos 30 dias no `core`; painéis pessoais
> de Efetivo/Viaturas e previsto/lotação por divisão ainda em JSON; DDL 16–18 estão no
> repositório mas foram aplicados à mão (o `aplicar_ddl.py` os aplica em ordem).

> **2026-10-06 (noite, 2) — Previsto e lotação por divisão no DW (fim dos JSON do QOD).**
> `efetivo_previsto_divisoes.json`, `lotacao_funcao.json` e os extratores manuais
> (`extract_previsto_divisoes.py`, `extract_lotacao_funcao.py`) foram **removidos**. A carga
> (`carga_core.py`, `carregar_divisoes_qod`, dentro de SAVEPOINT: se quebrar, a carga segue e a
> divisão fica com a rodada anterior) casa o QOD de setembro com as divisões do organograma
> (`stg.divisao_organograma`, cópia de `SUBSETORES` — `ddl/21`; regenerar com
> `etl/dw/gerar_divisoes.py` quando `SUBSETORES` mudar): **previsto** das abas de unidade dos
> quadros (`raw_qod_quadros`; soma 5.247 de 5.249, só difere do JSON de agosto onde o QOD mudou:
> CAT/ZM, DGP, DPLAG, DEIP); **lotação** por texto (mesmas regras do extrator antigo) e, quando
> o texto não casa, pela **hierarquia numerada do quadro** (a seção herda a divisão do ancestral
> mais próximo — o caminho que o extrator antigo dizia faltar): 1.622 de 1.855 funções com
> divisão (antes ~65%) e **1.694 militares lotados em 145 divisões**. Sai em `GET /dados/metricas`
> (`divisoes.previsto` e `.atual`, agregados) e `GET /dados/lotacao` (`por_unidade_divisao`, com
> matrículas, recortado por perfil, para o filtro por setor da tabela de Efetivo). **Para a
> DPlaG:** em 54 divisões a lotação passa do previsto (367 pessoas a mais) — é o QOD ocupando
> mais gente do que o quadro fixa (ex.: 5º GB, SAC: 38 lotados para 4 previstos). **Ainda em
> JSON no front:** só os mocks de métricas de `organograma.js` (e `efetivo.json`,
> `efetivo_previsto.json`, `efetivo_lista.json` como valor de partida).

> **2026-10-06 (noite) — Viaturas sem JSON.** `viaturas.json`, `viaturas_lista.json` e
> `viaturas_detalhe.json` (no bundle, sem login, com placa, chassi e renavam), o extrator
> `extract_viaturas.py` e o protótipo `reconciliar_viaturas.py` (que lia o JSON) foram
> **removidos**. `ddl/20`: `marts.viatura_nominal` (uma linha por veículo cadastrado na Frota,
> inclusive os 35 sem placa que a `core.dim_viatura` não tem; regras do `frota_para_neon.py`:
> última transferência, último status, combustível mais recente, condutores distintos) e
> `GET /dados/viaturas`, recortada no servidor pelo perfil no indicador Viaturas. A tabela, o
> dashboard (5 abas) e a ficha leem a mesma lista (`src/data/viaturasLista.js` →
> `registrosViaturas()`). **O card de Viaturas por unidade** (`marts.frota_organograma`)
> passou a contar da mesma view: o total subiu de 771 para **806** (inclui embarcações e
> reboques sem placa, como a tabela sempre mostrou; sem os descarregados). O baseline do
> organograma agora é 0 até o DW responder (sem mock). **Atenção:** `viatura_nominal` e
> `frota_organograma` dependem de `raw_frota.*`; se a Frota mudar o cabeçalho de alguma
> tabela e a carga a recriar, as views caem e o `ddl/20` precisa ser reaplicado (o card de
> Viaturas some até lá). **Achado de dado:** a última transação de combustível da Frota é de
> **19/01/2026** — o feed (Maxifrota) parou; por isso 78% da frota aparece "sem abastecer há
> 90+ dias" (o painel usa essa data como referência). Confirmar com a Frota. **Ainda em JSON:**
> lotação por divisão e previsto por divisão (`efetivo_previsto_divisoes.json`,
> `lotacao_funcao.json` por divisão) e os mocks de métricas de `organograma.js`.

> **2026-10-06 (tarde) — Dashboard Pessoal de Efetivo sem JSON.** Os seis JSON do painel
> (`militares`, `carreira_extra`, `adidos_extra`, `previsto`, `filtros`, `saida_previsao`; 1,8 MB,
> no bundle, sem login) foram **removidos**. (1) Os registros por militar são montados no front a
> partir da **mesma relação nominal** da tabela de Efetivo (`src/lib/efetivoMilitares.js`; DW,
> recortada por perfil): o painel e a tabela não podem mais divergir; `agregado` passou a
> vir na resposta de `/dados/efetivo`. O campo `ome` segue na grafia curta do Pecúlio
> (`omeSiglaCurta`), para o mapa, os filtros e o drill-down não mudarem. (2) `ddl/19`:
> `marts.previsto_quadro_posto` (previsto dos quadros de setembro por unidade e posto — o
> **Previsto/Déficit passou a valer em qualquer unidade**, antes só no Comando Geral),
> `painel_saida_ano` e `painel_saida_previsao` (SQL do Igor reproduzido), por
> `GET /dados/painel/efetivo`. (3) O painel de Adidos agora conta o tempo na OME em dias/365
> (reproduz o print do Igor; o JSON dava um a menos). (4) Corrigido um bug de cache: o
> `Cache-Control: max-age` era definido ANTES da consulta, então um erro 500 ficava 5 min no
> navegador; agora só sai depois de o dado carregar. **Observações de dado:** o Pecúlio não
> tem nenhum "Cap QOC" (o quadro prevê 97 → déficit 100%); a previsão de saída do SQL do Igor
> também ignora essa patente. **Ainda em JSON no front:** Viaturas (`viaturas*.json`),
> lotação por divisão e previsto por divisão.

> **2026-10-01 — o que mudou desde 29/09, em uma tela.** Detalhe nas quatro entradas
> "2026-10-01" no fim do log de decisões. **Feito:** (1) titular da unidade e matrícula
> vêm do **Pecúlio** (mais antigo da OME), CPP repete a CPO, DGA "Em construção";
> (2) regra de **indisponível** (adido, afastado, LTIP, LE ou agregado) e agregado na OME
> da coluna OME; (3) mocks de **Materiais** e de **Atividades Específicas** removidos
> (Material Operacional descontinuado); (4) **Finanças inteira no DW**, sem JSON nem
> extrator: tratamento só de grafia, aba **Diárias** (ex-Despesas Diversas, sem Auxílio
> Funeral) e aba nova **Despesas Gerais** com filtros de OME, Enquadramento, Situação e
> Mês; (5) **QOD**: aba `ID_ATUALIZADO` é o catálogo de funções (ID fixo) e o previsto por
> unidade passou a vir dos **quadros de setembro** (5.249, o efetivo fixado); (6) dois
> **relatórios** para apresentar (QOD: DPlaG e CPPA; DF: Diretoria de Finanças); (7)
> **LOB Atual/Nova** no organograma (só Administrador, Comandante e Subcomandante Geral);
> (8) flow `f/dw/dw_diario` **republicado** no Windmill (primeira execução com o código novo:
> 05:30 de 02/10). **Em aberto e próximos passos:** seção "Em aberto e próximos passos
> (2026-10-01)" no fim deste arquivo. **Deploy (CapRover) segue em standby**, à espera
> da VM que o TI pediu à ATI.


> **2026-09-29 — DW v1 desenhado; as fontes Postgres internas entram via
> `postgres_fdw`.** O plano completo (estrutura v1, fonte a fonte, ordem de
> execução) está em [`DW_INGESTAO.md`](DW_INGESTAO.md) seção 9, e o detalhe
> na entrada **2026-09-29** do log abaixo. **Estado ao fim do dia:** flow
> `f/dw/dw_diario` publicado e rodando no Windmill (05:30), como `windmill_etl`
> (não superusuário). Vacinação, ROE, QOD, CIM, inativos e escolaridade no DW.
> O app lê efetivo, viaturas e finanças do DW quando o backend está ao
> alcance, com fallback para os JSON na Vercel (`DW_INGESTAO.md` seção 10).
> **Atualização (mesmo dia):** QOD no DW (previsto, chefes, lotação), rotas
> nominais e painéis DF/Vacinação/Ocorrências no backend com recorte por
> perfil no servidor, e build interno (CapRover) sem dado pessoal no bundle —
> `DW_INGESTAO.md` seção 11, com o checklist da transição. **Próximo passo:**
> a transição para o CapRover; depois, os painéis pessoais de Efetivo e
> Viaturas, o Mapa de Força e o casamento seção→divisão no DW.

> **2026-09-23 — autenticação real via SGU e Docker completo, numa worktree
> isolada, para revisão (nada commitado ainda).** `backend/` novo (Express,
> segue a arquitetura do `forms-bm`) faz login via SGU (`POST /auth/login`)
> e verificação de sessão (`GET /auth/me`); `src/lib/authClient.js` ganhou
> esse terceiro caminho sem alterar a assinatura usada por Login/Auth
> Context/etc. `docker-compose.yml` cobre os dois serviços (`app` +
> `backend`), com `Dockerfile`s de produção pro CapRover. **Em aberto**: o
> mapeamento CPF → matrícula → OME (`backend/services/omeResolver.js`) tem
> o pipeline já decidido em 2026-08-24 mas não ligado — falta confirmar
> contra o banco real que a OME "de hoje" vem de `core.fato_efetivo_diario`
> (não de `dim_militar`) e decidir a chave que `/adm` passa a usar pra
> atribuir perfil a militar real. Detalhe completo na entrada **2026-09-23**
> no log de decisões abaixo.

> **2026-09-21 — painéis de BI, nove rodadas no mesmo dia: auditoria →
> pacotes chegaram → VPN ativada → SQL do DF confirmado → DF integrado →
> visuais do DF ajustados → credencial de Vacinação recebida → Dashboard de
> Vacinações (DAS) integrado, 4 abas.**
> Os 9 painéis do Dashboard Pessoal estão completos. Dos quatro painéis
> corporativos, **dois já estão no ar com dado real**: Dashboard DF
> (`/financas/:id/dashboard/:modulo`) e agora **Dashboard de Vacinações**,
> dentro de Atividades Específicas da DAS
> (`/atividades/:id/dashboard/vacinacao-*`, 4 abas). Diferente do DF (que é
> visível em toda unidade, escopado por `permitidas`), o de Vacinações é
> **painel exclusivo da DAS** — decisão do usuário: só quem tem visibilidade
> sobre a DAS (Comando Geral, Subcomando Geral, DGA, a própria DAS) o acessa,
> e não há filtro por unidade de quem está vendo. Fonte:
> `vaccine_control_production` (Postgres interno, 10.193.0.20 — credencial
> read-only fornecida pelo usuário em chat, nunca persistida em `.env.local`
> nesta sessão), view `vw_vaccinations_dashboard`, grão por evento (3.030
> vacinações) — validado batendo exato contra 6 números do protótipo
> (`status_dashboard_vacinacoes.md`). Isso desbloqueou 2 quadrantes que
> dependiam de leitura de imagem no protótipo (Vacinações mensais, Linha do
> tempo por vacina) e viabilizou o Indicador de Participação com dado real
> (antes só tinha 1 exemplo estático congelado). Os outros dois painéis
> (DLOG, Ocorrências) seguem só como protótipo. Ver a entrada **2026-09-21
> (nona rodada)** abaixo para o detalhamento técnico, e
> [`dashboards/PENDENCIAS-PAINEIS-CORPORATIVOS.md`](dashboards/PENDENCIAS-PAINEIS-CORPORATIVOS.md)
> pro estado dos demais.


> **2026-08-24 — o projeto voltou o foco para o DW em si.** Até aqui o
> esforço era demonstrar potencial aos gestores via app. A partir de agora o
> trabalho é o data warehouse real, no banco interno do CBMPE (não no Neon).
> Leia, nesta ordem: a entrada **2026-08-24** no log de decisões abaixo, o
> **"Mapa de conexões"** em [`DW_CATALOGO_FONTES.md`](DW_CATALOGO_FONTES.md),
> e as **"Dimensões conformadas"** em
> [`DW_MODELO_DADOS.md`](DW_MODELO_DADOS.md). O que segue nesta seção é o
> estado do **app**, que continua no ar e válido.
>
> **Ordem de trabalho acordada para o DW:**
> 1. Rotacionar as cinco credenciais expostas e criar roles separadas
>    (`etl_writer`, `bi_reader`, `app_reader`) — antes de qualquer carga.
> 2. Criar o database `dw` com a camada `raw`, carregando **Frota** primeiro
>    (fonte melhor dominada, SQL pronto, não depende de acesso novo).
> 3. **Mapa de força** em seguida — traz seis anos de histórico prontos.
> 4. `ovrsgp` → `raw`, incremental por `dt_atlz`.
>
> **Bloqueado aguardando o usuário:** rodar `--aplicar` no
> `etl/sgp/casar_coordenadas_ome.py` ("só quando tudo for dirimido"), e a
> correção dos adidos no app (criar a OME fantasma ADIDOS com quebra por
> órgão — o total do Comando Geral **não** muda, é aditivo).

Ponto de retomada rápido (o log de decisões completo fica mais abaixo). Todo
o trabalho está commitado e no `origin/main` (ver `git log` pro hash mais
recente — esta sessão trabalhou em mais de uma máquina, então não fixamos
um hash aqui pra não ficar desatualizado). Últimos commits desta rodada:
`89b949f` (navegação/OME/responsividade do Dashboard de Efetivo), `5b1a9ea`
(Dashboard Pessoal de Viaturas, 5 módulos) e, numa sessão seguinte no mesmo
dia, a correção de escopo por unidade nos dois Dashboards Pessoais +
reconciliação da contagem de Viaturas (ver entrada "2026-08-19 (nova
sessão, outra máquina)" no log de decisões e `DW_GOVERNANCA.md`) — **os
Dashboards Pessoais (Efetivo e Viaturas) agora só mostram dado da unidade
sendo visualizada + subordinadas, igual às tabelas reais já faziam**.

**O que já está no ar (app estático na Vercel, lendo JSON de `src/data/real/`):**
- **Efetivo** real por unidade (Neon, tabela `Militar`): KPIs, tabela
  detalhada (`/efetivo/:id`) com filtros estilo planilha, colunas
  redimensionáveis, ordenação por antiguidade, e ficha por militar
  (`/militar/:matricula`) — **só campos não sensíveis** (Caminho A).
- **Dashboard Pessoal de Efetivo** (`/efetivo/:id/dashboard/:modulo`, ver
  `src/pages/efetivo/`) — **os 9 módulos completos**: Efetivo Geral,
  Distribuição Geográfica, Situações Funcionais, Militares Adidos (commit
  `a7fbb44`), Acúmulo de Cargos, Militares PCD's, Movimentação e Carreira,
  Tempo na OME, Intenção de Movimentação. Botão "Retornar" do navegador nas
  abas de módulo usa `<Link replace>` — volta direto pro `/indicador`, não
  pro módulo anterior (commit `89b949f`). Nova fonte Postgres além do Neon —
  "data warehouse" compartilhado (`inativos_metabase`, `peculio_metabase_v1`,
  `cim_pedidos`, `cim_atendidos`), env var `DATABASE_URL_DW`. Duas
  agregações do painel 09 são inferência nossa, a confirmar com Igor — ver
  [Perguntas em aberto](#perguntas-em-aberto).
- **Dashboard Pessoal de Viaturas** (`/viaturas/:id/dashboard/:modulo`, ver
  `src/pages/viaturas/`, commit `5b1a9ea`) — **5 módulos**: Frota Geral,
  Distribuição Geográfica, Idade e Renovação, Tipos e Capacidade
  Operacional, Manutenção/Rastreamento/Uso — fonte `viaturas_detalhe.json`
  (805 viaturas com placa; GTA excluída, mesma regra do KPI real; situação
  "Descarregada" excluída/"Devolvida"→"Ativa", mesma regra de
  `ViaturaDetalhe.jsx`). Todo clique leva à tabela real (`/viaturas/:id`)
  filtrada, mesmo mecanismo do Efetivo.
- **Tabela real de Efetivo e Viaturas** (`EfetivoDetalhe.jsx`/
  `ViaturaDetalhe.jsx`) compartilham agora o mecanismo de filtro-por-URL
  (drill-down) e os helpers genéricos de agregação/geografia, extraídos
  para `src/lib/dashboardHelpers.js`, `src/lib/omeGeografia.js` e
  `filtrosIniciaisDaUrl`/`numeroComparavel` em
  `src/components/ui/filtro-coluna.jsx` — mudança nesse mecanismo agora
  vale pros dois dashboards de uma vez, não precisa mexer em dois lugares.
  `ViaturaDetalhe.jsx` ganhou 7 colunas novas (tipo, destinação, posse,
  combustível, rastreado, categoria de habilitação, condutores),
  enriquecidas por placa a partir de `viaturas_detalhe.json` (cobertura
  parcial — só viaturas com placa cadastrada).
- **Viaturas** real (Neon, sync da Frota): tabela (`/viaturas/:id`) e ficha
  por placa (`/viatura/:placa`).
- **Finanças** real por unidade (Neon).
- **Materiais** e **Atividades Específicas**: "Em construção" (sem dado).
- Organograma com protótipo de níveis de acesso (localStorage, sem auth
  real) — ver `src/lib/accessControl.js`.

**Próximos passos concretos (em aberto, ver [Perguntas em aberto](#perguntas-em-aberto)):**
1. **Rotacionar a credencial do Postgres do data warehouse**
   (`10.193.1.252:54301`, usuário `datawarehouse-user`) — passou em texto
   puro pelo chat (dentro de um script de carga que o usuário colou) antes
   de virar variável de ambiente local. Mesma recomendação pendente já
   registrada antes para a senha do banco da Frota.
2. **2 agregações do painel 09 a confirmar com Igor** ("Distribuição das
   solicitações" por motivo, "Origem das solicitações" por OME) — o SQL
   original se perdeu num resumo de contexto antes de chegar até nós.
3. **Conexão ao SGP** (`ovrsgp`) — host/credenciais/rede a partir do
   Windmill. É o bloqueador pra escrever/rodar o `windmill-sgp.py` e
   engatilhar o **Caminho B** (ficha completa do militar atrás de auth real).
4. **Remover dado sensível já público**: `racaCor`, `pcd` e telefones no
   `efetivo_lista.json` (painel "Verificar dados completos") contradizem o
   denylist do Caminho A — remover num próximo passo, confirmando com o
   usuário.
5. Fontes externas por domínio ainda a levantar (objetivo 1).
6. **13 viaturas com "ano: 23" em `viaturas_detalhe.json`** (erro de
   digitação/truncamento na fonte, não 1923 nem 2023) — hoje só excluídas
   dos gráficos de idade do Dashboard de Viaturas (`anoValido`), não
   corrigidas na origem. Ver [Perguntas em aberto](#perguntas-em-aberto).

**Para rodar/retomar noutra máquina:**
- `npm install` && `npm run dev` (Vite, porta 5173).
- **`.env.local` é gitignored** — recriar com `DATABASE_URL_EFETIVO`,
  `DATABASE_URL_VIATURAS`, `DATABASE_URL_FINANCAS` e **`DATABASE_URL_DW`**
  (Postgres do data warehouse compartilhado, usado pelos extratores de
  Movimentação/Carreira e Intenção de Movimentação) pra rodar os
  extratores em `etl/`. Sem elas o app ainda funciona (lê os JSON já
  commitados); só a reextração precisa delas.
- **`ddl-sgp.sql`** (schema do SGP) foi compartilhado pelo usuário e **não
  está no repositório** (fica no Desktop da máquina original). As tabelas
  relevantes estão resumidas em `DW_MODELO_DADOS.md`.
- Os scripts `etl/**/windmill-*.py` **não são rodados pelo Claude** — o
  usuário publica/roda no Windmill (fazem TRUNCATE+insert em tabelas Neon
  compartilhadas). Os `extract_*.py` locais são seguros (só SELECT + geram
  JSON).

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

### 2026-08-17 (mesma sessão) — Bug corrigido: vagas de 1 pessoa (Comando/Subcomando/Diretoria/Chefia) com mais de 1 militar

Usuário reportou que algumas unidades mostravam mais de 1 militar em
seções que só comportam 1 (Comandante, Subcomandante, Diretor — 1 por
unidade final). Causa raiz, achada por depuração direta no
`lotacao_funcao.json`: **`"comandante"` é literalmente uma substring de
`"subcomandante"`** (palavras coladas, sem espaço) — o casamento por
contenção de substring pura (tanto contra o catálogo de funções quanto
contra as divisões de `SUBSETORES`) tratava "Comandante" como se
"casasse" dentro de "Subcomandante", e vice-versa a heurística genérica
também deixava "Comando"/"Diretoria" (nomes curtos e comuns) vencerem
por engano quando o texto real da função só continha a palavra solta
"comando" em outro contexto (ex. "Secretaria e **Ajudância do Comando**",
que devia casar com a seção "Secretaria e Apoio do Comando", não com o
cargo de Comandante). O rollup na árvore do QOD piorava isso: ao não
achar nada mais específico, subia até a raiz da árvore (frequentemente
literalmente chamada "Comando"/"Diretoria") e atribuía a ela qualquer
função não classificada.

**Correção em `etl/efetivo/extract_lotacao_funcao.py`**:
1. Comparações de substring passam a exigir borda de palavra
   (`contem_palavra()`, regex `\bpalavra\b`) em vez de `in` puro — resolve
   a colisão "comandante"/"subcomandante".
2. Divisões de vaga única (`DIVISOES_SINGULARES = {"comando",
   "subcomando", "diretoria", "chefia"}`) ficaram **fora** das passagens
   genéricas de substring/sobreposição de palavras — só podem ser
   preenchidas pelas regras explícitas de prefixo (a função tem que
   começar com "comand"/"subcomand"/"diretor", ou ser "Chefe do/da
   {sigla}").
3. O rollup na árvore do QOD nunca aceita mais essas divisões como
   destino — se a única correspondência encontrada subindo a árvore for
   uma vaga singular, o resultado fica "não classificado" em vez de
   forçar a atribuição.

**Resultado após a correção**: rodada de re-extração confirmou que
nenhuma das divisões singulares (Comando, Subcomando, Diretoria, Chefia)
tem mais de 1 militar em nenhuma unidade — todas com exatamente 0 ou 1.
Efeito colateral positivo: em pelo menos um caso (GBI "Secretaria e
Ajudância do Comando"), remover "Comando" da disputa fez o casamento por
sobreposição de palavras achar a divisão certa ("Secretaria e Apoio do
Comando - SAC") em vez de nenhuma. Total classificado caiu ligeiramente
(747 de 845 linhas, vs. 716 antes — a base de comparação mudou porque
"não classificado" honesto agora é preferido a uma atribuição errada).

**Segundo caso achado ao verificar se o erro se repetia em outros
setores** (checagem sistemática: atual > previsto em toda `SUBSETORES`
de toda unidade coberta): `DJD / Divisão de Planejamento de Justiça e
Disciplina` tinha 2 militares pra previsto=1 — o Diretor de Justiça e
Disciplina estava caindo lá em vez de em "Diretoria", porque o título
"Diretor(a) de Justiça e Disciplina" empata na sobreposição de palavras
com "Divisão de Justiça e Disciplina" e com "Divisão de Planejamento de
Justiça e Disciplina" (o cargo cita o domínio da própria unidade, que
também aparece no nome das divisões internas) — a regra de prefixo
"diretor" só era testada depois desse fallback fuzzy, tarde demais.
**Correção**: as regras explícitas de prefixo (Comandante/Subcomandante/
Diretor/Chefe do X) agora rodam antes do fallback de sobreposição de
palavras, não depois. Reverificado: também corrigido.

**Único resíduo restante** (checado e não é bug de casamento): `GBS /
Divisão de Operações - Div. Op.` mostra atual=11 pra previsto=10.
Inspecionei a aba bruta do QOD pra essa unidade — o previsto=10 está
certo (1 Chefe + 2 Auxiliares próprios + 3 Auxiliares da SICT + 4
Auxiliares da SEO). As 11 pessoas atribuídas têm texto de função
genuinamente específico (5 delas com o texto literal "Auxiliar da
Divisão de Operações", só 2 vagas previstas com esse texto exato) — não
é erro de casamento, é uma divergência real entre o QOD (plano de vagas)
e o `DIST_FUNCOES` (lotação real, que pode ter excedente ou registro
menos detalhado que o esperado). Registrado como limitação conhecida,
não como bug.

### 2026-08-17 (mesma sessão) — Tabela de Viaturas ganha Situação; NOME/PATRIMÔNIO/ANO pendentes (não existem no Neon)

Usuário pediu SITUAÇÃO, NOME, OME, PLACA, PATRIMÔNIO, MARCA/MODELO e ANO
na tabela de Viaturas. OME/PLACA/MARCA-MODELO já eram as 3 colunas
existentes. Inspecionei a tabela `Viatura` do Neon diretamente
(`information_schema.columns`) antes de mexer em qualquer coisa —
colunas reais: `id, tipo, omeId, omeAcronym, status, stillUsable,
updatedAt, placa, marca, modelo`. **NOME, PATRIMÔNIO e ANO não existem
nessa tabela** — não dava pra simplesmente "puxar", perguntei antes de
assumir.

**Decisão do usuário**: adicionar SITUAÇÃO (`status`) agora, já que
existe; estender a sincronização via Windmill pra trazer NOME/PATRIMÔNIO/
ANO da fonte original de frotas (mesmo padrão já usado pro Efetivo com
`windmill-neon.py`) — ainda não escrito, porque não tenho visibilidade
do schema da fonte original de frotas (não há `windmill-viaturas.py` no
repo nem no Downloads compartilhado) — fica pendente até o usuário
compartilhar essa fonte ou o schema dela.

**Implementado**: `etl/viaturas/extract_viaturas.py` passou a selecionar
`status` também, gravando `situacao` em cada item de
`viaturas_lista.json`. Tabela em `src/pages/Indicador.jsx`
(`TabelaViaturas`) ganhou a coluna "Situação". Rodei o script contra o
Neon real (`DATABASE_URL_VIATURAS` já configurado em `.env.local`) —
valores reais confirmados: Ativa, Manutenção, Devolvida, Descarregada,
Processo de Desfazimento.

**Resolvido na mesma sessão**: o usuário colou o script Windmill real
(`windmill-viaturas.py`, sync Frota→Neon), o que deu visibilidade da
fonte original. Conectei direto na base interna de frotas
(`10.193.1.252`, acessível a partir deste ambiente) e inspecionei
`information_schema.columns` de `vehicles` antes de escrever qualquer
coisa:
- **NOME** = `vehicle_types.name` (nome do tipo de viatura, ex. "Auto
  Bomba Tanque") — já vinha sincronizado pro Neon como `tipo`, só não
  estava exposto em `viaturas_lista.json`/na tabela. Resolvido sem
  precisar de mudança no Windmill — só extrair de novo e adicionar a
  coluna "Nome" na UI. Verificado no navegador com dados reais (29
  tipos distintos, ex. "Auto Bomba Tanque", "Auto Resgate", "Reboque").
- **ANO** = `vehicles.year`, **PATRIMÔNIO** = `vehicles.patrimony` —
  existem na fonte, mas não estavam sendo sincronizados pro Neon.
  Preparei `etl/viaturas/windmill-viaturas.py` (versão estendida do
  script que o usuário roda no Windmill, com `ano`/`patrimonio`
  adicionados à tabela `Viatura` do Neon) — **não rodei esta parte**,
  por ser um `TRUNCATE` + reinserção numa tabela Neon compartilhada;
  fica pro usuário publicar no Windmill e rodar, mesmo fluxo já usado
  pro Efetivo. Depois disso, `extract_viaturas.py` precisa ganhar
  `ano`/`patrimonio` no SELECT (ainda não fiz essa parte porque tentar
  rodar antes do Windmill sincronizar quebraria — as colunas não
  existem no Neon ainda).

### 2026-08-18 — Fluxo de acesso da tabela de Viaturas igualado ao de Efetivo; tabelas redesenhadas; NOME muda de definição

**Resolvido**: o usuário rodou a extensão do Windmill preparada na sessão
anterior — `ano` e `patrimonio` já estão no Neon, populados (confirmado
via `information_schema.columns` + amostra: `id=1, placa=KJX1487,
ano=2006, patrimonio=270600040`, batendo com o print da AP-32 que o
usuário enviou). `etl/viaturas/extract_viaturas.py` passou a selecionar
os dois e gravá-los em cada item de `viaturas_lista.json`; rodei contra o
Neon real, 840 viaturas.

**Pedido do usuário**: dois ajustes na tabela de Viaturas.

1. **Fluxo de acesso igual ao de Efetivo**: a tabela de Viaturas abria
   inline (toggle escondendo/mostrando) dentro de `Indicador.jsx`,
   diferente do Efetivo, que navega pra uma página própria
   (`/efetivo/:id`) com filtros por coluna e exportação Excel. Corrigido:
   nova página `src/pages/ViaturaDetalhe.jsx` (rota `/viaturas/:id`),
   mesmo padrão de `EfetivoDetalhe.jsx` — breadcrumb, unidade + subárvore
   de subordinadas, filtro "funil" por coluna, paginação (10/20/50),
   exportação `.xlsx`. O botão em `Indicador.jsx` virou um card-link
   idêntico ao de Efetivo (antes era um botão de toggle). A
   `TabelaViaturas` inline foi removida de `Indicador.jsx`.

   Extraí o componente `FiltroColuna` (+ `passaFiltro`/`valorFiltro`) de
   dentro de `EfetivoDetalhe.jsx` pra `src/components/ui/filtro-coluna.jsx`
   — é lógica não-trivial (cálculo manual de posição do balão, corrigindo
   o `html { zoom: 1.25 }` global) que agora as duas páginas
   (Efetivo e Viaturas) reaproveitam, em vez de duplicar.

   Clique numa linha continua abrindo `/em-construcao/:placa` (como o
   Efetivo abre `/em-construcao/:matricula`) — a página de detalhamento
   por viatura de verdade é o próximo passo, ver entrada abaixo.

2. **Redesenho visual das duas tabelas** (Efetivo e Viaturas), com base em
   dois prints de sistemas reais da corporação que o usuário enviou (um
   sistema de ocorrências com cabeçalho rosa/claro e linhas espaçadas; e
   uma listagem de viaturas do próprio sistema de frotas, com cabeçalho
   branco em negrito, zebra striping e badges de status coloridos).
   Decisão: manter a paleta de cores já usada no app (`--primary`,
   `--muted` etc., pra não destoar do tema/dark-mode existente) mas
   incorporar o que as duas referências fazem bem — cabeçalho com fundo
   destacado (`bg-muted/70` + `backdrop-blur-sm`, sticky) e texto em
   negrito, borda inferior mais forte (`border-b-2 border-primary/25`),
   zebra striping nas linhas (`even:bg-muted/25`), hover mais visível
   (`hover:bg-primary/10`), e mais espaçamento nas células
   (`px-3 py-2.5`, antes `p-2.5`). Aplicado nas duas tabelas.

   Novo componente `src/components/ui/badge-situacao.jsx` — badge com as
   cores exatas pedidas pelo usuário: Ativa `#90EEB1`, Manutenção
   `#9A0100` (texto branco, por contraste), Processo de Desfazimento
   `#FBBE7F`. Os demais status (Descarregada, Devolvida) caem num badge
   neutro (`--muted`), já que o usuário só especificou essas três cores.
   Nota: a fonte de frotas já tem sua própria paleta em
   `vehicle_status_types.color` (`Ativa #86efac`, `Manutenção #ef4444`,
   `Processo de Desfazimento #fdba74`, entre outras) — deliberadamente
   **não** usei essas cores, porque o usuário pediu cores específicas pro
   app do DW.

3. **NOME muda de definição**: era `vehicle_types.name` (nome por
   extenso, ex. "Auto Bomba Tanque"); usuário quer o mesmo identificador
   mostrado no sistema de frotas (ex. "AP-32", "AT/1-80") — confirmado
   como `vehicle_types.acronym + "-" + vehicles.order_number`. Nenhum dos
   dois campos estava sincronizado pro Neon. Preparei (**não rodei**) uma
   extensão de `etl/viaturas/windmill-viaturas.py`: adiciona
   `vt.acronym`/`v.order_number` ao SELECT da fonte e duas colunas novas
   na tabela `Viatura` do Neon (`tipoAcronym`, `numeroOrdem`). Mesmo
   motivo de sempre pra não rodar eu mesmo: é um `TRUNCATE` + reinserção
   numa tabela Neon compartilhada — fica pro usuário publicar/rodar no
   Windmill. Até lá, `extract_viaturas.py` continua usando `tipo` (nome
   por extenso) como "nome", deliberadamente, pra não quebrar antes da
   sincronização existir — depois de rodado, preciso voltar em
   `extract_viaturas.py` pra trocar a fonte do campo "nome" (mesmo padrão
   de duas etapas já usado com sucesso pra ano/patrimônio).

**Colunas finais da tabela de Viaturas** (ordem pedida pelo usuário):
Nome, OME, Placa, Patrimônio, Modelo, Ano, Situação (badge).

### 2026-08-18 — Levantamento do DDL de frotas para a página de detalhamento por viatura (não implementado — aguardando confirmação)

Usuário enviou um print de uma página de detalhamento de viatura de um
sistema real da corporação (viatura "AP-32") e pediu que, ao clicar numa
viatura na tabela, abra uma página semelhante — mas foi explícito: antes
de implementar, revisar o DDL da fonte de frotas "card a card", entender
o que dá pra mapear, e tirar dúvidas antes de desenhar o Windmill novo.
Segue exatamente o `DW_PROCESSO_INTEGRACAO.md`: entender antes de
desenhar. **Nada disso foi implementado ainda** — só investigação.

Conectei na base de frotas (`10.193.1.252`) e listei todas as tabelas do
schema `public` (antes só conhecíamos `vehicles`, `vehicle_types`,
`omes`, `transfers`, `vehicle_statuses`, `vehicle_status_types` — a lista
completa é bem maior: `fuel_transactions`, `license_categories`,
`vehicle_destination_types`, `vehicle_document_types`,
`vehicle_documents`, `vehicle_fuel_types`, `vehicle_maintenance_types`,
`vehicle_maintenances`, `vehicle_observation_types`,
`vehicle_observations`, `vehicle_ownership_types`, `reports_vehicles`,
entre outras de infraestrutura do Rails/Active Storage/good_job que não
interessam ao DW).

**Card "Resumo" do print — mapeamento direto, sem ambiguidade**: OME
(`transfers`/`omes`, já sincronizado), Posse
(`vehicle_ownership_types.name` via `vehicles.vehicle_ownership_type_id`),
Tipo (`vehicle_types.acronym`), Nº de Ordem (`vehicles.order_number`),
Tipo de Combustível (`vehicle_fuel_types.name` via
`vehicles.vehicle_fuel_type_id`), Ano/Marca/Placa/Modelo (já
sincronizados).

**Card "Outros" do print — mapeamento direto, sem ambiguidade**: Nº do
Patrimônio (já sincronizado), Renavam (`vehicles.renavam`, não
sincronizado), Destinação (`vehicle_destination_types.name` via
`vehicles.vehicle_destination_type_id`), Rastreado?
(`vehicles.is_tracked`, boolean), Chassis (`vehicles.chassis`, não
sincronizado), Caracterizado? (`vehicles.is_characterized`, boolean),
Categoria de Habilitação (`license_categories.code` via
`vehicles.license_category_id`).

**Widgets do topo do print — mapeamento com hipótese, a confirmar**:
- **Odômetro / Último Abastecimento**: `fuel_transactions` tem
  `vehicle_id, time, total_value, mileage` — a leitura mais recente por
  veículo bate exatamente com o print (testei com o `vehicle_id=1`, que é
  a própria AP-32 do print: `mileage=16200.0`, `total_value=981.61`,
  `time=2025-09-05` — os três valores batem exatamente com "Odômetro
  16.200 Km" e "Último Abastecimento R$ 981,61 · 05/09/2025"). Forte
  indício de que a hipótese está certa, mas não pedi confirmação ainda.
- **Saldo do Cartão**: não encontrei nenhum campo de saldo/limite em
  nenhuma tabela — nem em `fuel_transactions` nem no `raw_data` (jsonb)
  de cada transação (que tem campos tipo `cartao`, `condutor`, `valor`,
  mas nenhum "saldo"). Consistente com o próprio print, que mostra
  "Content missing" nesse widget — parece que nem o sistema de origem tem
  esse dado disponível de forma confiável (provavelmente uma consulta ao
  vivo à operadora do cartão, tipo Maxifrota, que falhou nesse caso).
- **Condutores** (o print mostra "6"): não existe tabela de
  condutores/motoristas no schema. Mas o `raw_data` jsonb de
  `fuel_transactions` tem uma chave `condutor` (nome da pessoa que
  abasteceu, vindo da operadora externa "Maxifrota") — hipótese: é a
  contagem de condutores distintos que já abasteceram aquela viatura. Não
  cheguei a confirmar comparando com o número real do print. Se for isso,
  é dado potencialmente PII (nome de pessoa) dentro de um campo JSON de
  texto livre vindo de fonte externa — mostrar só a contagem (como o
  print já faz) evita expor nome, mas extrair exigiria parsear JSON linha
  a linha, não é uma coluna normal.

**Abas do print** (Abastecimentos, Documentos, Manutenções, Observações,
Histórico) mapeiam para tabelas que já existem: `fuel_transactions`,
`vehicle_documents`, `vehicle_maintenances`, `vehicle_observations`
respectivamente; "Histórico" não ficou claro se é o histórico de status
(`vehicle_statuses`) ou de transferências (`transfers`) ou os dois
juntos.

**Não avancei para desenhar o Windmill nem a página** — ficam pendentes
as perguntas registradas em "Perguntas em aberto" abaixo, conforme
pedido explícito do usuário de tirar dúvidas antes de desenhar qualquer
integração nova.

### 2026-08-18 — Respostas do usuário às dúvidas de DDL; página de ficha da viatura implementada (prepara Windmill, não roda)

Usuário respondeu às 4 perguntas levantadas na entrada anterior:

1. **Saldo do Cartão**: fica de fora por agora — usuário vai enviar depois
   os detalhes de uma API externa da operadora do cartão de combustível.
   Não implementado, não hardcoded como "Content missing" nem nada — o
   widget simplesmente não existe na página.
2. **Condutores**: seguir com a hipótese (contar `condutor` distintos no
   `raw_data` de `fuel_transactions`), **mas com ressalva explícita** —
   usuário pediu pra deixar registrado que ainda não foi formalmente
   confirmado. Ressalva presente em três lugares: docstring do
   `windmill-viaturas.py`, comentário em `extract_viaturas.py`, e um
   ícone de "info" com tooltip no campo "Condutores" da própria UI
   (`ViaturaFicha.jsx`).
3. **Tabelas de lookup** (Posse, Destinação, Combustível, Categoria de
   Habilitação): sincronizar só o texto já traduzido, denormalizado
   direto na tabela `Viatura` do Neon — mesmo padrão já usado pra
   tipo/status. Confirmado, sem criar tabelas de dimensão à parte.
4. **Escopo das abas**: só "Detalhes" (cards Resumo + Outros) por
   enquanto — Abastecimentos/Documentos/Manutenções/Observações/
   Histórico ficam pra depois.

**Implementado com essas respostas**:
- `etl/viaturas/windmill-viaturas.py` — estendido (preparado, **não
  rodado**, mesmo motivo de sempre) com todos os campos confirmados:
  `renavam`, `chassis`, `rastreado`, `caracterizado`, `posse`,
  `destinacao`, `combustivel`, `categoriaHabilitacao`, `odometro`,
  `ultimoAbastecimentoValor`, `ultimoAbastecimentoData`, `condutores`.
- `etl/viaturas/extract_viaturas.py` — ganhou uma terceira saída,
  `src/data/real/viaturas_detalhe.json` (um registro por placa). Como as
  colunas novas ainda não existem no Neon, a consulta correspondente
  **checa `information_schema.columns` antes** e só roda se todas
  existirem — testado rodando o script agora: gerou `viaturas.json`/
  `viaturas_lista.json` normalmente e avisou
  "`viaturas_detalhe.json` NÃO gerado — colunas ainda pendentes", sem
  quebrar nada. Isso significa que, quando o usuário rodar o Windmill
  estendido, basta rodar este script de novo — não preciso editar código
  de novo (dispensa o padrão de "duas edições" usado antes pra
  ano/patrimônio).
- `src/pages/ViaturaFicha.jsx` (rota `/viatura/:placa`) — nova página,
  clique numa linha da tabela de Viaturas agora abre ela (antes ia pra
  `/em-construcao/:placa`). Cabeçalho com nome + badge de situação,
  widgets de Odômetro e Último Abastecimento (sem Saldo do Cartão),
  cards "Resumo" e "Outros" com todos os campos mapeados no DDL. Mostra
  um estado de "pendente de sincronização" (via `EmptyState`) quando a
  placa ainda não tem ficha em `viaturas_detalhe.json` — que é o caso de
  **todas** as placas agora, já que o Windmill ainda não rodou; criei
  `src/data/real/viaturas_detalhe.json` com `por_placa: {}` como
  placeholder pra o import não quebrar o build antes da primeira geração
  real. Verificado no navegador: mostra corretamente o estado pendente,
  sem erros de console.

**Pendência final**: usuário publica/roda a versão estendida de
`windmill-viaturas.py` no Windmill → rodar `extract_viaturas.py` de novo
→ a ficha passa a mostrar dado real automaticamente, sem mais mudança de
código necessária.

### 2026-08-18 — Windmill rodado: ficha da viatura e NOME=acronym-numeroOrdem ao vivo

Usuário confirmou ter publicado/rodado a versão estendida de
`windmill-viaturas.py`. Rodei `extract_viaturas.py` de novo — como
desenhado, não precisei tocar em código pra `viaturas_detalhe.json`
começar a sair: gerou 806 fichas de primeira (depois 805, ver abaixo).

Duas coisas a mais, descobertas e corrigidas nesta passada de
verificação antes do commit:

- **Placa vazia/com espaço**: 2 das 806 fichas tinham `placa` vazia ("")
  ou com espaço em branco ao redor (dado real da fonte — ex. embarcação
  sem placa cadastrada). Isso quebraria a navegação `/viatura/:placa`
  pra esse caso (URL vazia não bate com a rota). Corrigido em duas
  pontas: `extract_viaturas.py` agora normaliza (`.strip()`) e **pula**
  fichas sem placa (não tem como ter uma "ficha" endereçável sem placa);
  `ViaturaDetalhe.jsx` não navega mais se a linha clicada não tiver
  placa. Resultado: 805 fichas geradas, sem regressão visível (a viatura
  sem placa já aparecia como "—" na coluna Placa da tabela, só não abria
  mais um link quebrado ao clicar).
- **NOME na lista principal (`viaturas_lista.json`) ainda não tinha
  virado `tipoAcronym-numeroOrdem`** — essa troca dependia do mesmo
  Windmill que só rodou agora; reordenei `extract_viaturas.py` pra
  checar o schema do Neon **antes** da consulta principal (não só antes
  da consulta da ficha) e trocar a fonte do "nome" automaticamente,
  com fallback pro `tipo` por extenso se as colunas não existirem —
  mesmo mecanismo de auto-detecção já usado pra `viaturas_detalhe.json`.
  Verificado no navegador: coluna Nome da tabela de Viaturas agora
  mostra "ATP/1-086L", "ACO-001" etc., e a ficha de uma viatura
  (`/viatura/PBZ2B99`, ACO-001 do GCG) mostra todos os campos populados
  com dado real (Odômetro 4.905 Km, Último Abastecimento R$ 98,71 de
  14/01/2026, Posse Próprio, Destinação Administrativo, Rastreado? Sim,
  Condutores 40, etc.).

Commit e push autorizados pelo usuário após essa verificação.

### 2026-08-18 — Ajustes de UX nas tabelas, header mobile, OME de adidos e sinais de acesso no organograma

Lote de ajustes pedidos pelo usuário:

1. **Tabelas (Efetivo e Viaturas) sem seletor de tipo de coluna**: o
   dropdown de tipo (Texto/Data/Nº) por coluna e a barra de agregadores
   (que dependia dele) foram removidos — "manter só os filtros". Cada
   coluna passa a usar o tipo fixo que já era o padrão; quem quiser
   reinterpretar exporta o `.xlsx` e ajusta lá. Cabeçalhos ficaram mais
   estreitos (só rótulo + funil de filtro).
2. **Barra de rolagem horizontal no topo E embaixo da tabela**, mais
   escura/visível: novo componente `src/components/ui/scroll-duplo.jsx`
   (duas barras sincronizadas) + utilitário CSS `.scrollbar-escuro` em
   `index.css`. Aplicado nas duas tabelas.
3. **Zebra striping mais forte**: linhas ímpares brancas, pares
   `bg-muted/60` (antes `even:bg-muted/25`).
4. **OME "ADIDO"**: militares adidos apareciam na tabela do Comando Geral
   com OME "COMANDO GERAL". Agora mostram "ADIDO" (fonte de origem
   `ome='ADIDO'`); só o comandante geral (`ome='CG'`) mostra "COMANDO
   GERAL". Feito em `extract_efetivo.py` (novo campo `omeExibicao` por
   registro) + `EfetivoDetalhe.jsx`. Reextraído do Neon (2.658 no total,
   inalterado).
5. **Header mobile reordenado** (`Topbar.jsx`): linha única com menu,
   Org., Claro/Escuro, PDF, nome do usuário (ícone de perfil, sem
   "Bem-vindo") e Sair; caixa de busca logo abaixo. Layout desktop
   separado do mobile (antes era um grid único com overrides `lg:`).
6. **Viaturas — regras de situação**: viatura "Descarregada" some da
   tabela; "Devolvida" é exibida como "Ativa" (transformação na base, vale
   pro badge, filtro e exportação). Total do Comando Geral: 840 → 771.
7. **Organograma — fundo/cantos das divisões de agrupamento**: as `div`s
   que agrupam cards (assessorias, DGO/DGA, grupos de diretoria, atalhos de
   KPI) passaram de `bg-muted/30` para `bg-background` (#F5F5F5, igual ao
   body); os cards individuais continuam brancos. As divisões de
   assessorias do Comando/Subcomando estavam com cantos errados
   (`rounded-t-none border-t-0`) — agora têm os 4 cantos arredondados e
   borda em cima e embaixo.
8. **Organograma — sinais de acesso** (usuário de nível, acesso parcial):
   cards SEM acesso ganham um cadeado semitransparente centralizado
   (`Lock`), com as informações ainda visíveis por baixo; cards COM acesso
   ganham uma borda amarela fina constante (o realce que antes só aparecia
   no hover). O banner "CBMPE - Geral" fica apagado (opacity + cadeado)
   quando o usuário de nível não tem nenhum acesso ao topo (nem COMANDO
   GERAL, nem KPI do topo). Substitui o antigo esmaecimento geral
   (`RESTRITO_CLASSES`). Verificado no navegador com o usuário de nível
   "4GB": 4º GB com borda amarela, GBI/etc. com cadeado, CBMPE-Geral
   apagado.

### 2026-08-19 — Segundo lote de ajustes de UX (tabelas + organograma)

Novo lote pedido pelo usuário, sobre o de 2026-08-18:

1. **Efetivo — célula de Posto/Graduação sem rótulo interno**: a célula
   mostrava um mini-rótulo "Posto"/"Graduação" acima do valor; removido —
   fica só o valor, o título da coluna já diz o que é. Removida também a
   função `isOficial` (só servia pra esse rótulo).
2. **Colunas com largura limitada + redimensionáveis pelo usuário**: novo
   componente compartilhado `src/components/ui/tabela-colunas.jsx`
   (`useLarguras`, `ColGroup`, `AlcaResize`, `CELULA_TRUNCADA`). As duas
   tabelas passaram a `table-fixed` com `<colgroup>` de larguras por coluna;
   conteúdo que passa da largura é cortado com reticências (`title` no
   `td` mostra o valor completo no hover). Cada cabeçalho tem uma alça na
   borda direita pra arrastar e mudar a largura (delta dividido pelo
   `zoom` 1.25 da página pra casar com o cursor). Larguras iniciais
   declaradas por coluna; estado só em memória (reseta ao trocar de
   unidade). Removida a quebra de linha (`quebrar`) de Nome/Função —
   agora tudo trunca.
3. **Efetivo ordenado por antiguidade, não por OME**: a tabela agrupava
   por OME (unidade + subordinadas em sequência). Agora ordena globalmente
   pelo índice de antiguidade do Neon (`ordemHierarquica`), novo campo
   `ordem` por registro em `extract_efetivo.py` (reextraído: 2.658, 187
   ADIDO — inalterado). Quem tem `ordem` nula vai pro fim. Verificado: o
   comandante geral aparece em 1º e as OMEs ficam intercaladas.
4. **Organograma — cards bloqueados apagados + cadeado no canto**: reverteu
   o cadeado central de 2026-08-18 para o comportamento "apagado" anterior
   (`opacity-50 saturate-[0.4]`) com o cadeado num canto — superior direito
   na maioria, inferior direito nos cards de COMANDO GERAL e SUBCOMANDO
   GERAL (`CadeadoOverlay` ganhou prop `posicao`).
5. **Organograma — divisões de agrupamento com mais contraste**: as `div`s
   dos grupos de diretoria (DIM, DINTER I/II, DIESP, DLOG, DEIP) passaram
   de `bg-background` (#F5F5F5, igual ao container-pai) para
   `bg-black/[0.05]`, um cinza um pouco mais escuro.
6. **Sombra 3D leve em todos os cards**: constante `SOMBRA_CARD`
   (`shadow-[2px_3px_5px_-2px_rgba(0,0,0,0.14)]`) no canto inferior direito,
   aplicada aos cards que não tinham sombra (atalhos de KPI, assessorias,
   filhos de grupo); os cards de estrela/diretoria já tinham sombra própria.
7. **Nota "x = seção ainda sem função…" alinhada à direita** (`Diretoria.jsx`,
   `text-right`).
8. **Barras verticais ao lado dos nomes de OME todas vermelhas**: as barras
   coloridas por tipo de unidade (`CORES_TIPO[tipo].dot` — vermelho, verde,
   azul, laranja) em `Diretoria.jsx` e `org-node-card.jsx` passaram todas a
   `bg-primary` (o vermelho do menu lateral). Removido o import agora ocioso
   de `CORES_TIPO` em `Diretoria.jsx`.

Tudo verificado no navegador embutido (computed styles, sem screenshot — o
painel não estava compondo frames): tabela de Efetivo `table-fixed` com 28
colunas, alça de resize funcionando (largura muda ao arrastar), truncagem
com reticências, célula de posto sem rótulo, ordenação por antiguidade;
tabela de Viaturas idem (7 colunas, badge de situação intacto); barra
vermelha `rgb(197,17,50)` e nota à direita no `Diretoria`; e o usuário de
nível "4GB" com cards bloqueados a `opacity 0.5` + cadeado (superior direito
nos comuns, inferior direito no COMANDO GERAL).

### 2026-08-19 — Ficha do militar a partir do SGP: Caminho A (público, não sensível) agora; Caminho B (completo) engatilhado

O usuário pediu que, ao clicar num militar na tabela de Efetivo, abra uma
ficha com dados do SGP (`ovrsgp`), como fizemos pra viatura. Seguindo
`DW_PROCESSO_INTEGRACAO.md`, esclareci antes de desenhar. Confirmado:

- **Chave de junção**: a **matrícula**. A "planilha do pecúlio" é a mesma
  lista que já mostramos (base Neon `Militar`); a matrícula dela é a chave
  para o SGP. Ou seja, não há um novo universo de militares — o SGP entra
  só pra enriquecer quem já aparece.
- **Sensibilidade / publicação (decisão-chave)**: a ficha viraria um JSON
  no repositório público + deploy Vercel público, sem login real (o auth
  atual é protótipo em localStorage). O `tb_pess` do SGP contém dado
  sensível de categoria especial (LGPD): CPF/RG/título/PIS/CNH/passaporte,
  endereço residencial, filiação, saúde (doença crônica, medicamento
  controlado, alergia, tipo sanguíneo), biometria (foto/assinatura/
  digitais), raça/cor, religião — além de dependentes (incl. menores).
  Publicar isso na internet aberta seria violação de LGPD e risco real a
  terceiros que não consentiram. **Decisão do usuário: Caminho A agora,
  Caminho B engatilhado.**
  - **Caminho A (feito, público)**: a ficha `/militar/:matricula`
    (`src/pages/MilitarFicha.jsx`) mostra só campos **não sensíveis** —
    posto/graduação, nome, nome de guerra, sexo, idade, OME, função, e os
    blocos de carreira administrativa que já temos em `efetivo_lista.json`
    (ingresso, última promoção, última movimentação, unidade anterior,
    órgão, tempo de serviço, tempo na unidade, horário especial,
    readaptado, acúmulo de cargos, LE, LTIP, afastamento > 90 dias,
    suplemento pessoal, PCNH). **Nunca** CPF/RG/endereço/filiação/saúde/
    biometria/raça/religião/telefone/dependentes. Não depende de nova
    sincronização: lê o que já está no `efetivo_lista.json`. O clique na
    linha da tabela de Efetivo passou de `/em-construcao/:matricula` para
    `/militar/:matricula`.
  - **Caminho B (engatilhado, não público)**: ficha completa (todos os
    blocos dos prints do SGP — Pessoais, Físicos, Documentos, Dependentes,
    Cursos, Históricos de promoção/movimentação/afastamento) só quando o
    app estiver atrás de **autenticação real no servidor interno**. O dado
    sensível nunca entra num arquivo versionado/público. O gatilho está
    documentado em `DW_GOVERNANCA.md` (allowlist público × denylist
    sensível), `DW_MODELO_DADOS.md` (mapeamento das tabelas do SGP pra
    cada bloco) e `DW_ETL.md` (o `windmill-sgp.py`, a escrever quando a
    conexão ao SGP for definida — ainda pendente, ver perguntas em aberto).

- **Ressalva de consistência (registrada, não resolvida agora)**: o painel
  "Verificar dados completos" da tabela de Efetivo já expõe hoje `racaCor`
  (raça/cor) e `pcd` (deficiência), ambos categoria especial LGPD, no
  `efetivo_lista.json` público — decisão anterior (2026-08-11, task de
  exposição de dados individuais). Isso contradiz a linha da ficha A.
  Recomendação: remover `racaCor`/`pcd`/telefones do `efetivo_lista.json`
  público também, num próximo passo — ver perguntas em aberto.

Verificado no navegador: `/militar/798007-8` renderiza "Cel ARARIPE" com só
"Dados Funcionais" e "Situação Administrativa", sem nenhum campo sensível, e
com o aviso de que o restante fica no acesso interno autenticado.

### 2026-08-19 — Painéis 05 e 06 do "Dashboard Pessoal" inseridos; 07/08 parciais e 09 bloqueados (handoff do colaborador de BI)

Um colaborador do projeto (Igor, apoiado por outra sessão do Code) está
reproduzindo os painéis do Metabase num protótipo HTML/JS estático
(`dashboards/01-efetivo-geral/`) antes da gente portar cada um pro app real
— mesmo fluxo que já produziu os 4 primeiros módulos (Efetivo Geral,
Distribuição Geográfica, Situações Funcionais, Militares Adidos, ver commit
`a7fbb44`). Ele entregou um pacote (`handoff-paineis-05-a-09.zip`) com o
handoff dos painéis 05-09, arquivado em
`dashboards/01-efetivo-geral/HANDOFF-paineis-05-a-09.md` +
`spec-05..08-*.json` + `carreira_extra.json` (dataset novo, 2.658 linhas
sem PII, usado pelos painéis 07/08) + `template.html` atualizado.

**Inseridos no app (prontos e validados 100% pelo protótipo, sem dado
novo — os campos `pcd`/`acumuloCargos` já existiam em `militares.json`
desde o painel 01):**
- **Painel 05 — Acúmulo de Cargos** (`src/pages/efetivo/ModuloAcumuloCargos.jsx`,
  chave `acumulo`): stat (24), donut por posto, barra por OME. Conferido
  contra `efetivo_lista.json` (fonte independente) e bate exatamente com o
  handoff em todos os números.
- **Painel 06 — Militares PCD's** (`ModuloMilitaresPcd.jsx`, chave `pcd`):
  stat (13), barra por OME (com TopN), donut por posto. Idem, bate exato.
- Ambos seguem a mesma lógica/design dos 4 primeiros: filtros padrão
  (Classe/Patente/OME/Sexo) via `useFiltrosEfetivo`, drill-down pra tabela
  real de Efetivo via `linkEfetivoTabela` (verificado clicando: filtro
  `postoGrad=Sd&pcd=Sim` → 7 linhas; `postoGrad=3ºSgt&acumuloCargos=<16
  valores>` → 8 linhas — ambos batendo com o donut). Registrados em
  `MODULOS_EFETIVO_DASHBOARD` (`src/lib/efetivoDashboard.js`) e no mapa
  `COMPONENTES` de `EfetivoDashboard.jsx`.
- Nota técnica: como `acumuloCargos` é texto livre (não booleano), o
  drill-down desse painel passa a lista de todos os textos distintos como
  filtro exato — funciona, mas gera uma URL longa. Aceitável pro volume
  atual (16 valores distintos); se crescer muito, vale reconsiderar.

**Bloqueados — dependem de resposta de Igor, não são um problema técnico
nosso:**
- **Painel 07 — Movimentação e Carreira**: 4 de 6 quadrantes prontos
  (Movimentações por ano, Promoções por ano — com ressalva de que
  `Militar.json` é snapshot vivo então anos recentes tendem a subir com o
  tempo —, Ingresso de militares, Tempo de serviço). Faltam 2:
  - **"Saída de militares"**: nenhuma fonte identificada (nem
    `Militar.json` nem `peculio_metabase_v1` têm histórico de saída/
    transferência por OME; o total do print, 1.218, é muito maior que os
    45 inativos que existem hoje). **Preciso: SQL ou nome da tabela usada
    no Metabase original para este card.**
  - **"Previsão de saída"**: `reservaRequerimento`/`reservaCompulsoria` não
    reproduzem os números do print isolados nem combinados. **Preciso: a
    regra de negócio exata (campo + cálculo + corte temporal) usada no
    Metabase.**
- **Painel 08 — Tempo na OME**: 3 de 4 quadrantes prontos (Distribuição
  geral, tempo médio Praças, tempo médio Oficiais — todos batendo exato
  com `tempoObmAtualDias`). Falta 1:
  - **Tabela nominal "Informações dos militares"** (Matrícula/Posto/Nome de
    Guerra/OME/Tempo na OME): bloqueada por decisão de produto, não por
    falta de dado — é PII. **Preciso decidir**: incluir matrícula/nome de
    guerra (aceitando exposição) ou manter só Posto/OME/Tempo sem
    identificação. Mesmo dilema já resolvido pra ficha do militar (ver
    entrada de 2026-08-19 "Ficha do militar" acima — Caminho A/B); a
    recomendação natural é aplicar o mesmo critério aqui: se a tabela for
    pro app público sem login, seguir Caminho A (sem matrícula/nome).
- **Painel 09 — Intenção de Movimentação**: não iniciado. Fonte é
  genuinamente nova — duas tabelas Postgres (`cim_pedidos`,
  `cim_atendidos`), sem sobreposição com `Militar`. **Preciso**: (1) export
  bruto (linhas, não agregado) das duas tabelas; (2) reenvio das 8 consultas
  SQL que Igor já passou uma vez (perdidas no resumo de contexto da outra
  sessão — só os tópicos sobreviveram); (3) a fonte/SQL do card "Solicitações
  por Posto e Graduação" (não tinha SQL correspondente entre as 8); (4)
  confirmar se o campo "categoria" dessas tabelas equivale ao filtro
  "Patente" usado nos outros painéis.

Achado geral registrado (vale pra qualquer painel futuro com este
protótipo): `tempoObmAtualDias` bate exato no painel 08 (população inteira)
mas diverge no subconjunto de Adidos do painel 04 — ainda sem explicação,
mesma pendência já registrada quando o painel 04 foi inserido.

### 2026-08-19 — Painéis 07, 08 e 09 concluídos: nova fonte Postgres do data warehouse, gap de filtro por ano corrigido, decisão de PII confirmada

Continuação da entrada anterior. O usuário conseguiu, do próprio Igor, as
duas consultas SQL que faltavam pro painel 07 ("Saída de militares" e
"Previsão de saída"), confirmou que a tabela nominal do painel 08 pode
mostrar matrícula/nome de guerra, e anexou o script de carga de
`cim_pedidos`/`cim_atendidos` (painel 09) — revelando, sem querer, uma
credencial de banco em texto puro no meio do script (ver alerta de
segurança abaixo).

**Fonte nova descoberta: Postgres do "data warehouse" compartilhado**
(`10.193.1.252:54301`, dbname `postgres`) — **diferente do Neon** usado
pelos outros extratores de Efetivo/Viaturas/Finanças. Contém tabelas
carregadas por scripts Python de terceiros (não nossos) a partir de
planilhas Google Sheets públicas ("publicar na web"), TRUNCATE+COPY:
- `inativos_metabase` (1.976 linhas) — militares inativados, grão = 1
  evento. Só agregamos por ano (`>= 2015`), nunca linha individual.
- `peculio_metabase_v1` (2.658 linhas) — mesma população do Neon `Militar`
  (confirmado pelo total idêntico), mantida à parte especificamente pras
  consultas do Metabase.
- `cim_pedidos` (203 linhas) / `cim_atendidos` (388 linhas) — solicitações
  e transferências atendidas da "Intenção de Movimentação", grão = 1
  solicitação/atendimento. Nunca extraímos matrícula/nome, só contagens.
- `escolaridade_militares` — carregada pelo mesmo script que popula
  `inativos_metabase`, mas **não usada em nenhum painel ainda** — fica
  registrada aqui como fonte disponível pra uma feature futura de
  escolaridade, se pedida.

Alcance de rede confirmado (reachable via TCP a partir desta máquina —
mesma classe de IP do Postgres da Frota, `10.193.1.252:54329`, sugerindo
mesmo host físico/rede interna, portas diferentes). Credencial guardada
como `DATABASE_URL_DW` em `.env.local` (gitignored), seguindo a mesma
convenção de `DATABASE_URL_EFETIVO`/`VIATURAS`/`FINANCAS`.

**⚠️ Alerta de segurança**: o script de carga de `cim_pedidos`/`cim_atendidos`
que o usuário colou no chat continha a connection string completa em texto
puro (host, porta, usuário `datawarehouse-user`, senha). Não commitei essa
credencial em nenhum arquivo — só como variável de ambiente local. Mesma
recomendação já registrada antes para a senha do banco da Frota:
**a senha deveria ser rotacionada**, já que passou em texto puro pelo chat.

**Painel 07 — Movimentação e Carreira, agora completo (6/6)**:
- **"Saída de militares"**: `inativos_metabase` agrupado por ano (SQL do
  Metabase, `ano >= 2015`) — total 1.218, bate exato com o handoff.
- **"Previsão de saída"**: reprodução literal do SQL do Metabase contra
  `peculio_metabase_v1` (LEAST entre projeção por tempo de serviço —
  25/30/35 anos conforme sexo/data de praça — e projeção por idade-limite —
  67 oficiais/65 praças) — total 1.161 em 9 anos (2027-2040), bate exato.
  Novo script `etl/efetivo/extract_saida_previsao.py`.
- Os 4 quadrantes já prontos (`ModuloMovimentacaoCarreira.jsx`) ganharam
  filtro (Patente/OME — sem Sexo, campo ausente em `carreira_extra.json`) e
  drill-down pra tabela real de Efetivo. "Saída"/"Previsão" não respondem
  ao filtro nem são clicáveis (população diferente — inativos/projeção, não
  efetivo ativo).
- Corrigido um gap real em `EfetivoDetalhe.jsx`: o filtro de intervalo por
  URL (`filtrosIniciaisDaUrl`) fazia `Number(bruto)` direto, o que sempre
  dava `NaN` para colunas de data (ISO "aaaa-mm-dd" não é um número) —
  intervalo min/max em `dataMovimentacaoSp`/`dataUltimaPromocao`/
  `dataIngresso` silenciosamente não filtrava nada. Nova função
  `numeroComparavel` extrai o ano de strings ISO antes de comparar.
  Verificado: clique em "Promoções 2021" → 273 linhas na tabela (bate).
- Novo tipo de gráfico `hbar` (barra horizontal) em `PanelGrafico.jsx`,
  pro card "Ingresso de militares" (~30 categorias de ano, mais legível
  como ranking horizontal que como barra vertical rotacionada).

**Painel 08 — Tempo na OME, agora completo (4/4)**:
- 3 quadrantes agregados (`ModuloTempoNaOme.jsx`, `carreira_extra.json`,
  campo `tempoOmeAnos`) — todos batendo exato: distribuição 1.076/162/157/
  131/214/126/792 (buckets "0-1/2/3/4/5/6/7+" — nota: o rótulo "N" na
  verdade representa `floor(tempoOmeAnos) == N-1`, replicando fielmente a
  classificação do protótipo, não um erro nosso), tempo médio Praças
  (Subten 6/1ºSgt 18/2ºSgt 13/3ºSgt 7/Cb 5/Sd 2) e Oficiais (Cel 3/Ten Cel
  1/Maj QOC 2/Maj QOA 5/Cap QOA 2/1ºTen QOC 2/1ºTen QOA 2/2ºTen QOC 1/2ºTen
  QOA 2).
- **Tabela nominal "Informações dos militares" liberada**: o usuário
  confirmou "pode mostrar matrícula e nome de guerra, o app tem login".
  Nota registrada no componente e aqui: o login atual
  (`src/lib/authClient.js`) é um protótipo em localStorage, não uma
  barreira de servidor real — mas isso não muda o risco líquido, porque a
  tabela de Efetivo já mostra nome completo + matrícula de todo o efetivo
  hoje, sem gate nenhum (exceção já registrada em 2026-08-07/2026-08-11
  acima). A tabela nova não cria uma categoria de exposição nova, só
  reduz pra Posto/OME/Tempo o que já está público em outro lugar do app.
  Fonte: `efetivo_lista.json` (não `carreira_extra.json`, que foi
  deliberadamente extraído sem PII) — mesma população.
- Achado de qualidade de dado registrado em Perguntas em aberto: alguns
  registros mostram "126,6 anos" de tempo na OME (claramente um valor de
  sentinela na fonte) — não afeta os 3 cards agregados, que usam outro
  campo.

**Painel 09 — Intenção de Movimentação, implementado do zero (9/9 cards)**:
- Novo script `etl/efetivo/extract_intencao_movimentacao.py`, contra
  `cim_pedidos`/`cim_atendidos` — só contagens agregadas (nunca matrícula/
  nome). Resolveu também a pergunta em aberto sobre o card sem SQL
  ("Solicitações por Posto e Graduação" = simplesmente `GROUP BY
  posto_grad` em `cim_pedidos` — óbvio uma vez visto o schema real) e a
  dúvida sobre "categoria" (= Oficiais/Praças, corresponde a "Classe", não
  a "Patente", confirmado pelo próprio script de carga).
- `ModuloIntencaoMovimentacao.jsx`: sem filtros (só extraímos contagens já
  agrupadas, não há linha a linha pra filtrar) e sem drill-down (siglas de
  OME aqui vêm sem espaço — "1ºGB" — divergindo do organograma — "1º GB" —
  e a população inclui militares na reserva, "RR", fora da tabela de
  efetivo ativo).
- 2 das 8 agregações ("Distribuição das solicitações" por `motivo`,
  "Origem das solicitações" por `ome`) são inferência nossa — o SQL
  original se perdeu num resumo de contexto antes de chegar até nós. Ver
  Perguntas em aberto.

Todos os 9 módulos do Dashboard Pessoal de Efetivo estão completos e no ar.
Verificado no navegador: todo número validado bate exato com as consultas
diretas ao Postgres (não só com o handoff), zero erros de console em
nenhum dos 3 novos painéis, e o drill-down testado end-to-end (filtro por
ano em coluna de data, e filtro de bucket de dias).

### 2026-08-19 — Navegação, filtro e bug sistêmico de OME corrigidos no Dashboard de Efetivo (commit `89b949f`)

Quatro pedidos do usuário sobre o Dashboard Pessoal de Efetivo, todos
implementados e verificados no navegador na mesma sessão:

- **Botão "Retornar" do navegador**: as abas de módulo
  (`EfetivoDashboard.jsx`) trocavam de módulo empilhando uma entrada nova no
  histórico — apertar "Retornar" ia pro módulo anterior, não pro
  `/indicador`. Trocado `<Link>` por `<Link replace>` nas abas; a primeira
  navegação (Indicador → Dashboard) continua sendo `push` normal.
- **Filtro "Anos na OME atual" removido** de `ModuloDistribuicaoGeografica.jsx`
  e `ModuloTempoNaOme.jsx` (pedido do usuário, sem substituto).
- **Bug sistêmico de sigla de OME no drill-down**: `militares.json`/
  `carreira_extra.json` usam sigla curta ("CG", "1ºGB", "DInter/1"), mas a
  tabela real de Efetivo (`efetivo_lista.json`) usa outra convenção
  ("COMANDO GERAL", "1º GB", "DINTER I") — o caso relatado (Comandante/
  Subcomandante Geral sumindo ao clicar em Recife) era só o sintoma mais
  visível de um problema que valia pra quase toda OME. Corrigido uma vez só
  em `linkEfetivoTabela` (`efetivoDashboard.js`), via novo de-para
  `OME_SIGLA_REAL`/`omeSiglaReal` — conserta todo drill-down por OME do
  dashboard de uma vez, não só o caso relatado.
- **Responsividade do Topbar em telas de notebook (~1280-1440px)**: causa
  raiz era a interação entre o zoom global `1.25` (`index.css`), os
  breakpoints do Tailwind avaliando contra a largura física (não a
  ajustada pelo zoom), e um `grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]`
  com a coluna de busca em largura fixa — o bloco de ações (Tema/PDF/Sair)
  ficava espremido e vazava por cima da busca. Reescrito pra 3 zonas
  flexbox (`flex-1 min-w-0`), busca com largura responsiva
  (`max-w-xs`/`2xl:max-w-sm`), e Tema/PDF/Sair compactos (só ícone) até
  breakpoints mais largos. Verificado sem sobreposição em 1024–1920px e
  mobile/tablet, em ~12 páginas diferentes do app.
**Motivo**: os 4 itens vieram de um único pedido direto do usuário.

### 2026-08-19 — Dashboard Pessoal de Viaturas: 5 módulos, drill-down para tabela real (commit `5b1a9ea`)

Réplica do padrão do Dashboard de Efetivo pro domínio de Viaturas, a
pedido do usuário ("monte todos, mantendo a coerência visual... como é
feito em efetivo"). Proposta de estrutura (5 painéis) apresentada e
aprovada antes de implementar.

- **5 módulos** (`src/pages/viaturas/`, rota
  `/viaturas/:id/dashboard/:modulo`): Frota Geral, Distribuição
  Geográfica, Idade e Renovação, Tipos e Capacidade Operacional,
  Manutenção/Rastreamento/Uso. Fonte: `viaturas_detalhe.json` (805
  viaturas com placa, campos ricos por veículo — tipo, combustível,
  posse, rastreamento, condutores, categoria de habilitação, último
  abastecimento), não `viaturas_lista.json` (só ano/modelo/nome/
  patrimônio/situação, usado pela tabela real).
- **Duas regras de negócio replicadas do resto do app**, pro dashboard
  nunca mostrar um total que a tabela de baixo não bate: GTA (unidade
  fora do organograma, já excluída do KPI real — ver decisão de
  2026-08-07) fica fora de qualquer contagem por OME; situação
  "Descarregada" é excluída e "Devolvida" aparece como "Ativa" (mesma
  transformação de `ViaturaDetalhe.jsx`).
- **Mesmo bug de sigla de OME já corrigido no Efetivo, agora em
  Viaturas**: `viaturas_detalhe.json` usa sigla curta (majoritariamente
  igual à do Efetivo — "1ºGB", "DInter/1" — mas com 4 variantes próprias
  pros CATs: "CAT AGRESTE"/"CAT MATA"/"CAT RMR"/"CAT SERTÃO"), a tabela
  real usa outra ("1º GB", "CAT/AG"...). Novo de-para
  `OME_SIGLA_REAL_VIATURAS`/`omeSiglaRealViatura` em
  `viaturasDashboard.js`, mesmo princípio do Efetivo.
- **Refactor pra evitar duplicar o mecanismo entre os dois dashboards**:
  helpers genéricos de agregação (`groupCount`/`paraSerie`/`pctTexto`/
  `passaMultiSelect`) e o de-para OME→cidade (`CIDADE_POR_OME`/
  `omesDaCidade`) saíram de `efetivoDashboard.js` para
  `src/lib/dashboardHelpers.js`/`src/lib/omeGeografia.js`;
  `efetivoDashboard.js` re-exporta os dois pra não quebrar nenhum import
  existente. O mecanismo de filtro-por-URL do drill-down
  (`filtrosIniciaisDaUrl`/`numeroComparavel`), que só existia em
  `EfetivoDetalhe.jsx`, foi extraído para `filtro-coluna.jsx` e agora
  também alimenta `ViaturaDetalhe.jsx` (que não tinha esse mecanismo
  antes — a tabela de Viaturas era só filtro manual, sem suportar
  chegada por clique de um dashboard).
- **`ViaturaDetalhe.jsx` ganhou 7 colunas** (Tipo, Destinação, Posse,
  Combustível, Rastreado?, Categoria de Habilitação, Condutores),
  enriquecidas por placa a partir de `viaturas_detalhe.json` — cobertura
  parcial (só as ~805 viaturas com placa cadastrada; as demais mostram
  "—" nessas colunas, mesmo padrão de junção parcial já usado em
  `EfetivoDetalhe.jsx`/`lotacaoFuncao.json`).
- **Achado de qualidade de dado corrigido em runtime**: o KPI "sem
  abastecer há 90+ dias" deu 100% da frota na primeira versão, porque o
  registro de abastecimento mais recente em toda a fonte é de janeiro/2026
  — a sincronização Frota→Neon não é ao vivo. Trocada a referência de
  "agora" de `Date.now()` para o abastecimento mais recente **da própria
  frota**, com a data de referência exibida no card — o indicador volta a
  discriminar (75,5%, não 100%).
- **Achado de qualidade de dado registrado, não corrigido**: 13 viaturas
  em `viaturas_detalhe.json` têm `ano: 23` (erro de digitação/truncamento,
  não 1923 nem 2023) — excluídas dos gráficos de idade (`anoValido`), mas
  a fonte não foi corrigida. Ver Perguntas em aberto.
**Motivo**: pedido explícito do usuário, com proposta de estrutura
apresentada e aprovada antes da implementação (`DW_PROCESSO_INTEGRACAO.md`
não se aplica aqui — não é fonte de dado nova, é dashboard sobre fonte já
integrada).

### 2026-08-19 (nova sessão, outra máquina) — Escopo por unidade nos Dashboards Pessoais + reconciliação de contagem de Viaturas

**Decisão**: dois bugs reportados pelo usuário, investigados e corrigidos
na mesma sessão.

**1. Dashboards Pessoais não filtravam por unidade.** Acessando como
nível "4GB" e abrindo os Dashboards Pessoais de Efetivo/Viaturas, os
números mostrados eram os da corporação inteira, não só do 4º GB — e o
mesmo valia pra qualquer unidade, não só nível restrito (um admin abrindo
o dashboard do 4º GB também via a corporação inteira). Causa:
`EfetivoDashboard.jsx`/`ViaturasDashboard.jsx` passavam o dataset bruto
(`militares.json`, `LINHAS_VIATURAS` etc.) pros módulos sem restringir à
unidade sendo visualizada. A guarda de rota (`useAcessoUsuario`/
`permiteIndicador`, ver `DW_GOVERNANCA.md`) só decide **se a página
abre**, não filtra o que aparece dentro dela — diferente das tabelas reais
(`EfetivoDetalhe.jsx`/`ViaturaDetalhe.jsx`), que já restringiam por
unidade+subordinadas desde a criação.
- Corrigido com `siglasPermitidas()` (novo, `src/lib/dashboardHelpers.js`)
  + `filtrarPorEscopo`/`filtrarPorEscopoViaturas`, aplicados em
  `EfetivoDashboard.jsx`/`ViaturasDashboard.jsx` antes de repassar dado
  pros módulos.
- **Dois casos especiais descobertos no processo**: "ADIDO" (militares
  cedidos) e "CPPA" (unidade sem nó no organograma, soma dentro de DGP —
  decisão já registrada em 2026-08-07) não são siglas reais do
  organograma, então precisaram virar pseudo-siglas em
  `siglasPermitidas()` (adiciona "ADIDO" quando "COMANDO GERAL" está no
  escopo, e "CPPA" quando "DGP" está) — sem isso, o Comando Geral ficava
  sem os adidos e o DGP sem a CPPA no dashboard.
- **Dois quadrantes/painéis não têm como ser restringidos por unidade**,
  porque a fonte é agregada só no nível da corporação (sem OME por
  registro): "Saída de militares"/"Previsão de saída" (painel
  Movimentação e Carreira) e o painel inteiro de Intenção de
  Movimentação. Ficam ocultos (com aviso na tela) fora da visão total
  (Comando Geral).
- Filtro de OME dentro dos módulos passou a listar só as OMEs da unidade
  em escopo, em vez da lista fixa da corporação inteira.

**2. Dashboard de Viaturas mostrava 736 (Comando Geral), card/tabela real
mostravam 771.** Investigação (comparação completa placa a placa entre
`viaturas_lista.json` e `viaturas_detalhe.json`): `viaturas_detalhe.json`
(fonte do dashboard, 805 veículos) só existe "por placa" — 35 veículos
sem placa cadastrada na fonte (majoritariamente embarcações/motos
aquáticas, ex. "SEADOO GTI 170 S", "DB-300", que não têm placa de
veículo) ficam estruturalmente de fora dele. Fora esses 35, os dois
datasets têm exatamente o mesmo conjunto de 736 veículos — **não é bug de
sincronização, é limitação estrutural de uma fonte "por placa"**.
Corrigido incluindo os 35 como registros sintéticos em `LINHAS_VIATURAS`
(`viaturasDashboard.js`): campos "de ficha" (ano/modelo/nome/patrimônio/
situação) vêm de `viaturas_lista.json`; campos que só existem na fonte
rica (posse/combustível/rastreamento/condutores etc.) ficam `null` — os
módulos que dependem deles já tratam `null` como "não informado". Total
do Dashboard de Viaturas (Comando Geral) agora bate exato com o card/
tabela real: **771**.

**Motivo**: os dois eram bugs de exposição/integridade de dado — o
primeiro é o mesmo tipo de brecha já fechada em 2026-08-17 (guarda de
rota), agora reaberta pelos dashboards novos; o segundo era uma
divergência real entre o que o card promete e o que o dashboard mostra.
Ver `DW_GOVERNANCA.md` (atualização de 2026-08-19) pro detalhe de
controle de acesso.

### 2026-08-24 — Retomada do DW: mapa das fontes internas, regras de efetivo e primeira lista de dimensões

Sessão longa, de retomada do planejamento do DW propriamente dito, depois de
várias rodadas focadas em app/apresentação. Também corrigiu um bug de dado no
app (CPPA, commit `824b425`).

**Correção da CPPA (commit `824b425`)**. Militares com `ome = CPPA` no Neon
tinham a OME sobrescrita por `DGP` na extração — o de-para
`mapeamento_unidades.json` mapeia `CPPA → DGP`, e o `extract_efetivo.py`
descartava a origem. Resultado: o setor vinculado CPPA aparecia vazio, porque
o filtro procurava CPPA como divisão na Repercussão Financeira, onde ela não
existe. Generalizado o mecanismo que já existia para adidos (`omeExibicao`):
`OME_SETOR_VINCULADO = {"CPPA": "DGP"}`, novo bloco `por_setor_vinculado` em
`efetivo.json`, e o filtro de setor casa primeiro por OME de origem. DGP segue
com 39 (sem duplicidade), CPPA mostra 11/17, e o drill-down `?ome=CPPA` do
dashboard — que também estava quebrado — passou a funcionar. Variações de
grafia (`1ºGB` → `1º GB`) deliberadamente **não** entram nessa regra.

**Repositório passou a privado.** Foi verificado que
`raw.githubusercontent.com/.../efetivo_lista.json` respondia HTTP 200 sem
autenticação, com 2,7 MB contendo nome completo, matrícula, telefones,
raça/cor e PCD de 2.658 militares. A `DW_GOVERNANCA.md` já registrava o risco,
mas raciocinando sobre o site na Vercel (que ao menos tem login) — o GitHub
não tinha. O histórico do git guarda as versões anteriores, então tornar
privado não desfaz o que já foi exposto. Com o repo privado, os DDLs e scripts
do Windmill puderam ser versionados (commit `f7b4a43`), sanitizados.

**Cinco credenciais para rotacionar**, todas expostas em texto puro (chat ou
arquivo): `datawarehouse-user` no Postgres interno (superusuário), os dois
`neondb_owner` (efetivo e finanças), a do banco da Frota, e a do SGP/`ctic`.
Some-se a isso que a planilha do Pecúlio é lida por **URL de "publicar na web"
do Google Sheets** (`etl/efetivo/windmill-peculio-neon.py`), que não pede
autenticação — duas URLs, com o efetivo nominal inteiro.

**Levantamento das fontes internas.** Detalhe completo em
`DW_CATALOGO_FONTES.md`. O essencial:

- Praticamente todo o dado do DW está em **dois servidores**, com duas
  credenciais: `10.193.0.16` (todos os sistemas OVR como schemas do
  `db_portal_sistemas_prod`) e `10.193.0.20` (aplicações Rails).
- `dw_dim` e o schema `dw_cbmpe` são tentativas antigas de DW, **em desuso**.
  O `public` do `10.193.1.252` alimenta o Metabase e **não deve ser tocado**.
- `ovrsgo` e `ovrroe` estão **fora de uso** (confirmado pelo usuário).
- O **mapa de força é o `mapa_forca_api_development`** — produção, apesar do
  nome; o `map_force_production` ao lado está vazio.
- **O mapa de força e o `ovresc` são um sistema só, partido em dois bancos**:
  as FKs do mapa de força apontam para o `ovresc` sem constraint declarada,
  com 100% de casamento em quatro dimensões. O `ovresc` não pode ser
  descartado — é o cadastro-mestre.

**O mapa de força muda a prioridade do roadmap.** Traz 342.018 lançamentos e
1.026.255 militares lançados, cobrindo **2019-11 até hoje**. Isso contradiz
uma afirmação minha anterior: eu havia dito que o DW só teria série temporal a
partir do dia em que ligássemos a carga — falso para o domínio operacional,
onde já existem quase seis anos prontos, com trilha de auditoria por cima
(`action_logs`, 1,2 milhão de linhas com motivo textual). Passa a ser a
segunda carga, não a última.

**Chaves testadas** (medições em `DW_CATALOGO_FONTES.md`): OME entre mapa de
força e SGP é **FK real** (31/31); matrícula casa **94,1%** normalizando para
"sem hífen, com dígito verificador"; viatura **não** casa entre Frota e mapa
de força pelos catálogos, mas casa **98,6%** pelo número de ordem ignorando
zeros à esquerda e o sufixo `L`.

**Decisão — Frota × mapa de força: cruzar, não somar.** São grãos diferentes
(o que a corporação possui × o que foi empregado); somar produz número sem
significado. Caminho em duas etapas: `stg.de_para_viatura` agora, correção na
origem depois, com a tabela de reconciliação servindo de carga inicial. Ver
`DW_MODELO_DADOS.md`.

**Regras de efetivo confirmadas pelo usuário**, e uma proposta minha
descartada:

- Efetivo é **todo militar da ativa**. Afastado (LE, LTIP, licença médica,
  férias) continua contando na sua OME. **Descartada** a minha proposta de
  separar "efetivo administrativo" × "efetivo disponível" — não é assim que a
  corporação enxerga.
- Inativo é de outra diretoria, fora de escopo por ora.
- **Adido conta quatro vezes, sem duplicidade**: para o órgão externo, para
  uma OME fantasma `ADIDOS`, para o rollup do Comando Geral e para o total.
  A OME fantasma entra na `dim_ome`. Adido **pode** ser escalado.
- Órgão do adido vem do `Militar.orgao` do Pecúlio; rever quando o SGP virar
  a fonte.
- **Agregado segue em aberto.**

**A regra de inatividade do SGP não é aplicável hoje.** A regra correta é
"sem registro em `tb_inatv` = ativo", mas a `tb_inatv` tem **26 registros** e
classificaria 4.571 dos 4.597 como ativos. A marcação de fato usada é a
movimentação para a pseudo-OME `INATIVOS` (1.430 pessoas), e os dois
mecanismos quase não se cruzam. Evidência: dos 73 militares escalados nos
últimos 12 meses fora do efetivo ativo do Pecúlio, 67 estão "orgânicos e
ativos" no SGP, a maioria lotada em `INATIVOS`, vários com 100+ lançamentos —
são inativos tirando serviço extra. Só 4 eram adidos, contra a minha hipótese.
**Consequência**: o Pecúlio segue como fonte do efetivo ativo, e quando o SGP
for regularizado a inativação precisa passar a ser lançada em `tb_inatv`.

**Coordenadas das OMEs**: nenhuma OME tem coordenada real no SGP (as 75
não-nulas estão como `0,0`). `etl/sgp/casar_coordenadas_ome.py` fecha o
casamento com **63 de 82 recebendo coordenada e zero divergências**
(commit `fb08c95`). Regras e ressalvas em `DW_CATALOGO_FONTES.md`. **Nada foi
gravado no SGP** — a gravação exige `--aplicar`, e o usuário condicionou a
"só quando tudo for dirimido".

**Ajuste na decisão de 2026-08-07 sobre `core` normalizado**: as dimensões
conformadas passam a ser **tabelas materializadas no `core`**, não views em
`marts`. Motivo: a dimensão carrega a reconciliação (de-para de cinco
sistemas, chave substituta, SCD2) — dado novo, produzido por nós, que não
existe em nenhuma origem e não cabe numa view. Primeira lista de 13 dimensões
propostas em `DW_MODELO_DADOS.md`, cada uma com fonte identificada e chave
testada.

**Dado sensível novo**: o mapa de força trouxe **CPF**
(`launch_militaries.military_cpf`, `action_logs.user_cpf`), que não existia
em nenhuma fonte nossa. A matrícula já serve de chave — o CPF deve ser
descartado na transição `raw` → `stg`.

**Motivo geral**: o foco até aqui tinha sido demonstrar potencial para os
gestores, com integrações pontuais. Esta sessão retomou o DW em si, e o
levantamento mostrou que o terreno é bem melhor do que parecia — duas
credenciais alcançam quase tudo, o mapa de força já tem seis anos de
histórico, e a ligação com o SGP é FK de verdade em vez de casamento por
nome.

### 2026-08-24 (segunda metade da sessão) — O DW existe: banco criado e carregado, organograma como autoridade, Windmill separado, perfis de acesso

A sessão passou de planejar o DW para **construí-lo**. Commits `bc3a984`,
`ff18a6a`, `7f49353`, `dbf0c12`, `1bdd1bc`, `6b8b7f1`.

**O banco `dw` está de pé e carregado**, no Postgres interno
(`10.193.1.252:54301`), com 1,9 milhão de linhas em `raw_*` e 1.379.067 no
`core`. Quatro passos idempotentes em `etl/dw/`: `criar_banco.py`,
`aplicar_ddl.py`, `carga_raw.py`, `carga_core.py`, mais `validar.py`. O DDL
da camada `raw` é derivado do **catálogo da própria fonte**
(`pg_attribute` + `format_type`), então os tipos batem sem mapeamento manual
— e tabela nova na origem não exige DDL escrito à mão.

**Organograma é a verdade** (decisão do usuário, textual). Ao carregar, a
hierarquia do SGP divergiu do organograma em 27 unidades — a DGP fechava 77
por rollup no SGP contra 39 no organograma, porque o SGP pendura DAS e CEFD
nela. O DW foi reconstruído sobre o organograma. A divergência não foi
apagada: `core.dim_ome` ganhou `origem_hierarquia` (`organograma` 45, `sgp`
26, `regra` 11) e `no_organograma` (46), para que ninguém confunda as duas
leituras. Detalhe em `DW_MODELO_DADOS.md`.

**Dívida técnica assumida conscientemente**: o organograma mora na constante
`ARVORE` de `src/data/organograma.js` — um arquivo de front-end é hoje a
autoridade da hierarquia da corporação. O `carga_core.py` faz o parse direto
e **falha alto** se render menos de 5 nós, para que uma refatoração no app
não degrade o DW em silêncio.

**Estado das unidades, resolvido com o usuário:**

- **DGA**: ainda não existe. Fica `planejada`, `conta_efetivo = false`, sem
  filhos — e as 9 diretorias que penderiam dela pendem **direto do
  Subcomando Geral**, que passa a ter 17 filhos diretos. Ativar a DGA é
  mudar um status, e a hierarquia do organograma volta a valer sozinha.
- **AJ**: existe hoje, sob o **GCG**. **GBFN**: virou **SBFN**, seção sob o
  **GBI**.
- **CAC, CPA, CPTO, CTA, CEMET II, DFEA**: extintas. Marcadas no DW; a
  correção na origem fica a critério do usuário.
- **GTA**: não é OME — entra como adido, órgão externo `GTA`. Com isso não
  sobrou nenhuma viatura sem OME.

**SCD tipo 2 explicado, e onde ele de fato se aplica.** O usuário pediu para
eu explicar melhor. SCD2 é guardar uma linha por período de validade, com o
fato apontando para a versão que valia na data do evento. Para o GBFN **não**
se aplica: o usuário quer o histórico lido sob a estrutura atual, que é o que
uma dimensão sem versionamento já faz. SCD2 na `dim_ome` só serviria ao
oposto — ver 2021 com a estrutura de 2021 — e fica registrado como opção.
Onde **é** necessário é na `dim_viatura`: números de ordem são reciclados
(413 pares ambíguos), então sem versão por período não há como saber a qual
veículo um lançamento antigo se refere.

**O DW deixou de ler o Neon.** Os bancos Neon são cache de aplicação
(`TRUNCATE` a cada rodada, recorte de colunas, regra de negócio já
aplicada). O DW passou a ler as origens: `frotas_production` para Viaturas e
as planilhas do Google Sheets para Efetivo e Finanças. Efeito medido:
`dim_militar` caiu de 2.703 para **2.658** (resíduo de `ativo=false` que o
Neon guardava) e `dim_viatura` subiu de 805 para **813** (o recorte do Neon
descartava viatura sem placa). As tabelas Neon continuam sendo alimentadas —
o app publicado depende delas.

**Scripts do Windmill separados em duas pastas**, a pedido do usuário, com
verificação um a um:

- `etl/windmill/apps/` — o que mantém funcionando o que já funciona
  (Metabase, app na Vercel): `peculio_para_metabase_e_neon.py`,
  `financas_planilha_para_postgres.py`, `financas_postgres_para_neon.py`,
  `frota_para_neon.py`. Sanitizados, credenciais por `os.environ`.
- `etl/windmill/dw/` — ETL do DW: `raw_planilhas.py`, que lê as planilhas
  originais e grava **toda coluna como texto, sem descartar linha**.

A duplicidade de URLs entre as duas pastas é proposital: mexer no ETL do DW
não pode quebrar o Metabase. Racional completo em `etl/windmill/README.md`.
`diagnostico_frotas.py` saiu do ETL (é ferramenta de investigação, não
carga).

**Perfis de acesso — 8 perfis, `/adm` e o Assessor.** Detalhe em
`DW_GOVERNANCA.md`. O que importa registrar aqui:

- Comandante Geral e Subcomandante Geral ficaram **separados** (mesmo
  acesso, perfis distintos).
- Perfis temáticos (DGP/DLog/DF) veem o seu indicador em **qualquer**
  unidade, além da própria unidade — é o que os distingue de um titular.
- **Assessor**: sempre vinculado a um titular, válido só enquanto aquele
  titular permanecer titular **da OME em que concedeu o acesso**. A OME
  concedida fica gravada na atribuição do assessor — é comparando-a com a
  OME atual do titular que a transferência é detectada. Sem isso, o assessor
  passaria a enxergar a unidade nova do titular, que não foi o que ele
  autorizou. O acesso caduca sozinho, e a tela `/adm` mostra o motivo em vez
  de simplesmente apagar o vínculo.
- **A unidade deixou de ser escolha do administrador**: vem da OME do
  usuário, resolvida pelo CPF (as credenciais internas do CBMPE são CPF +
  senha). `resolverOmePorCpf()` é o seam — hoje devolve `null` e a tela
  marca a unidade como provisória; quando o backend existir, só essa função
  muda.
- Botão de Administração saiu da topbar e ficou no menu lateral, abaixo do
  Organograma, visível só para o administrador.

**Consequência sobre o CPF, que reverte parcialmente uma decisão minha.** Eu
havia decidido descartar CPF na entrada do DW. Isso **continua valendo** para
a cópia do mapa de força (`launch_militaries.military_cpf`,
`action_logs.user_cpf`), onde a matrícula já serve de chave. Mas o CPF do SGP
(`tb_pess.nr_cpf_pess`) passou a ter uso concreto: é a chave de autenticação
e de resolução usuário → OME. **Recomendação registrada**: essa consulta deve
acontecer no servidor, a cada login, sem materializar CPF no DW nem em
nenhum JSON servido ao navegador. CPF de 4.597 militares num arquivo estático
seria ordem de grandeza pior que os telefones já expostos.

**Deploys na Vercel bloqueados** (constatado ao fim da sessão). Desde que o
repositório passou a privado, a Vercel recusa os deploys: *"the commit author
did not have contributing access"*. Não é erro de build — é a regra do plano
Hobby, que não suporta colaboração em repositório privado e exige que o autor
do commit seja o dono da conta. Os commits estavam autorados como
`aggd.cbmpe@gmail.com`, que a Vercel não reconhece; a outra máquina já usava
o e-mail `noreply` do GitHub. **Resolução**: padronizar o autor no e-mail
`noreply` do GitHub, que é a identidade canônica da conta dona do repositório
e vale nas duas máquinas. Tornar o repositório público de novo **não** é
alternativa aceitável — o histórico guarda credenciais e efetivo nominal.

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

### 2026-08-24 — Antiguidade e o sistema de reserva remunerada entram no DW

**Antiguidade na `dim_militar`.** A planilha do Pecúlio já vem ordenada por
precedência — blocos por posto, do Cel ao Sd, e dentro de cada bloco o `Nº`
reinicia em 1. O índice da planilha **é** a antiguidade; não há o que
calcular. Duas colunas: `antiguidade` (o `Nº` dentro do posto, o número que o
militar cita) e `antiguidade_geral` (posição na planilha inteira, que ordena a
corporação de ponta a ponta). Validação cruzada: `antiguidade_geral` bate
**100% com a `ordemHierarquica` do Neon** nas 2.658 matrículas. A antiguidade
por posto é informação nova. Três `Nº` repetidos na origem (3ºSgt, Cb,
Subten) são reportados sem derrubar a carga.

**Inventário dos Neons.** São 7 tabelas, 2 vazias. `Militar` (2.703) e
`Viatura` (841) já estavam cobertos pelas fontes originais. Restaram três
lacunas: Finanças, `Averbacao` (582) e `Afastamento` (8).

**Finanças fica em aberto** — decisão do usuário: o domínio ainda não é bem
compreendido. O dado já está no `raw_financas`; falta modelar o `core`.

**O sistema de controle de reserva remunerada é a exceção à regra do Neon.**
Investigando por que 590 linhas existiam só no Neon, ficou claro que nenhum
script do repositório as escreve — e que a escrita mais recente era de
17/08/2026, uma semana antes. O usuário confirmou: existe um sistema de
controle de reserva remunerada rodando nesse Neon. Para esse domínio, então,
**o Neon não é cache: é o sistema de origem**, e a decisão de 2026-08-24 de
tirar o Neon do caminho do DW ganha uma exceção explícita.

Carregado: `raw_reserva` (3.293 linhas), `core.fato_averbacao` (560),
`core.fato_afastamento_reserva` (8), `core.fato_previsao_reserva` (2.658
militares, snapshot) e `marts.tempo_reserva_por_militar`. Racional de
modelagem em `DW_MODELO_DADOS.md`.

Três coisas que valem registro:

- **A ponte é por id local, não por matrícula.** `Averbacao.militarId` aponta
  para o `Militar.id` do Neon. Por isso a tabela `Militar` entra na `raw`
  junto — sem ela não há como saber de quem é cada averbação.
- **22 averbações ficaram de fora**, por pertencerem a militares que não estão
  no efetivo ativo. A carga conta e imprime em vez de descartar em silêncio.
- **`raw_peculio.militar` foi removida** — era cópia do Neon `Militar` de
  antes da virada para a planilha, e teria virado armadilha ao lado da
  `raw_reserva.militar`.

**Credencial do Neon exposta de novo em texto puro** (no chat, ao indicar o
sistema de reserva). É a mesma `neondb_owner` que já constava da lista de
rotação — a lista não mudou, mas o argumento para rotacionar ficou mais forte.

### 2026-08-24 — `dim_militar` alargada; um defeito silencioso e dois achados na coluna OBS

**A `dim_militar` cobria 10 dos 38 campos** que a aplicação usa. Alargada com
três critérios: data entra e duração não (número calculado envelhece, data
não — a idade declarada na planilha já divergia do cálculo em 126 dos 2.658);
campo redundante não vira coluna (ano de ingresso é o ano da data de praça em
2.657 de 2.658); e contato sai da dimensão, para `core.contato_militar`.

Três dimensões novas: `dim_principio_promocao` (5), `dim_suplemento_pessoal`
(103) e `dim_tipo_afastamento` (14). Nova view `marts.militar`, que recalcula
idade, tempo de serviço e tempo na OME a cada consulta. Detalhe em
`DW_MODELO_DADOS.md`.

**Defeito encontrado e corrigido: `data_nascimento` e `data_ingresso` estavam
100% nulas.** O cast só aceitava `AAAA-MM-DD` e a planilha escreve
`DD/MM/AAAA`; o `CASE` devolvia `NULL` em silêncio nas 2.658 linhas. Nada
reclamou porque a contagem de linhas fechava e o efetivo batia. O `validar.py`
passou a exigir preenchimento das datas que nunca deveriam faltar — é o tipo
de erro que contagem de linha nunca pega.

**A coluna OBS da planilha responde duas perguntas abertas.** Ninguém a tinha
lido. Ela marca `Titular` em **45 militares** (o Pecúlio já sabe quem comanda
cada OME — insumo direto para o perfil Titular do `/adm`) e `Ag` em **18**
(agregado, em aberto desde 2026-08-21). Carregados como texto e contados pelo
`validar.py`; **não viraram regra** — dependem de confirmação do usuário.

**Qualidade de dado registrada, não corrigida**: a coluna de afastamento da
planilha recebe texto livre, e 10 dos 14 "tipos" são sigla de OME ou nome de
função digitados no lugar errado. Entram como estão, com relatório.

### 2026-08-24 — A documentação da Seção responde autenticação e deploy

O usuário compartilhou quatro páginas do wiki interno (BookStack em
`docs.captain.cbmpe.intranet`). Cópias versionadas em `docs/intranet/`, para
que o conhecimento não dependa de acesso à rede. **Nenhum valor de segredo
nos arquivos** — o wiki adota a regra de só mapear onde os segredos estão, e
nós adotamos a mesma.

**Deploy: o caminho existe e já está quase pronto do nosso lado.** A Seção usa
CapRover em `caprover-01` — o mesmo servidor onde o DW está. O `Dockerfile` e
o `nginx.conf` do repositório já servem; faltava o `captain-definition`, que
foi criado. O que não está em arquivo nenhum e é o calcanhar de aquiles
documentado: o **Port Mapping manual no painel** (para nós, destino porta 80)
e o vhost no proxy reverso `srv-nginx01`. Detalhe em `DW_ARQUITETURA.md`.

**Autenticação: o SGU é a resposta, e a cobertura é melhor que o esperado.**
API Rails que autentica contra o AD, com login por CPF. Medido nesta sessão,
sem imprimir nenhum CPF: o SGU tem 3.455 usuários, 3.279 já logaram, e
**2.615 dos 2.658 militares do efetivo ativo (98,4%) já têm conta**. O
`validate_token` devolve inclusive posto/OBM.

**Decisão sobre `resolverOmePorCpf()`**: preferir CPF → `ovrsgp.tb_pess` →
matrícula → `core.dim_militar` em vez de ler a chave `military` do SGU. Cobre
99,9%, e faz a OME sair da nossa `dim_ome` — já com a hierarquia do
organograma e CPPA/ADIDOS resolvidos. Também mantém o CPF fora do DW: usado na
consulta, descartado em seguida.

**O SGU não faz autorização** — confirma que o modelo de perfis de
`accessControl.js` continua sendo responsabilidade nossa. O wiki cita um mau
exemplo a não copiar: o `portalcbmpe` criou middlewares de verificação de
token e deixou os dois vazios, de modo que a API parece protegida e não valida
nada.

**Um achado que muda o que o BI pode expor.** Usuário novo no AD nasce com
**senha igual ao próprio CPF, que nunca expira**, e o `GET /users` do SGU
esteve público na internet com o CPF de 2.500+ pessoas. Combinados, qualquer
um teve a lista de logins e a senha padrão de quem nunca trocou. Não é nosso
para consertar, mas é nosso para respeitar: enquanto isso não for resolvido, o
BI não deve expor lista nominal a perfil autenticado só pelo SGU. Registrado
em `DW_GOVERNANCA.md`.

**Correção ao mapa de conexões**: o `10.193.0.20` estava registrado só como
servidor de aplicações Rails. Ele roda também o `sgu_api_production`,
alcançável com a credencial `ctic` que já temos.

**Regra adotada**: log do SGU contém CPF nos parâmetros de login e, por
instrução do wiki, não entra em contexto de IA. Vale para as sessões deste
projeto.

### Pendências do DW carregado (2026-08-24, revisto em 2026-08-26)

Em ordem de urgência:

1. ~~**Chaves substitutas estáveis**~~ — **resolvido de outro jeito em
   2026-08-26.** A `dim_viatura` ganhou chave determinística
   (`id_frota * 100 + versão`), mas a `dim_militar` continua com
   `row_number()`. O que destravou o agendamento foi o `limpar()` parar de
   recusar a carga: agora ele **guarda os snapshots diários pela chave
   natural** (matrícula, placa) e os devolve depois de reconstruir as
   dimensões. A série temporal deixou de ser destruída a cada rodada — já são
   2 dias acumulados. Chave estável na `dim_militar` continua desejável (é
   mais barato que traduzir por matrícula toda carga), mas não bloqueia mais.
2. ~~**`dim_viatura` como SCD tipo 2**~~ — **feito em 2026-08-26.** Cobertura
   de viatura de 80,4% para **99,0%**; ambíguos de 413 para 57 pares. Ver o
   log de decisões abaixo.
3. **Rotacionar as cinco credenciais expostas** e criar papéis separados
   (`etl_writer`, `bi_reader`, `app_reader`) — hoje tudo roda com
   superusuário.
4. **`casar_coordenadas_ome.py --aplicar`** — 63 de 82 OMEs prontas, zero
   divergências, nada gravado. Bloqueado pelo usuário ("só quando tudo for
   dirimido").

## Perguntas em aberto

### Sobre os perfis de acesso (2026-08-24)

- **Quem valida a senha?** Se as credenciais são as internas do CBMPE, o mais
  provável é LDAP/AD ou o mesmo mecanismo do portal de sistemas. A definir
  antes de escrever o backend de autenticação.
- **Assessor de perfil temático**: hoje o assessor só se vincula a um
  Titular. Um diretor da DGP pode ter assessor? Se sim, ele herdaria
  "Efetivo de todas as unidades" — bem mais amplo que assessorar uma unidade.
- **Titular sem unidade** ainda pode ser salvo em `/adm`, e fica sem acesso a
  nada. Quando o CPF resolver a OME isso deixa de acontecer; até lá, bloquear
  o salvamento ou deixar?
- **Um militar pode ser assessor de mais de um titular?** O modelo hoje
  aceita um vínculo só por usuário.

### Sobre os dados (abertas desde 2026-08-24)

- **Agregado**: regra ainda não definida pelo usuário.
- **Vacinação**: 4.138 militares na base contra 2.658 ativos — a chave é
  matrícula? O excedente é inativo, dependente, ou outra coisa?
- **Datas impossíveis no `ovresc`** (ano 22, 4202, 62025): a camada `raw`
  engole como texto; o `stg` precisa de uma regra de descarte ou correção.
- ~~**Onde as ocorrências vivem hoje**, agora que `ovrsgo` e `ovrroe` estão
  fora de uso.~~ **Respondido em 2026-09-21**: `public.roe_basico_ocorrencias`
  + tabelas de detalhe por natureza, no mesmo schema `public` do
  `10.193.1.252:54301` que hospeda `peculio_metabase_v1`/`cim_*`/`fin_*`.
  Veio do painel de Ocorrências do Igor; **nenhuma coluna verificada** — o
  host não é alcançável da máquina atual. Ver `DW_CATALOGO_FONTES.md`.

- **Painéis 07/09 — 2 agregações inferidas, a confirmar com Igor**: "Distribuição
  das solicitações" (painel 09, hoje agrupada por `motivo`) e "Origem das
  solicitações" (hoje agrupada por `ome`) foram implementadas por inferência
  nossa — o SQL original desses 2 cards se perdeu num resumo de contexto de
  outra sessão antes de chegar até nós (ver entrada de decisão 2026-08-19
  abaixo). Pedir a Igor pra confirmar ou corrigir.
- **Anomalia de dado**: alguns militares aparecem com "126,6 anos" de tempo
  na OME atual na tabela nominal do painel 08 (`efetivo_lista.json`,
  `completo.tempoObmAtualDias`) — claramente um valor de sentinela/erro na
  fonte, não um tempo real. Os 3 cards agregados do painel 08 usam outro
  campo (`carreira_extra.json`, `tempoOmeAnos`) que não tem esse problema e
  bate exato com o print — só a tabela nominal nova é afetada. Vale
  investigar a origem do valor (provavelmente uma data nula/sentinela no
  Neon) antes de confiar nesse campo em outro contexto.
- **Anomalia de dado (Viaturas)**: 13 viaturas em `viaturas_detalhe.json`
  têm `ano: 23` (não 1923, não 2023 — parece truncamento de dígito na
  fonte/sync Frota→Neon). O Dashboard de Viaturas trata qualquer ano < 1980
  como desconhecido (`anoValido` em `viaturasDashboard.js`) e exclui essas
  13 viaturas dos gráficos de idade — não afeta os demais módulos. Vale
  confirmar o ano real dessas 13 (placa disponível em `viaturas_detalhe.json`)
  direto na fonte, antes de decidir corrigir na origem ou só documentar.
- **Sincronização Frota→Neon não é ao vivo**: o registro de
  `ultimoAbastecimentoData` mais recente em toda a frota (`viaturas_detalhe.json`)
  é de 19/01/2026, meses atrás da data corrente — qualquer métrica futura
  que compare esse campo contra "hoje" (`Date.now()`) vai super-marcar a
  frota inteira como "parada". O módulo "Manutenção, Rastreamento e Uso" já
  usa a data mais recente da própria fonte como referência em vez de
  `Date.now()` (ver decisão de 2026-08-19 acima) — replicar esse cuidado em
  qualquer novo indicador que use datas de sincronização como "recência".
- **Conexão ao SGP (`ovrsgp`)**: host, credenciais e alcance de rede a
  partir do Windmill — necessários pra escrever/rodar o `windmill-sgp.py`
  que engatilha o Caminho B da ficha do militar (histórico de promoção/
  movimentação/afastamento, cursos, dependentes, dados pessoais/físicos).
  Sem isso, o Caminho B fica só documentado.
- **Vazamento de dado sensível já público**: `efetivo_lista.json` (público)
  hoje inclui `racaCor` e `pcd` (categoria especial LGPD) e telefones,
  usados no painel "Verificar dados completos". Contradiz a linha da ficha
  A — remover num próximo passo (confirmar com o usuário).
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
- **Página de detalhamento por viatura — pendências restantes** (as 4
  dúvidas originais já foram respondidas pelo usuário e implementadas,
  ver entrada de 2026-08-18 "Respostas do usuário às dúvidas de DDL"):
  (1) usuário publica/roda a versão estendida de `windmill-viaturas.py`
  no Windmill — depois disso, rodar `extract_viaturas.py` de novo já
  basta pra ficha de cada viatura aparecer com dado real; (2) Condutores
  continua com ressalva explícita — o número calculado (contagem de
  `condutor` distintos no `raw_data` de `fuel_transactions`) ainda não
  foi comparado/confirmado contra um caso real conhecido; (3) Saldo do
  Cartão fica de fora até o usuário enviar os detalhes de uma API
  externa da operadora do cartão de combustível; (4) as demais abas do
  print de referência (Abastecimentos, Documentos, Manutenções,
  Observações, Histórico) ficam fora de escopo por decisão do usuário —
  só "Detalhes" (Resumo + Outros) foi implementado.

### 2026-08-26 — Solicitação formal de deploy ao setor de TI

Consolidado em `docs/deploy-solicitacao-ti.md`, documento único para
encaminhamento externo: o que está pronto (DW em produção com 15 dimensões, 8
fatos e 10 views de `marts`; `Dockerfile`, `nginx.conf` e `captain-definition`
no repositório; build compilando), o que depende do TI (app no CapRover com
Port Mapping para a **porta 80**, vhost no `srv-nginx01`, envs a partir do
cofre, rotação de cinco credenciais e criação de `etl_writer`/`bi_reader`/
`app_reader`) e o que ainda é nosso (camada de servidor, chaves estáveis,
repontar extratores, login pelo SGU).

Dois achados novos que motivaram o documento:

1. **O app exige a raiz de um host.** Sem `base` no Vite e sem `basename` no
   `BrowserRouter`, publicar sob subcaminho quebra a aplicação — e subcaminho é
   justamente o padrão da Intranet. Virou a primeira pergunta ao TI, porque
   define se o deploy é imediato ou exige recompilar. Detalhado em
   `DW_ARQUITETURA.md`.
2. **A contagem de views de `marts` era 10, não 11**, como registros anteriores
   sugeriam. Conferido no DDL.

Registrado também, como ressalva que precisa constar para quem operar o
sistema: a imagem Docker **nunca foi construída** — não há Docker na máquina de
desenvolvimento, então só o `npm run build` está verificado.

### 2026-08-26 (segunda sessão) — Mapa de Força entra no roadmap; `dim_viatura` vira SCD2

**O pedido.** Painel de Mapa de Força dentro de "Atividades Específicas" da
DGO, funcionando como qualquer outro painel (o mesmo para as subordinadas,
com o filtro da OME aplicado): mapa de Pernambuco com balões por OME,
detalhando as viaturas ativadas, com clique levando a `/viatura/{placa}` e à
guarnição, e de lá a `/militar/{matricula}`. Filtros: OME (com subfiltro de
seção), matrícula com autocomplete, tipo de viatura (com subfiltro de número
de ordem) e data.

**Três decisões do usuário, tomadas antes de escrever código:**

| Tema | Decisão |
|---|---|
| Entrega do dado | Janela curta em arquivos buscados em runtime (`public/`), não `import` no bundle. A URL de fetch vira chamada de API quando o servidor existir. |
| Chave do militar | **Matrícula continua na URL**; CPF entra só como coluna de junção no `core`, atrás do servidor. Confirma a decisão de 2026-08-19 (Caminho A/B) contra o pedido inicial de trocar tudo por CPF. |
| Ordem do trabalho | SCD2 da `dim_viatura` **antes** do painel. |

**Por que o CPF não virou chave.** O pedido original era usar CPF como chave
de militar em todo o sistema. Levantei três coisas contra: (a)
`carga_raw.py:43` exclui deliberadamente `military_cpf` da cópia do mapa de
força para o DW, e `core.dim_militar` não tem coluna de CPF; (b) o bundle é
entregue antes do login, então CPF na chave publicaria 2.658 CPFs; (c)
`/militar/07012345678` vaza em histórico de navegador, log de proxy e
`Referer` — e a regra que a própria Seção adotou para os logs do SGU é não
deixar CPF circular. Como chave de junção interna o CPF é ótimo, e é o que o
mapa de força usa na origem. O usuário aceitou a recomendação.

**Correção importante ao pedido: o `ovrsmf` não serve.** O pedido dizia que o
snapshot diário "já existe no ovrsmf, basta consumir". O `ovrsmf` é o mapa de
força **antigo** (ScriptCase), congelado em 2018-02 → 2020-10. O vivo é o
`mapa_forca_api_development`. E não é preciso guardar snapshot nenhum:
`launches.date` é data de verdade, então qualquer dia passado é consultável
direto. O DW já tem 2021-05-07 → hoje.

**O que o levantamento mediu (DW consultado ao vivo em 2026-08-26):**

- 902.164 lançamentos de militar, 204.443 de viatura, 259.998 de recurso — e
  **o app não usa nenhum deles**. Dos 10 marts, o app consome 2.
- Só **17 OMEs** lançam mapa de força, e todas caem na subárvore da DGO
  (DIM, DINTER I/II → GBs, GBAPH, GBS, GBMar, CATs). A colocação do painel na
  DGO está certa por construção; numa unidade administrativa ele fica
  legitimamente vazio.
- Volume diário: ~170 lançamentos de viatura, ~85 viaturas distintas, ~830
  militares, 13 a 15 OMEs.
- **43 dos 91 postos de serviço com lançamento no último ano não têm
  coordenada.** É exatamente a tabela que o usuário está construindo — encaixa
  em `core.dim_posto_servico`, que já tem as colunas. Até lá, o balão cai na
  coordenada da OME.
- `launches.active` é `true` em 100% das 342.024 linhas — não serve como
  filtro de "ativada". O sinal real de cancelamento é `discarded_at` (4.656).

**A projeção do mapa de Pernambuco, recuperada.** O `municipios_pe.json` que
já estava no app é o geojson enviado, projetado — mas só os paths, sem
lat/long e sem a projeção escrita em lugar nenhum. Sem ela, nenhum balão tem
onde pousar. Recuperada por comparação e conferida **path por path nos 184
municípios**: equirretangular simples, sem correção de cosseno, na bbox do
continente, largura 1000. Fica em `etl/_geo/projetar_municipios.py`
(verificação reexecutável) e `src/lib/projecaoPe.js` (uso no app). Não
precisamos de Leaflet nem de tiles — o que importa, porque na intranet não
haveria servidor de tiles.

**Fernando de Noronha está no geojson e não no mapa.** A ilha fica a ~350 km
da costa e, dentro da mesma bbox, espremeria o continente. O GBI lança
guarnição no SBFN todo dia, então o painel vai precisar de um encarte.

#### `dim_viatura` como SCD tipo 2 — o pré-requisito

O número de ordem é reciclado: viatura devolvida, a que entra no lugar herda
o número. Com uma linha por viatura não há como saber qual estava em serviço
no dia do lançamento — e 1 em cada 8 balões do mapa ficaria sem link para a
ficha. Medido antes: 1.756 de 14.487 lançamentos dos últimos 90 dias sem
casar (12,1%), pior que os 1,4% da medição original de 2026-08-24, porque a
`dim_viatura` só tinha a frota atual.

Grão novo: **uma linha por versão** — 813 viaturas em 2.827 versões. Versão
nova a cada mudança de OME (`transfers`) ou de situação
(`vehicle_statuses`), montada da linha do tempo dos dois.

Duas regras que só apareceram medindo, e que valem mais que o desenho:

1. **Só uma viatura por número herda o passado.** A primeira versão precisa
   valer para trás (`valido_de = 1900-01-01`), porque o histórico da Frota
   começa em 2023-12-06 e o mapa de força em 2021-05-07. Mas abrir *todas* as
   primeiras versões — que foi o que fiz na primeira tentativa — devolve a
   ambiguidade inteira: as duas donas do mesmo número ficam vigentes no mesmo
   dia. Ambíguos: 413 → 231 pares.
2. **Vigência sozinha não basta.** Uma viatura `Devolvida` mantém a última
   versão aberta e concorre com a sucessora. Daí a coluna `em_servico` (o
   `still_usable` do próprio catálogo da Frota) e a resolução em dois
   estágios: candidata em serviço manda; na falta de qualquer uma, vale a fora
   de serviço. Ambíguos: 231 → 57 pares.

| Regra | Lançamentos resolvidos (de 204.443) |
|---|---|
| só vigência | 91,9% |
| vigência + em serviço | 97,5% (mas 367 perdiam a única candidata) |
| os dois, com queda para a fora de serviço | 97,7% |
| **no fato, somando o desempate por acrônimo** | **99,0%** |

Os 2.014 restantes são o piso real: número que nunca existiu na Frota.

`sk_viatura` passa a ser determinístico (`id_frota * 100 + versão`), o que
tira a `dim_viatura` da pendência de chaves substitutas instáveis.

#### Efeito colateral bom: a série temporal parou de ser destruída

O `limpar()` recusava a carga inteira quando encontrava snapshot de dia
anterior, porque o `TRUNCATE ... CASCADE` levaria os snapshots junto e as
chaves substitutas mudariam. Era honesto e travava o agendamento da carga
diária — que é justamente o que o DW existe para comprar.

Agora ele **guarda os três snapshots pela chave natural** (matrícula, placa) e
os devolve depois de reconstruir as dimensões, antes do primeiro commit (as
temporárias são `ON COMMIT DROP`, e um erro no meio faz rollback com tudo
intacto). Uma linha cuja chave natural sumiu da dimensão é descartada e
contada. Resultado: 2 dias acumulados em vez de 1 destruído.

Consequências tratadas na mesma leva:

- `marts.frota_por_ome` e `fato_frota_diaria` filtram `versao_atual` — senão
  contam a mesma viatura uma vez por versão (177 viaturas têm mais de uma).
- `marts.emprego_viatura_resumo` agrupa por `id_frota` — senão parte o
  histórico de cada viatura em pedaços.
- `validar.py` recorta por dia as contas que supunham um snapshot só. Sem
  isso, "total da corporação" passaria a dar 5.316.
- `stg.normalizar_numero_ordem()` vira função no banco: a mesma regra é
  aplicada em três lugares e já divergiu uma vez.
- `validar.py` ganha as quatro invariantes do SCD2 — versão atual única,
  vigência não invertida, versões sem sobreposição, um só dono do passado por
  número. Todas em zero.

**Achado de qualidade para a DTIC.** Três `reference_date` da Frota têm ano
com 5 ou 6 dígitos: `62025-02-05`, `22025-06-09`, `252024-01-01`. É a mesma
classe de erro já conhecida no `ovresc` (ano 22, 4202). Descartados em vez de
adivinhados — chutar o ano de um evento de status não é trabalho de ETL — e
contados na saída da carga.

#### O painel entregue

Rota `/atividades/:id/dashboard/mapa-forca`, ligada a partir do card de
Atividades Específicas. O KPI do indicador **continua "Em construção"** — o
número é mock, porque a fonte real (SGAT) não foi levantada. Só o módulo é
real.

Mecanismo novo no app: `public/dados/mapa-forca/{data}.json`, um arquivo por
dia (~131 KB), buscado em runtime por `src/lib/mapaForca.js`. Verificado que
o bundle não cresceu — `UNIDADE TÁTICA DE INCÊNDIO` aparece 0 vezes em
`dist/assets/index-*.js` e 1 vez no arquivo do dia.

Duas honestidades que ficaram na tela em vez de escondidas:

- 97 dos 185 postos não têm coordenada própria e herdam a da OME. Esses
  balões saem **tracejados**, e o tooltip diz "posição aproximada". É a
  tabela que você está montando que fecha esse buraco — ela encaixa em
  `core.dim_posto_servico`, que já tem as colunas `latitude`/`longitude`.
- Viatura que o mapa de força lançou e a Frota não conhece (1,0%) aparece
  como acrônimo-número, sem link, em vez de sumir do painel.

O extrator corrige 5 postos de Fernando de Noronha que estavam com
coordenada continental. Não é chute: é o valor que a própria fonte já dá em
outros três postos do mesmo município. A regra é por município, e vale
porque Noronha é o único município de PE que não encosta no continente — uma
coordenada continental ali é provadamente errada.

**Ressalva registrada:** são 12 MB de dado nominal (nome de guerra,
matrícula, função, posto de serviço, por dia) no repositório, servidos sem
autenticação enquanto o app estiver na Vercel — `public/` não passa por
login. Foi a opção escolhida com essa consequência explícita. Nome completo
não entra, e CPF nunca entrou no DW.

**Ainda em aberto neste painel:**

- O subfiltro de seção usa os postos de serviço do DW
  (`1ºSBI / GBI (SEDE)`), não as seções do organograma
  (`↳ 1ª SBI/GBI (Jaboatão dos Guararapes)`). São a mesma coisa com nomes
  diferentes, e o de-para entre os dois ainda não existe.
- Três OMEs extintas (`8º GB`, `10º GB`, `12º GB`) lançaram em 2021 e não
  têm destino confirmado no organograma. Estão como `null` em
  `etl/mapa_forca/mapeamento_unidades.json`, e o extrator **falha** se
  alguma aparecer na janela pedida — não aparecem na de 90 dias.

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

### 2026-08-26 (terceira sessão) — Fernando de Noronha no mapa; QOD publicado substitui a Repercussão Financeira

**1. Fernando de Noronha entra nos mapas.** A ilha estava no geojson de
origem mas fora do `municipios_pe.json`: a 350 km da costa, dentro da mesma
bbox ela espremeria o continente. O resultado era um buraco — município de
PE ausente do coroplético, e o SBFN (onde o GBI lança guarnição todo dia)
sem lugar no Mapa de Força, resolvido até então por uma caixa de canto fora
do SVG.

Decisão do usuário: entrar como em qualquer atlas — **deslocada e
ampliada**, como se fosse uma ilha próxima da costa nordeste, no canto
superior direito. Implementado assim:

- geometria real (o mesmo polígono de 31 vértices do geojson), transformada
  por `NORONHA_DESTINO_X/Y` + `NORONHA_AMPLIACAO = 3,5×` (na escala do
  continente a ilha teria 12,9 × 7,8 unidades — menor que o balão que se
  quer pousar em cima dela);
- o viewBox passa a começar em `minY = -50`, abrindo uma faixa de oceano
  acima do continente. **Os 184 paths continentais não mudam um decimal** —
  o `projetar_municipios.py` confere path por path e imprime o resultado;
- `projetarNoMapa()` (novo, em `src/lib/projecaoPe.js`) aplica a
  transformação sozinho para qualquer lat/long do arquipélago; `projetar()`
  continua sendo a projeção continental pura, que é a que a verificação
  reproduz;
- como o mapa passa a mentir sobre distância e escala, o rótulo é
  obrigatório: `MolduraNoronha` (moldura tracejada + "Fernando de Noronha —
  3.5×, fora de posição") entra nos DOIS mapas, e o tooltip do Mapa de
  Força repete o aviso.

**2. QOD publicado substitui a Repercussão Financeira como fonte de
lotação/função.** O usuário enviou um novo link publicado (DPlaG) com duas
abas ligadas por chave estrangeira de verdade — `QOD_CONSOLIDADA.CÓDIGO` →
`QOD_FUNCOES.ID_FUNCAO`.

| | antes (`DIST_FUNCOES`) | agora (QOD publicado) |
|---|---|---|
| militares com função | 716 (26,9%) | **2.356 (88,6%)** |
| unidades | 14 | **43** |
| par militar→função | texto livre, 3 camadas de heurística | **FK exata, 100% resolve** |
| granularidade | divisão (quando casava) | **seção exata** + divisão quando casa |
| campos novos | — | seção, localidade, cursos, FUNÇÃO/ENCARGO |
| coleta | arquivo local enviado à mão | **URL publicada, baixada pelo extrator** |

Três decisões que valem registro porque não são óbvias:

- **O arquivo foi normalizado.** `por_matricula` guarda só o que varia por
  pessoa e aponta para um catálogo `funcoes` pelo `idFuncao`. Repetir nome,
  seção, divisão e OME nas 2.600 ocupações custava ~600 KB num arquivo que
  é `import`ado — ou seja, que entra no bundle baixado antes do login. O
  bundle subiu 5.175 → 5.418 kB (+242 kB) em vez de +1,5 MB.
- **O rollup de seção→divisão por ordem de exibição foi medido e
  rejeitado.** Subia a atribuição de 65% para 91%, mas triplicava as
  divisões acima do previsto (4 → 28) e as pessoas na divisão errada
  (12 → 115). Detalhe e o caso do 1º GB em `DW_MODELO_DADOS.md`. Fechar os
  843 restantes exige de-para ou o QOD original numerado — mesma pendência
  do subfiltro de seção do Mapa de Força.
- **Encargo não conta duas vezes.** 87 militares acumulam função e encargo;
  a contagem por divisão/seção usa só FUNÇÃO, mais o encargo de quem não
  tem função lançada (10 casos), para que ninguém suma.

**Achados para a DPlaG** (fatos da fonte, não erro de extração):
- 31 linhas de ocupação **sem `CÓDIGO`** (13 na CAT/Zona da Mata) — sem
  código não há como saber a função;
- 110 militares com **unidade divergente do Pecúlio**, concentrados num
  bloco de matrículas 725xxx;
- `GBAPH / Secretaria e Apoio do Comando - SAC` com **16 militares lançados
  para 8 vagas previstas** (a maior das 4 divisões acima do previsto).

⚠️ **Governança**: o link publicado serve nome completo, matrícula, função e
cursos de 2.356 militares **sem autenticação**, como já acontecia com as
duas planilhas do efetivo nominal. Continua registrado como risco aberto.

### 2026-08-26 (quarta sessão) — KMZ das SBs, mapa com zoom, insígnias, filtro e cargos repetidos

**1. Coordenadas reais das SBs (dois KMZ).** `etl/mapa_forca/coordenadas_postos.py`
lê os dois arquivos enviados e monta o de-para por cidade. A DINTER 2 tem
prioridade sobre o geral por decisão do usuário, e a razão está nos dados: o
geral ainda descreve a organização antiga (8º, 10º, 11º e 12º GB existem lá),
enquanto a DINTER 2 já reflete a reorganização — Araripina e Ouricuri são 3ª e
4ª SB do 5º GB no novo e 10º GB no antigo. Macaparana entra à mão
(-7,55406 / -35,44778) e o script avisa se um dia ela aparecer num KMZ.

O casamento posto→ponto **não** usa o campo `municipio`: ele guarda o município
da OME, não o do posto — os 20 postos municipais da CAT/ZM estão todos gravados
como CARPINA. Quem carrega a cidade de verdade é o NOME do posto. Para cidade
sem ponto levantado, entra o centroide do município (`origemCoord: "municipio"`,
balão tracejado).

Resultado: **81 → 102 postos com ponto real**, 18 no centroide, 64 ainda na
coordenada da OME (quase todos `OPERAÇÃO *`, que são eventos sem endereço fixo).

**2. Mapa: zoom, hover de município e anti-sobreposição.**
- `useZoomMapa` faz zoom/pan por **viewBox**, não por `transform` — assim o
  contorno do município não engorda ao ampliar. Em troca todo tamanho fixo é
  dividido por `escala`.
- `antiSobreposicao.js` faz duas coisas: agrupa o que está perto demais para
  caber lado a lado (a RMR tem ~70 postos numa área minúscula) e afasta o que
  ainda encavala, ligando cada balão ao ponto real por uma **linha-guia** com
  âncora. As duas distâncias encolhem com o zoom, então aproximar abre os
  grupos sozinho; clicar num grupo enquadra nele.
- Hover no município mostra o nome.

**3. Insígnias.** `etl/_geo/copiar_insignias.py` copia só os PNG usados,
reduzidos para 256px — **9,7 MB → 2,3 MB**. A pasta enviada fica fora do
commit (`.gitignore`). No cabeçalho da página da unidade entra a insígnia
dela; no mapa, só grupamentos, e o QCG leva o brasão do CBMPE. Unidade sem
insígnia própria (Comando, Subcomando, GCG, GSG, CPO, CPP, DGA e **DVP**, que
não está no repositório) cai no brasão.

**4. Balão de filtro abrindo longe do gatilho — causa medida.** O Radix
(Floating UI) posiciona por `transform: translate(x, y)` com pixels reais,
dentro do `<html>` que tem `zoom: 1.25`: o navegador multiplica de novo e o
erro vira 25% da distância até a origem. Medido: gatilho em (575, 420), balão
em (719, 530) — 144px e 111px de desvio. `MultiSelectFiltro` deixou de usar o
Popover do Radix e passou a usar `usePosicaoAncorada`, o mesmo posicionamento
manual que `FiltroColuna` já tinha. Depois: **0px em x, 5px em y**.

**5. Cargos contados mais de uma vez.** Duas coisas diferentes, medidas:
- **No catálogo**: 219 triplas (OME, SEÇÃO, FUNÇÃO) repetidas, 224 linhas a
  mais, sendo 108 de chefia/comando. Agora são colapsadas na de menor
  `ORDEM_EXIBICAO` (`deduplicar()`), então a mesma vaga não conta duas vezes.
- **Na ocupação**: sobram **43 cargos de chefia administrativa com 2 ou 3
  ocupantes** — chefe é um por seção, então é erro de lançamento na planilha,
  não do casamento. Listados na saída do extrator. "Comandante de Grupo" de
  GCI/GS/GAPH fica de fora do alerta de propósito: aquilo é função de turno, e
  ter 17 é o esperado.

**Em aberto — precisa do usuário:** o `previsto = 3` da Chefia do GCG vem de
`efetivo_previsto_divisoes.json`, gerado do QOD original
(`08 - QOD - AGOSTO - 2026.xlsx`), que **não está no repositório**. Naquele
documento o nó soma Comandante Geral + Chefe do Gabinete + Ajudante de ordens.
Mudar isso mexe num total já validado (5.247 contra 5.249) e não dá para fazer
sem o arquivo.

### 2026-08-26 (quinta sessão) — malha do IBGE, navegação do mapa e varredura de coordenadas

**1. A malha de municípios passou a ser a oficial do IBGE.** O
`municipios_pe.geojson.json` que vinha sendo usado desde os painéis de
Distribuição Geográfica era uma versão simplificada: 15.635 vértices, tudo em
`Polygon` de anel único. `etl/_geo/baixar_malha_ibge.py` baixa a malha
municipal de PE em `qualidade=maxima` (37.451 vértices, com `MultiPolygon`
onde é preciso) e junta o nome de cada município pelo código IBGE — os 185
códigos batem exatamente com os do arquivo antigo.

Por que trocar, além do detalhe: o litoral genérico fazia postos de praia
(Forte Orange, GBMar/Sede, GBS/Sede) caírem FORA do polígono do próprio
município, o que inviabiliza qualquer conferência geográfica de coordenada — e
é exatamente essa conferência que resolveu os erros do item 4.

A malha nova também **corrige divisas**: doze municípios mudaram de forma, com
destaque para Ibimirim (o limite oeste andou 32 km), Petrolândia e Tupanatinga,
em torno do lago de Itaparica, e Trindade/Araripina (emancipação). O script de
projeção lista os doze e só aborta se algum andar mais de 40 unidades, o que
seria erro de projeção e não diferença de malha.

`projetar_municipios.py` ganhou suporte a `MultiPolygon` e simplificação
Douglas-Peucker em espaço projetado (tolerância 0,055 unidade ≈ 40 m, menos de
um pixel no zoom máximo). O `municipios_pe.json` foi de 239 KB para 460 KB — é
o preço do detalhe, num JSON que o app importa.

**Fernando de Noronha:** a malha do IBGE traz os cinco corpos de terra do
arquipélago. O mapa desenha só a ilha principal, que é onde estão o aeródromo,
a vila e os três postos do GBI; as quatro ilhotas triplicariam a altura da
moldura para render quatro pontinhos. Ampliação 3,5× → **3,6×**, destino
inalterado.

**2. Navegação do mapa.** Três correções, todas medidas:

- **Arrastar.** A versão anterior media o deslocamento do mouse na escala do
  viewBox ATUAL, que ela mesma acabara de alterar no quadro anterior — dois
  referenciais misturados, e o mapa "escapava" do cursor. Agora o gesto congela
  o quadro inicial e cada movimento parte dele. Verificado no navegador: um
  arrasto de (+100, +50) px produziu `dx = -28,4667` contra `-28,4667`
  esperado e `dy = -7,5931` contra `-7,5931` — o ponto sob o cursor fica sob o
  cursor, como no Google Maps. `setPointerCapture` segura o gesto fora do SVG.
- **Roda só com Ctrl** (pedido do usuário): o mapa ocupa boa parte da página e
  prendia quem só queria descer até as viaturas e o efetivo escalado. Sem
  Ctrl, o evento passa e a página rola.
- **Zoom em lote.** Achado ao verificar o item acima: numa rolagem rápida o
  navegador entrega vários `wheel` no mesmo quadro, e a versão que lia o
  viewBox de fora aplicava só o primeiro. Medido: **nove eventos davam 1,18×
  em vez de 4,44×**. Corrigido passando a conta para dentro do `setVb`, a
  partir do estado anterior.

**3. Leitura do mapa.**
- Hover de município: além do nome, o município é **redesenhado por cima** dos
  vizinhos com realce avermelhado e 4% de escala (SVG não tem `z-index`, então
  destacar no lugar deixaria a borda do vizinho passando por cima).
- Brasões maiores (2,1× o raio do círculo) e **sem o anel vermelho** em volta —
  com insígnia o círculo vira só alvo de clique.
- **Brasões lado a lado no zoom.** A partir de 3,2× o agrupamento é desligado e
  cada posto vira um balão. Duas correções para isso funcionar: pontos
  exatamente coincidentes (37 postos na coordenada do QCG) passam a nascer
  abertos num anel, e o anti-sobreposição separa pelo raio do BRASÃO, não pelo
  do círculo. Medido a 4,44× na RMR: **35 pares de brasões sobrepostos → 1**.
- Saíram o título "Onde a força está", o subtítulo e a legenda de três linhas;
  entrou "Ctrl + rolar para aproximar · arrastar para mover" no rodapé.
- "Seções com serviço" virou "Unidades com lançamentos" (o número continua
  sendo o de postos com lançamento no dia — é o que o mapa desenha).
- Cards de lançamento em grade (até 3 colunas), menores, e "Viaturas" no
  singular: o lançamento do mapa de força tem uma viatura só.
- Filtro de data virou **calendário** (`FiltroData`, react-day-picker + o
  posicionamento manual de `usePosicaoAncorada`), com os dias sem lançamento
  desabilitados. Procurar "12/07" numa lista de noventa linhas era pior do que
  apontar no mês. Verificado: balão a 0px em x e 5px em y do gatilho.

**4. Varredura completa das coordenadas dos postos.** Os dois erros que o
usuário apontou tinham causas diferentes, e a busca por outros iguais virou
`etl/mapa_forca/conferir_coordenadas.py` — que resolve a coordenada no
extrator E roda sozinho como conferência contra o índice já gerado.

O que a varredura achou nos 185 postos:

| posto | o que estava gravado | diagnóstico |
|---|---|---|
| 147-150 `3º/4º/5º/9º GB` | sem coordenada, OME = DINTER II | os quatro caíam em **Petrolina** |
| 67 `4ªSB / BONITO` | -8,686 / -35,591 | é **Palmares**, 14,8 km fora de Bonito |
| 32 `CEASA / Recife` | -22,881 / -43,636 | **Rio de Janeiro** |
| 151 `7ªSB / CARUARU` | +8,295 / +35,990 | **sinal invertido** nos dois eixos |
| 49 `POSTO 01 - FORTE ORANGE` | -7,811 / +34,841 | sinal invertido na longitude |
| 94/96/98/107/108 | sem coordenada | CATs do interior caindo na sede |

Regras de resolução, nesta ordem: coordenada própria conferida (com correção
de sinal quando espelhar traz o ponto de volta para PE) → o NOME do posto é a
sigla de uma unidade que tem coordenada → cidade citada no NOME → campo
`municipio` (nunca para posto de evento, cujo `municipio` está todo gravado
como RECIFE) → coordenada da OME. Toda coordenada é conferida contra o
polígono do município que o posto declara, com 2 km de tolerância — a menor
divergência real encontrada tem 14,8 km.

Resultado: **0 postos suspeitos** na varredura, contra 30 antes. Distribuição
final: 103 com ponto próprio ou levantado, 32 no centroide do município, 7 na
coordenada da unidade que o posto nomeia, 43 na coordenada da OME (quase todos
`OPERAÇÃO *`, eventos sem endereço fixo).

**As três pendências foram respondidas pelo usuário em 2026-08-26** e estão
registradas no código, não só aqui:

- **`CAT/SERTÃO` fica em Petrolina.** Virou `SEDE_CONFIRMADA` em
  `conferir_coordenadas.py`, para não parecer que o resultado saiu por acidente
  da regra de fallback. A `dim_ome` continua dizendo Serra Talhada — divergência
  da fonte, não nossa.
- **O 11º GB foi extinto e Petrolândia é a 4ª SB do 3º GB** (posto 20, que já
  aponta certo, com 333 lançamentos). O posto 156 (`SEDE` do 11º GB) entrou em
  `MUNICIPIO_NAO_CONFIAVEL`: o cadastro grava RECIFE, que nunca foi a sede.
  Sem município confiável e sem coordenada de OME, ele fica **fora do mapa** —
  que é o correto para unidade extinta.
- **Toritama é a 6ª SB do 2º GB.** Confirmado nos lançamentos: `6ªSB / TORITAMA`
  (2º GB) tem 180 na janela e `8º GB/3ª SB - TORITAMA` tem **zero** — o segundo
  é o registro obsoleto da nomenclatura antiga. Nada a corrigir; fica anotado
  para quem estranhar os dois no cadastro.

Continua valendo o `previsto = 3` da Chefia do GCG da sessão anterior.

### 2026-08-26 (sexta sessão) — brasão garantido na sede, login por CPF, documentação de deploy

**1. O brasão da unidade aparece na sede em qualquer zoom.** Pedido do usuário:
"garanta que em toda sede (1ª SB) de unidade, mesmo que haja mais unidades
aglomeradas, o brasão da unidade apareça no mapa, mesmo no zoom mais distante".

O problema era o agrupamento: um balão que junta postos de OMEs diferentes não
tem brasão para mostrar — vira círculo com número —, e na RMR a sede do GBI ou
do GBS era absorvida pela vizinhança. A solução tem três partes:

- `conferir_coordenadas.e_sede()` marca o posto como sede pelo NOME
  (`SEDE` como palavra, ou `1ª SB` em qualquer grafia), excluindo
  `POSTO ...` e posto de evento. O extrator grava `sede: true` no índice.
  **A distância até a coordenada da OME não serve de critério**: a `dim_ome`
  guarda sede desatualizada em vários casos — a do GBMar está a 1,55 km do
  quartel que o próprio KMZ levantou.
- `agruparProximos` ganhou `fixo` + `chave`: um grupo liderado por uma sede só
  aceita postos da mesma OME, então a insígnia sobrevive. A âncora do grupo
  passa a ser a própria sede (não a média dos membros) — o brasão do batalhão
  tem que pousar no quartel.
- No anti-sobreposição a sede tem peso 0,9 (quase imóvel): quem se afasta é a
  vizinhança.

Medido a 1× de zoom: **25 → 40 insígnias no mapa, cobrindo os 13 grupamentos**
(antes, vários sumiam dentro de balões de grupo).

**2. Login.** Placeholder do usuário virou "Insira seu CPF", com máscara
aplicada enquanto digita; o da senha virou "Insira sua senha"; os dois ficaram
um tom mais claros (`placeholder:text-muted-foreground/60`).

A máscara **só entra quando a digitação é numérica**. O acesso hoje não é por
CPF — é o usuário administrador (`VITE_ADMIN_USUARIO`) ou uma das siglas de
nível de acesso —, e mascarar tudo travaria os dois: quem digitasse `adm` veria
o texto ser reescrito. Verificado no navegador: `1234 → 123.4`,
`12345678901 → 123.456.789-01`, `adm → adm`. O que vai para o autenticador é o
CPF **sem** máscara, para o dia em que o login por CPF existir de fato.

**3. Documentação de deploy e de continuidade.** Ver `DEPLOY_SERVIDOR_INTERNO.md`
(documento para entregar à equipe de TI) e o `README.md` reescrito (como
retomar o trabalho em outra máquina).


### 2026-09-21 — Auditoria dos painéis de BI: o Dashboard Pessoal já está completo; os quatro painéis corporativos não chegaram

**O pedido.** Integrar ao sistema real os painéis novos que Igor produziu no
Claude Cowork, seguindo o mesmo procedimento das rodadas anteriores: inserir o
que já está validado, deixar quadrante bloqueado marcado como "aguardando
dado", e consolidar as perguntas em aberto.

**O achado que mudou a sessão: o pedido partia de um estado antigo do
repositório.** O enunciado pedia para inserir os painéis 05 e 06, inserir 4 de
6 quadrantes do 07, 3 de 4 do 08, e nada do 09. Os nove módulos já estão em
`src/pages/efetivo/` desde 2026-08-19 — painel 07 com **6/6** (os dois cards
foram destravados com o SQL original do Metabase contra `inativos_metabase`/
`peculio_metabase_v1`), painel 08 com **4/4** (a tabela nominal foi liberada
pela decisão de PII do mesmo dia) e painel 09 inteiro. **Não havia nada do
Dashboard Pessoal para inserir.**

Conferido também o `handoff-paineis-05-a-09.zip` (estava em `~/Downloads`):
os 8 arquivos estão commitados em `dashboards/01-efetivo-geral/` e são
**byte-idênticos** ao zip. A pergunta "Igor subiu ou está só com ele?" está
respondida.

**Os quatro painéis corporativos não existem aqui.** PLAN DLOG, Dashboard DF,
Dashboard de Ocorrências e Dashboard de Vacinações (DAS): varredura por nome e
por conteúdo no repositório, e nas pastas Desktop/Downloads/Documents da
máquina — nenhum HTML, spec, `status_*.md` ou SQL. `roe_*` não aparece em
lugar nenhum do repositório. Nada foi construído para eles: sem a lista de
abas conferida, os títulos dos cards e os números de referência, montar
esqueleto "aguardando dado" seria inventar a estrutura do painel, não
sinalizar um bloqueio.

**Segundo bloqueio, independente dos arquivos: a rede.** `DATABASE_URL_DW`
(`10.193.1.252:54301`) dá **timeout** desta máquina, e o mesmo vale para os
outros três hosts internos (`10.193.0.20` do `DATABASE_URL_OPS`, onde vive
`vaccine_control_production`; `10.193.0.16` do SGP; `10.193.1.252:54329` da
Frota). Só os três Neon respondem, e nenhum tem ocorrência ou vacinação. Isso
decide o caminho de integração dos quatro painéis: rodar os extratores da
máquina que está na rede da corporação, ou pedir os exports ao Igor.

**Uma pergunta antiga respondida de graça.** "Onde as ocorrências vivem hoje,
agora que `ovrsgo` e `ovrroe` estão fora de uso" estava aberta desde
2026-08-24. O painel do Igor revela: `public.roe_basico_ocorrencias` mais as
tabelas de detalhe por natureza, **no mesmo schema `public` do
`10.193.1.252:54301`** que já hospeda `peculio_metabase_v1`, `cim_*` e
`fin_*`. Catalogado em `DW_CATALOGO_FONTES.md` com a ressalva de que nenhuma
coluna foi verificada.

**A divergência dos ADIDOs (painel 04) foi resolvida — e a hipótese
registrada estava errada.** O `spec-04-militares-adidos.json` atribuía a
diferença a "snapshot vivo, datas de referência diferentes". A causa real é
aritmética: o painel 08 trunca os anos antes de escolher a faixa
(`Math.floor`), o recálculo do painel 04 não truncava. Medido contra
`carreira_extra.json`:

| Agrupamento dos 187 adidos | Resultado |
|---|---|
| `tempoOmeAnos` fracionário direto na faixa | 104 / 44 / 19 / 20 |
| `tempoOmeAnos` truncado para ano inteiro | **117 / 36 / 23 / 11** |
| Print do Igor | **117 / 36 / 23 / 11** |
| Aproximação do Pecúlio (o que o app mostra) | 116 / 36 / 23 / 11 |

`tempoObmAtualDias` é confiável, inclusive para adidos, e não há data de
referência divergente. O que existia era um erro de faixa.

**Defeito corrigido, com impacto medido.** `bucketTempoParaIntervaloDias`
(`src/lib/efetivoDashboard.js`) parava cada faixa no primeiro dia do ano que
ela nomeia no fim (`"0-5"` → 0..1.825; `"6-10"` → 2.190..3.650), abrindo dois
vãos: **1.826-2.189 e 3.651-4.014**. Consequência real no painel 04, medida
nos 187 adidos: as quatro tabelas do drill-down somavam **169** em vez de 187
— **18 adidos não apareciam em tabela nenhuma** e **9 abriam a tabela da faixa
vizinha** (5.476-5.839 iam para "15+" em vez de "11-15"), 27 de 187 errados.
Cada faixa agora cobre os 365 dias de cada ano que nomeia; depois da correção
as tabelas dão 104→**117** / 31→**36** / 14→**23** / 20→**11** = 187, que é
exatamente o print. Verificado no navegador (a tabela de "0-5" abre com
"Filtrados: 117").

**O que ficou como decisão, deliberadamente.** O gráfico do card continua
contando pela aproximação do Pecúlio (116, porque 1 adido tem `#NUM!` naquela
coluna da planilha). Trocar a fonte faria o card bater exatamente com o print,
mas altera um número de painel já validado por Igor — fica como pergunta, não
como mudança unilateral. O card passou a declarar a ressalva no próprio
subtítulo, para a diferença não ficar silenciosa.

**Entregável desta sessão:**
[`dashboards/PENDENCIAS-PAINEIS-CORPORATIVOS.md`](dashboards/PENDENCIAS-PAINEIS-CORPORATIVOS.md)
— auditoria dos 9 painéis, o que falta dos quatro corporativos, e a lista
única de 18 perguntas separada por responsável (12 para Igor, dado e regra de
negócio; 6 para Valério, acesso e governança).

### 2026-09-21 (mesmo dia, segunda rodada) — Os quatro painéis corporativos chegaram: auditados, e o padrão de trabalho de Igor está mais rigoroso do que o presumido

**Correção de premissa, feita pelo usuário.** Igor produz os painéis no
Claude Cowork como **design/visualização**, não necessariamente dado
validado — nosso trabalho é identificar as visualizações e checar se temos
o dado real para sustentá-las, não presumir que todo card "pronto" já bate
com um print. Registrado como memória de projeto
(`project_igor-cowork-nao-e-dado-real`), porque muda a leitura de qualquer
handoff futuro do Igor, inclusive os já commitados.

**Só que, checando os quatro pacotes que chegaram nesta rodada, a premissa
se confirma só em parte.** `das.zip`, `dlog.zip`, `ocorrencias.zip` e
`df.html`+`df.md` apareceram em `dashboards/` (Igor os disponibilizou depois
da primeira auditoria do dia, que ainda não os encontrava). Auditados por
leitura de código e renderização ao vivo (DF e Vacinações renderizaram sem
erro de console; DLOG e Ocorrências passaram nas mesmas checagens estáticas,
sem render ao vivo só por um limite de tamanho do preview local da
ferramenta — não defeito no arquivo). Achado principal: **Igor tem um
prompt-padrão reutilizável** (o arquivo `df.md`, na verdade um template
genérico, não um status do DF especificamente) que **exige** processo de
validação rigoroso antes de qualquer HTML ser escrito — nunca inferir,
validar por SQL/CSV/reconciliação de total, marcar confirmado vs. não
confirmado, documentar divergência sem esconder, manter um
`status_<projeto>.md` por painel. Os quatro pacotes seguem isso à risca, e
os `status_*.md` de Ocorrências e Vacinações em particular são extensos e
meticulosos — o de Ocorrências (338 linhas) já teve o bug do `UNION ALL` em
"Situação das vítimas" encontrado, documentado com o SQL exato, e uma query
de diagnóstico escrita (não rodada, deliberadamente, para não arriscar
comando contra estrutura de banco não confirmada) para os 5.253 registros
sem `data_recebimento` — dois achados que a primeira auditoria desta sessão
tinha te feito reconstruir por inferência, sem saber que já existiam
prontos, documentados, do lado de Igor.

**Isso não invalida a correção de premissa — mostra a faixa real de
variação.** Nem todo painel de Igor vem com esse nível de rigor (o handoff
original dos painéis 05-09 tinha menos documentação por card), mas quando
ele segue o próprio prompt-padrão, o resultado é auditável card a card sem
precisar perguntar "isso é validado ou só ilustrativo?" — a resposta já está
no `status`. A pergunta continua valendo por padrão para qualquer entrega
futura que não venha com esse nível de documentação.

**Nível de validação por painel** (dos `status_*.md` de Igor, não inferido):
Ocorrências tem ~35 de 38 quadrantes confirmados por SQL/CSV, 2 por
reconciliação de print, 1 pendente; Vacinações tem 0 confirmados por SQL
(Igor está em modo só-leitura em todo o dashboard) mas 8 de 10 validados por
reconciliação de total, 2 bloqueados; PLAN DLOG tem 5 itens com fórmula
vista no editor do Looker Studio, 1 não confirmado (card "CONTRATAÇÃO") e 5
pendências menores; Dashboard DF tem 3 blocos confirmados, 1 por
reconciliação, e 2 com divergência documentada e não resolvida (R$
1.273.530,74 entre "Total do empenho de diárias" e a soma do detalhamento
por operação).

**Um gap real, não presumido: falta o `status_dashboard_df.md`.** `df.html`
referencia esse arquivo 4 vezes em comentário — é onde estaria o histórico
de validação do SFI e o contexto completo da divergência de diárias. O que
veio no lugar (`df.md`) é o prompt-padrão genérico de Igor, sem dado
específico do DF. Pedido a Igor.

**O que ainda falta, independente da qualidade dos pacotes:** os quatro
continuam sendo protótipos HTML autônomos — a tradução para componente React
consumindo `src/data/real/` (o padrão real dos painéis 01-09) ainda não foi
feita, e depende do mesmo bloqueio de rede já registrado (os quatro hosts
`10.193.*` continuam inalcançáveis desta máquina). Também não foram
commitados nem organizados na convenção de pasta por painel
(`dashboards/02-plan-dlog/` etc., no padrão de `01-efetivo-geral/`) — fica
para quando o Valério decidir o próximo passo.

`dashboards/PENDENCIAS-PAINEIS-CORPORATIVOS.md` foi revisado (Parte 2
reescrita, Parte 3 com as perguntas já respondidas pelos `status_*.md`
marcadas e reformuladas) para refletir tudo isso — não um documento novo.

### 2026-09-21 (terceira rodada, mesmo dia) — VPN ativada: DF confirmado ao vivo, dois hosts com problema de credencial (não de rede), DLOG não é banco

**Pedido do usuário:** com a VPN ativa, confirmar os hosts/bancos dos quatro
painéis (DAS em `10.193.0.20:5432/vaccine_control_production`, Ocorrências
em `10.193.1.252:15432/roe_api_production`, DF em
`10.193.1.252:54301/postgres` com tabelas `fin_*`) e descobrir se a
documentação do DLOG explica onde ele coleta dado — e subir o `npm run dev`.

**Feito, com a instrução explícita de manter registro de onde cada dado
está hoje** (para a fase futura de estruturar o DW de verdade). Resultado,
testado com a VPN ligada, só `SELECT`/`information_schema`, nenhuma senha
impressa:

- **DF: confirmado 100%.** `DATABASE_URL_DW` conecta normalmente. As três
  tabelas existem exatamente como o usuário descreveu — `fin_autorizacao`
  (600 linhas), `fin_carnaval_2026` (24 linhas), `fin_sfi_ordinario` (306
  linhas) — com schema completo levantado (ver `DW_CATALOGO_FONTES.md`).
  Cobre a aba "SFI" do painel por inteiro. **Achado novo:** as abas
  "Suprimento Individual" e "Despesas Diversas" do mesmo painel **não
  correspondem a nenhuma das 21 tabelas visíveis nesse banco** — a fonte
  real delas ainda não foi encontrada, não é só falta de SQL.
- **DAS: rede ok, credencial quebrada.** `ctic@10.193.0.20` (var.
  `DATABASE_URL_OPS`) parou de autenticar em **qualquer** banco desse
  host — inclusive o `postgres`, que já estava documentado como acessível
  em sessão anterior. Isolado como problema desse host específico: o mesmo
  `ctic` autentica normalmente em `10.193.0.16` (SGP). O erro é rejeição de
  senha (`FATAL: password authentication failed`), não timeout — a VPN e a
  rede estão funcionando, só a credencial não. Precisa de senha atualizada
  ou credencial nova para esse host.
- **Ocorrências: host corrigido, credencial nova necessária.** A dedução
  registrada horas antes nesta mesma sessão (que `roe_*` estaria no schema
  `public` do banco do DW, 54301) **estava errada** — confirmado consultando
  `information_schema.tables` nesse banco com a VPN ativa: 21 tabelas, zero
  `roe_*`. O host/banco corretos, informados pelo usuário
  (`10.193.1.252:15432/roe_api_production`), são uma instância Postgres
  totalmente separada, mesmo servidor físico mas porta diferente. Testado
  com as duas credenciais já disponíveis (`datawarehouse-user` e `ctic`) —
  as duas rejeitadas. Como a rejeição também é de senha, não timeout, a
  porta 15432 está alcançável pela VPN; falta só a credencial certa.
- **PLAN DLOG: não é banco.** Nem `status_dlog.md` nem o HTML do painel
  mencionam host, porta ou string de conexão Postgres em lugar nenhum. O
  próprio `status_dlog.md` documenta a fonte real: export **"NOVO CONTROLE
  - PLAN DLOG.xlsx"** (08/09/2026) alimentando o relatório Looker Studio
  "Controle DLOG" (Igor tem acesso de editor). Ou seja, a pergunta certa
  para Igor não é "qual host", é **onde essa planilha vive e como ela
  chega no Looker Studio** — o pipeline de integração provavelmente se
  parece mais com o de Finanças (planilha → Windmill → Postgres) do que
  com os outros três painéis, que são todos bancos vivos.

**`npm run dev` no ar**, `http://localhost:5173`, sem erros de servidor.

`DW_CATALOGO_FONTES.md` corrigido (Ocorrências: host trocado de 54301 para
15432, com o motivo do engano registrado; Vacinação: credencial quebrada
documentada; Financeiro: schema real das 3 tabelas `fin_*` + o achado de que
Suprimento Individual/Despesas Diversas não estão nelas + o esclarecimento
de que DLOG é planilha, não banco). `dashboards/PENDENCIAS-PAINEIS-CORPORATIVOS.md`
atualizado nos itens 6, 13 e 14 para o mesmo resultado.

**Próximo passo, quando as credenciais chegarem:** com DF já 100% acessível,
dá para começar a construir o componente React real da aba SFI do painel DF
agora — é o único dos quatro sem nenhum bloqueio de acesso pendente.

### 2026-09-21 (quarta rodada, mesmo dia) — DF completo: SQL real das 5 visualizações restantes, e a divergência de diárias explicada com prova matemática

**Pedido do usuário:** priorizar DF entre os quatro painéis. Mandou o SQL
real do Metabase para as 5 visualizações que faltavam (2 em Suprimento
Individual, 3 em Despesas Diversas) e pediu para verificar se batia com o
que Igor construiu, e se respondia as dúvidas em aberto.

**Resultado: as 5 vêm de `fin_autorizacao`, filtradas por `enquadramento` —
não de uma tabela separada como eu tinha concluído antes.** `'SI'` alimenta
Suprimento Individual; `'DIÁRIAS'` e `'FUNERAL'` alimentam Despesas
Diversas. Rodei as 5 queries ao vivo (VPN ativa) e comparei com
`df.html`: as 5 visualizações que Igor construiu são exatamente as 5 do
SQL — nem uma a mais, nem uma a menos. Os valores batem com drift normal
de base viva (SI total: R$1.349.387,65 → R$1.446.867,65; 39 unidades nos
dois momentos, soma exata nos dois). Um achado curioso: o donut de Auxílio
Funeral por mês **não teve nenhum drift** — os 6 meses batem centavo a
centavo com o snapshot do Igor.

**A divergência de diárias (R$1.273.530,74, aberta desde 2026-08-19) está
resolvida, com prova matemática, não suposição.** O card "Total do empenho
de diárias" soma **todo** `fin_autorizacao` com `enquadramento='DIÁRIAS'
AND situacao='EMPENHADO'`. A query original do Metabase para "Valores de
diárias empenhadas por Operação" restringe isso com um `WHERE ficha_financ
IN (...)` de **9 valores literais** — hoje existem **18** valores
distintos de `ficha_financ` nessa combinação. Somei os 9 que ficam de fora
da lista: **R$2.559.090,74 hoje**, **R$1.273.530,74 no snapshot do Igor**
— bate exato com a divergência documentada, nos dois momentos no tempo,
com precisão de centavo. Não é filtro errado nem fonte diferente: é uma
lista hardcoded no Metabase que ficou incompleta conforme novas operações
foram cadastradas.

**Achado de qualidade de dado para a fase de estruturação real do DW:**
pelo menos 2 dos 9 `ficha_financ` "de fora" parecem ser a mesma operação
com grafia diferente de uma que já está na lista — `"EXECUTIVA - Diárias -
Calendário Turístico"` (falta a palavra "Operação") vs. `"EXECUTIVA -
Diárias - Operação Calendário Turístico"`; e `"EXECUTIVA - Diárias -
Operação Pernambuco Meu País"` vs. `"Diárias - Operação Pernambuco Meu
País"` (sem o prefixo "EXECUTIVA -"). Registrado em `DW_CATALOGO_FONTES.md`
como candidato a dimensão normalizada quando o `core` for modelado de
verdade — hoje `ficha_financ` é texto livre comparado por igualdade exata,
o que já causou um bug de visualização real.

**Também levantado, sem uso ainda:** `fin_autorizacao` tem 11 valores
distintos de `enquadramento` no total — só 4 têm painel hoje (SFI, SI,
DIÁRIAS, FUNERAL). Os outros 7 (`BOLSA FORMAÇÃO`, `CONTRATO`, `FOLHA DE
PAGAMENTO`, `FORA DE ENQUADRAMENTO`, `INDENIZAÇÃO POR MORTE`, `OPERAÇÃO DE
CRÉDITO`, `TRANSLADO`) são candidatos óbvios para o próximo recorte
financeiro, quando chegar a hora.

**Estado do DF agora: os 3 tabs têm SQL real confirmado, zero bloqueio de
acesso.** Falta só formalizar como extrator
(`etl/financas/extract_dashboard_df.py`, no padrão dos extratores
existentes em `etl/financas/`) e construir o componente React real —
próximo passo natural.

### 2026-09-21 (quinta rodada, mesmo dia) — DF integrado ao sistema real: primeiro dos quatro painéis corporativos a sair do protótipo

**Pedido do usuário:** tirar a lista fixa de `ficha_financ` do gráfico de
diárias (decisão da rodada anterior) e, com isso feito, inserir cada painel
no sistema real, seguindo a mesma lógica já usada em Efetivo e Viaturas.

**Extrator novo: `etl/financas/extract_dashboard_df.py`.** Lê
`fin_sfi_ordinario`/`fin_autorizacao` direto do Postgres do DW
(`DATABASE_URL_DW`, VPN ativa) e escreve
`src/data/real/financas_dashboard.json`. Reaproveita — não duplica — o
de-para de unidades já validado em `etl/financas/mapeamento_unidades.json`
(o mesmo arquivo que já alimenta o KPI de Finanças via
`extract_financas.py`), confirmando por engenharia reversa três coisas que
esse arquivo já sabia e que eu tinha descoberto de novo, do zero, nas
rodadas anteriores desta sessão: **CPPA soma em DGP**, **DAFO/DPAFO não são
unidades** (por isso Diárias não tem quebra por unidade) e **as variantes
de "à mesma"/"aos mesmos" são pagamento à família, não a uma unidade** (por
isso Funeral também não tem quebra por unidade). Três exceções novas
adicionadas ao arquivo: `GBI/NORONHA`→GBI (destacamento em Fernando de
Noronha, só aparece em `fin_sfi_ordinario`, não na planilha que o mapeamento
cobria antes) e duas grafias do auxílio funeral que ainda não tinham
aparecido ("Aos mesmo" singular, "Às mesmas").

**Achado de qualidade de dado na `fin_sfi_ordinario`, resolvido no
extrator:** a coluna `destino` tem duplicidade de grafia para a mesma
unidade — `"1º GB"`/`"1ºGB"` (espaço), `"CMan"`/`"CMAN"` (maiúscula),
`"GBMar"`/`"GBMAR"`, `"CAT ZM"`/`"CATZM"` — 34 valores brutos que colapsam
para 21 unidades reais depois de normalizar (mesma função `normalizar()` já
usada em `extract_financas.py`: maiúsculas, sem acento, sem espaço/º/barra).

**Frontend, mesmo padrão de Efetivo/Viaturas:** indicador "Finanças"
reaproveitado (já existia por unidade em `organograma.js`), rota
`/financas/:id/dashboard/:modulo` registrada em `App.jsx`, entrada em
`DASHBOARDS_REAIS` (`Indicador.jsx`). Três módulos:
`ModuloSfi.jsx` (4 quadrantes: barras Consumo/Serviço por unidade, donut de
totais, linha mensal, barras de SFI Extra por unidade), 
`ModuloSuprimentoIndividual.jsx` (stat + barras por unidade),
`ModuloDespesasDiversas.jsx` (card de diárias, donut de Auxílio Funeral,
barras de diárias por operação — só na visão do Comando Geral).

**Decisão da rodada anterior, verificada no navegador:** com a lista fixa
removida, "Total do empenho de diárias em 2026" (R$9.091.759) bate exato
com a soma de "Valores de diárias empenhadas por Operação" — a divergência
de R$1,27M que abriu a pergunta 7 da Parte 3 não aparece mais.

**Melhoria pontual em componente compartilhado:** `PanelGrafico.jsx` não
tinha legenda no tipo `hbar` (só em `bar`) — necessário para o gráfico
Consumo/Serviço de "Valores liquidados por Unidade" (21 unidades, melhor em
barra horizontal). Adicionado seguindo exatamente o padrão já usado em
`bar`; não afeta nenhuma página existente (nenhuma outra passava `legenda`
com `hbar`).

**Testado no navegador com dado real:** as 3 abas renderizam sem erro de
console. Escopo por unidade confirmado em dois pontos: Comando Geral mostra
os totais batendo com o que já validamos por SQL nas rodadas anteriores;
GBI mostra só R$40.000 (seu próprio valor de SI, isolado do resto da
corporação). O `EmptyState` de Despesas Diversas aparece corretamente fora
do Comando Geral, com o motivo explicado na tela.

**`npm run lint` limpo. `npm run typecheck`: 266 erros, 19 a mais que a
baseline de 247** — mesmo ruído de prop opcional inferida já presente no
projeto inteiro (não um bug real), concentrado nos arquivos novos de
`src/pages/financas/`.

**O que ainda falta para o DF:** commitar os 4 pacotes originais de Igor;
organizar em pasta por painel; não existe tabela de detalhamento real de
Finanças (equivalente a `EfetivoDetalhe.jsx`) — os gráficos não têm
drill-down ainda. **DLOG, DAS e Ocorrências seguem no protótipo estático** —
DF foi o único dos quatro com todas as três pré-condições resolvidas nesta
sessão (arquivos em mãos, rede alcançável, credencial funcionando).

### 2026-09-21 (sexta rodada, mesmo dia) — Ajustes visuais nos gráficos do DF, ditados quadrante a quadrante pelo usuário

**Pedido do usuário:** uma lista extensa de correções visuais, título por
título, para as 3 abas do Dashboard DF já integrado na rodada anterior —
reposicionar KPIs, trocar tipos de gráfico, corrigir formatação de moeda e
eixos cortados.

**Mudanças em `ModuloSfi.jsx`:**
- "Valores liquidados totais" (donut isolado) foi **removido** — seu
  conteúdo (Consumo/Serviço com total) virou a legenda visual de "Valores
  liquidados por Unidade" (donut ao lado da barra, vermelho/cinza).
- "Valores liquidados por Unidade" virou **barra vertical** (era horizontal),
  com **ordenação interna** (Soma/Consumo/Serviço × crescente/decrescente,
  controle local no cabeçalho do card) e rótulos em milhar (`fmtMoedaMil`:
  "R$ 70,294 mil", zero como "R$ 0,00" — convenção literal pedida pelo
  usuário).
- "Análise mensal": linha reta (`curva="linear"`, era `monotone`), meses
  capitalizados (`capitalizar()`), valor acima de cada ponto, tooltip em
  moeda cheia com centavos (`fmtMoedaCentavos`). Eixo Y deixou de cortar
  valores (ver bug de margem abaixo).
- "SFI Extra — Empenhado em 2026" e "SI Total Empenhado em 2026" viraram
  cards sozinhos na própria linha (mesmo grid de "Valores Liquidados (SFI
  Ordinário)"), com o gráfico correspondente abaixo, não mais ao lado.

**Mudanças em `ModuloDespesasDiversas.jsx`:** "Total do empenho de diárias"
também virou card isolado. "Empenho mensal do Auxílio Funeral" deixou de ser
donut e virou **linha temporal** (mesmo tratamento da Análise mensal do
SFI), com nome do mês por extenso (`MESES_COMPLETO_LABEL`, a fonte só grava
sigla de 3-4 letras). Filtro de unidade no Auxílio Funeral foi **avaliado e
descartado**: `destino` para `enquadramento='FUNERAL'` é majoritariamente
texto livre não-organizacional (nome de família do militar falecido) — o
extrator já evita ler esse campo por minimização de dado pessoal
(LGPD, mesmo princípio de `extract_financas.py`); adicionar o filtro
reintroduziria exatamente o risco que a decisão original evitava.

**Dois bugs reais encontrados e corrigidos em `PanelGrafico.jsx`
(componente compartilhado com Efetivo/Viaturas):**
1. **Margem esquerda negativa (`left: -16`)** cortava os valores do eixo Y
   em todo gráfico `bar`/`line`/`area` do sistema — não só no DF. Trocada
   para `left: 4`. Bug pré-existente, não introduzido nesta sessão.
2. **Eixo Y categórico do `hbar` sem `interval={0}`** — o Recharts decide
   sozinho quantos rótulos cabem e descarta o resto quando a lista é longa;
   com as 38 unidades de "SI Total Empenhado por Unidade" isso cortava
   **metade** dos nomes (confirmado por contagem de nós no DOM: 19 rótulos
   para 38 barras). Corrigido adicionando `interval={0}`, igual ao que o
   eixo X (`eixoX`) já fazia. Testado depois em página de Efetivo
   ("Ingresso de militares", Movimentação e Carreira) para garantir que a
   mudança não quebrou nada fora do DF — os 38 anos ali continuam
   aparecendo todos, como antes.
3. **Bug do quadrado preto na legenda** (`<Bar>` sem `fill` próprio — o
   Recharts usa esse `fill`, não as `<Cell>` internas, para colorir o
   swatch da legenda) também corrigido, embora a "Valores liquidados por
   Unidade" tenha deixado de usar `<Legend>` do Recharts nesta rodada (virou
   donut). Afeta as 3 outras páginas que ainda usam `legenda` com `bar`
   (Efetivo: Movimentação e Carreira, Situações Funcionais; Viaturas: Tipos
   e Capacidade) — não testadas uma a uma, mas a mudança é estritamente
   aditiva (só define uma cor que antes ficava undefined).
4. Também nova: largura do eixo de categoria do `hbar` calculada
   dinamicamente a partir do maior rótulo (era fixa em 56px, cortava nomes
   longos como "DINTER II").

**Nota sobre o ano nos meses:** o usuário pediu "Março/2026" quando a fonte
"possuir" o ano. Nem `fin_sfi_ordinario.mes` nem `fin_autorizacao.mes` têm
coluna de ano — só o nome do mês. Não inventamos o ano; os eixos mostram só
o nome do mês, sem sufixo de ano. Fica registrado aqui para a fase de
reestruturação do DW: se o ano importa para série histórica de verdade
(hoje os dados parecem ser só do exercício de 2026), a fonte real precisa
gravar isso explicitamente.

**Testado no navegador, um bug de layout encontrado e corrigido no
processo:** o wrapper flex da "Valores liquidados por Unidade" usava
`items-center` também no modo empilhado (mobile), o que colapsa a largura do
filho `flex-1` a zero no eixo cruzado — o gráfico simplesmente não
renderizava (`ResponsiveContainer` com 0 filhos, confirmado via DOM).
Corrigido para `items-center` só a partir de `lg:`. `npm run lint` limpo;
`npm run typecheck` seguiu em 266 erros (mesma baseline da rodada anterior,
nenhum erro novo).

### 2026-09-21 (sétima rodada, mesmo dia) — Segunda leva de ajustes visuais do DF: ordenação com rótulo, rolagem horizontal, legenda sem donut, rótulos de linha sem sobrepor, espaçamento de eixo

**"Valores liquidados por Unidade" (`ModuloSfi.jsx`):** rótulo "Ordenar por:"
antes dos botões de ordenação; "Soma" renomeado para "Total" (label e
chave interna). O gráfico agora fica dentro de um contêiner
`overflow-x-auto` com largura mínima calculada (`porUnidadeData.length *
110px`) — ~10 unidades cabem numa tela comum antes de precisar rolar, com a
barra de rolagem nativa aparecendo embaixo do gráfico quando há mais que
isso. O donut foi removido; a legenda virou um bloco de texto simples
(Consumo em vermelho, Serviço em cinza, Total sem cor, abaixo dos dois).

**Dois bugs genéricos corrigidos em `PanelGrafico.jsx` (não específicos do
DF):**
1. **Rótulos de ponto de linha sobrepondo a própria linha** — antes todo
   rótulo ficava `position="top"`, o que em vales (mínimos locais) cai bem
   em cima do "V" formado pelos dois segmentos. Substituído por um
   renderizador customizado (`criarRotuloLinha`) que decide acima/abaixo
   ponto a ponto: acima num pico (valor ≥ os dois vizinhos existentes),
   abaixo num vale — exceto no mínimo global da série, que fica sempre
   acima (não há espaço abaixo; coincidiria com o eixo X). Testado nos dois
   gráficos de linha do DF (Análise mensal do SFI, Auxílio Funeral) — picos e
   vales alternando corretamente, R$ 0 em Setembro (mínimo global) ficou
   acima como esperado.
2. **Pontos nas bordas do eixo X cortados** — novo prop `paddingEixoX`
   (repassado para o `padding` do `<XAxis>` do Recharts), usado com
   `{left: 24, right: 24}` nos dois gráficos de linha do DF.
3. Também: margem direita do `hbar` passou a ser calculada dinamicamente a
   partir do maior rótulo formatado (mesma técnica já usada pra largura do
   eixo Y) — corrige corte de valores grandes como "R$ 3.884.760" em
   "Valores de diárias empenhadas por Operação", cujo espaçamento vertical
   também foi ampliado (26px→42px por linha, mínimo 320→400) porque os
   nomes das 18 operações estavam quase se sobrepondo.

**Testado no navegador:** rolagem horizontal confirmada via DOM
(`scrollWidth > clientWidth`); rótulos de linha acima/abaixo conferidos
visualmente nos dois gráficos; valores grandes de diárias não cortam mais.
`npm run lint` limpo; `npm run typecheck`: 265 erros (1 a menos que a
rodada anterior — a remoção do `DonutChart` de `ModuloSfi.jsx` tirou uma
das inferências de prop opcional).

### 2026-09-21 (oitava rodada, mesmo dia) — Auxílio Funeral: grid estava esticando a altura do card para bater com o vizinho

**Bug real, não visto antes por não ter sido comparado lado a lado:** o
grid `lg:grid-cols-2` da aba Despesas Diversas estica os dois cards da
linha pra mesma altura por padrão (`align-items: stretch` do CSS Grid). O
card "Valores de diárias" é alto de verdade (756px, 18 operações). O
"Empenho mensal do Auxílio Funeral" tinha gráfico de 320px só, mas o card
inteiro esticava para acompanhar o vizinho, sobrando bastante espaço em
branco abaixo do gráfico. Corrigido com `lg:items-start` no grid (cada
card fica só do tamanho do seu próprio conteúdo) e a altura interna do
gráfico reduzida de 320 para 220 (6 meses não precisam de tanto espaço
vertical). Por pedido do usuário, os dois cards ficam desalinhados na
base — aceitável, a prioridade era eliminar o espaço em branco.

### 2026-09-21 (nona rodada, mesmo dia) — Dashboard de Vacinações (DAS) integrado ao sistema real, 4 abas

**Credencial:** o usuário colou no chat uma connection string read-only
para `vaccine_control_production` (10.193.0.20:5432, usuário `ctic`) —
usada só nesta sessão (via `DATABASE_URL_OPS` inline no comando de
extração), nunca gravada em `.env.local`. Rede interna, precisa de VPN
conectada na máquina que roda o extrator.

**Fonte:** view `public.vw_vaccinations_dashboard` (join pronto de
vaccinations/campaigns/vaccines/vaccine_brands/militaries/omes/
applicators), grão por evento de vacinação — 3.030 linhas. Validado
rodando 6 agregados reais contra os números já confirmados por print do
Metabase em `status_dashboard_vacinacoes.md`: total geral (3.030), top10
OME (soma 1.884), top8 vacinas (soma 2.254), top7 postos (soma 2.333),
top7 aplicadores (soma 2.662), 5 marcas (Butantan 1.019/Serum 294/Fiocruz
174/Pfizer 112/Biofarma 100) — todos bateram exato. Novo extrator:
`etl/das/extract_dashboard_vacinacoes.py` → `src/data/real/
vacinacao_dashboard.json`.

**Decisão de arquitetura (perguntado ao usuário, não presumido):** o
painel entra como 4 novos módulos do indicador "Atividades Específicas" da
DAS (mesmo guarda-chuva que já tinha só "Mapa de Força" — `src/lib/
vacinacaoDashboard.js`, mesclado em `AtividadesDashboard.jsx` e
`Indicador.jsx`). Diferente de Efetivo/Viaturas/Finanças, **não há filtro
por unidade de quem está vendo** — é painel exclusivo da DAS (cada um dos 4
módulos checa `unidade.sigla !== "DAS"` e mostra `EmptyState` fora dela).
O acesso de fato (Comando Geral, Subcomando Geral, DGA, DAS) já sai de
graça do sistema de `useAcessoUsuario` existente (um nível de acesso
atribuído a qualquer ancestral de DAS já enxerga DAS via `getSubordinados`
— nada novo precisou ser escrito).

**Minimização (LGPD):** a view expõe `military_cpf`/`applicator_cpf` em
texto puro — nunca extraídos (mesma regra de `extract_financas.py`).
`military_name` também fica de fora por padrão (mesmo princípio de
`efetivo.json`: nome só sai numa lista explicitamente aprovada pelo
usuário, e não há pedido de tela de detalhe de militar vacinado aqui). O
evento carrega só data/posto/campanha/vacina/marca/OME/aplicador — nenhum
identificador individual. Para a Aba 4 (participação), o numerador
("militares distintos vacinados" por vacina×OME) é pré-agregado no
extrator com `count` sobre um `set()` em Python — nunca expõe
`military_id`.

**4 abas, uma de cada vez, cada uma testada no navegador antes da
próxima:**

1. **Visão Geral** — total de vacinas, total de campanhas, por campanha,
   por OME, vacinas mais aplicadas (todos com a distribuição COMPLETA, não
   top-N como no protótipo — mesma decisão já tomada em Efetivo/Finanças) e
   **"Vacinações mensais"**, quadrante que estava 🔴 bloqueado no
   levantamento original (print só mostrava a forma da curva, sem valor por
   mês) — desbloqueado com dado real por evento.
2. **Execução e Logística** — postos, aplicadores (hbar completo) e
   "Representatividade das marcas" (donut). `DonutChart` só tinha paleta de
   5 cores pra até 9 categorias (8 marcas + "sem marca") — passada uma
   paleta de 6 cores explícita (`--chart-5`, não usada em nenhum outro
   donut do app) pra reduzir repetição.
3. **Linha do Tempo** — outro quadrante bloqueado no protótipo (~20 séries
   de vacina sobrepostas em 96 meses, "rótulos numéricos densos" demais
   pra ler com segurança). Virou um filtro "Vacina" (pré-selecionado com as
   5 mais aplicadas) sobre um `PanelGrafico` multi-série — que ganhou 2
   capacidades novas, genéricas (não específicas de Vacinação):
   `<Legend>` no tipo `"line"` (só bar/hbar tinham) e supressão dos rótulos
   numéricos por ponto quando há mais de 1 série (`yKeys.length === 1`),
   pra não reproduzir a poluição visual do protótipo.
4. **Indicador de Participação** — no protótipo era só a casca com 1
   exemplo estático congelado (filtros não recalculavam nada, faltava dado
   bruto). Agora recalcula de verdade: numerador do banco de Vacinação,
   denominador ("Efetivo total") de `efetivo.json` real (fonte SGP, já
   usado no resto do app) — **decisão do usuário**, preferindo o efetivo
   oficial à tabela `militaries` do próprio banco de Vacinação (que mistura
   INATIVOS/licenciados como se fossem "OME" e infla o denominador).
   Filtros são `<select>` de escolha única (não `MultiSelectFiltro`): somar
   "militares distintos" de vacinas ou OMEs diferentes poderia contar a
   mesma pessoa duas vezes.

**Reconciliação OME Vacinação × efetivo.json (pedida explicitamente pelo
usuário antes de prosseguir, "usar técnicas de análise" para não perder
unidade por grafia diferente):** comparação por chave normalizada (maiúsc.,
sem acento/espaço/pontuação) entre as 51 OMEs da Vacinação e as 44 de
`efetivo.json` — 36 bateram direto. As outras 7 eram a MESMA unidade com
grafia diferente, agora em `etl/das/mapeamento_unidades.json`: `CG`→
`COMANDO GERAL`, `SCG`→`SUBCOMANDO GERAL`, `DINTER / 1`→`DINTER I`,
`DINTER / 2`→`DINTER II`, `CAT / AGRESTE`→`CAT/AG`, `CAT / SERTÃO`→
`CAT/SE`, `ADIDOS / DGP`→`ADIDO`. Sobraram 6 categorias sem
correspondência real (não mapeadas — ficam com "Efetivo total
indisponível" na Aba 4, mas o numerador continua exato): **`INATIVOS`**
(517 vacinações) e **`LIC / DGP`** (2) são categoria de situação
funcional, não unidade — corretamente sem efetivo ativo; **`10º GB`** (4),
**`COINTER / 1`** (4), **`COM`** (2) e **`DAT`** (3) são unidades reais que
a fonte da Vacinação já conhece e o organograma ainda não modela (mesmo
gap documentado em `DW_CATALOGO_FONTES.md`, "Quantas unidades cada sistema
conhece" — Vacinação tem 91 OMEs na origem contra ~46 do organograma;
reconciliar tudo continua fora de escopo deste painel).

**Também corrigido, na origem, não só normalizado na exibição:** o campo
`vaccination_post` tinha duplicatas reais por sujeira de maiúscula/
minúscula e sinal de grau vs. ordinal ("GBMAR"/"Gbmar "/"GBMar" contando
como 3 postos separados no protótipo do gráfico) — `normalizar_posto()` no
extrator funde antes de qualquer agregação, não só cosmético no front.

**Testado no navegador, aba por aba** (via navegação por clique — busca
"DAS" → Diretoria → Atividades Específicas — evitando o `navigate()` direto
por URL, que corre risco do "Módulo não encontrado" transitório já
documentado nas rodadas anteriores). `npm run lint` limpo; `npm run
typecheck` subiu de 265 para 293 erros — os 28 novos são o mesmo ruído de
baseline já aceito nas rodadas anteriores (props opcionais de
`SectionCard`/`KpiCard`/`PanelGrafico`/`DonutChart`/`EmptyState` omitidas,
sem tipos JSDoc explícitos), proporcional aos 4 componentes novos — nenhum
é um erro de lógica real.

### 2026-09-21 (décima rodada, mesmo dia) — Vacinação: correções pedidas pelo usuário após revisar as 4 abas

**GCG/GSG corrigido.** O usuário, que conhece a rotina real, apontou que
"CG"/"SCG" na origem da Vacinação são o efetivo do GABINETE (GCG/GSG), não
o Comandante/Subcomandante Geral em pessoa — `mapeamento_unidades.json`
corrigido (antes mapeava pra "COMANDO GERAL"/"SUBCOMANDO GERAL", que são
siglas PRÓPRIAS e diferentes em efetivo.json/efetivo_lista.json, contendo
os adidos — ver comentário em `EfetivoDetalhe.jsx`). Bate com o volume: 6
vacinações em "CG" é mais gente que só o titular.

**Ordenação de OME por antiguidade — novo helper, escopo combinado com o
usuário.** Pedido original era "em QUALQUER gráfico/tabela do sistema" —
dado o alcance (dezenas de arquivos em Efetivo/Viaturas/Finanças/Mapa de
Força), perguntado e confirmado: só onde NÃO há uma ordenação por valor já
explícita (um gráfico ordenado pelo que ele mede, ex. "Total por OME" do
maior pro menor, mantém isso — só listas sem critério, tipo opção de
filtro, ganham a regra nova). `src/lib/antiguidadeOme.js`: antiguidade de
uma OME = menor `ordem` (ordemHierarquica real, mesmo campo que
`EfetivoDetalhe.jsx` já usa pra ordenar MILITARES desde 2026-08-19) entre
os militares hoje lotados nela em `efetivo_lista.json` — na prática, quem
tem o `ordem` mais baixo numa unidade é quem a comanda. Aplicado agora só
nos filtros de OME da Vacinação; o resto do sistema fica pra uma rodada
dedicada, por decisão do usuário (risco de regressão em painel já
validado).

**4 abas ajustadas, uma por vez:**

1. **Visão Geral** ganhou filtros de OME/Campanha/Vacina (`MultiSelectFiltro`,
   OME ordenada por antiguidade) e Período (mês/ano, dois `<select>` De/Até,
   `filtrarPorPeriodo`/`mesesDisponiveis` novos em `vacinacaoDashboard.js`).
   "Total de aplicações por OME" (51 categorias) e "Vacinas mais aplicadas"
   (~20) agora dividem a MESMA altura visível — a menor das duas — com o
   gráfico de OME ganhando rolagem vertical interna (`overflow-y-auto` num
   wrapper de altura fixa) em vez de esticar o card.
2. **Execução e Logística**: "Postos" e "Profissionais com maior número de
   aplicações" (renomeado de "Maiores aplicadores") ficam com a MESMA
   altura (a maior das duas contagens decide). Nomes de aplicador
   capitalizados no extrator (`capitalizar_nome` — a origem misturava TUDO
   MAIÚSCULO com Title Case). Donut de marcas ganhou um `max-w-md mx-auto`
   — sem isso ficava centralizado mas com muito espaço em branco lateral
   num card tão largo quanto os de cima.
3. **Linha do Tempo**: as 20 vacinas vêm todas pré-selecionadas por padrão
   agora (antes eram só as 5 mais aplicadas); ganhou o mesmo filtro de
   Período das outras abas.
4. **Indicador de Participação — lógica reconstruída.** O usuário pediu pra
   verificar se a OME da Vacinação reflete "onde o militar estava quando
   tomou a vacina" — **não reflete**: `vaccinations` não tem NENHUMA coluna
   de OME, o campo vem 100% de `militaries.ome_id` (1 valor por pessoa,
   igual em TODOS os eventos dela — confirmado consultando 5 militares com
   vacinações de 2021 a 2026, sempre a mesma OME nas 9-11 linhas de cada
   um). Corrigido pra cruzar por MATRÍCULA com `efetivo_lista.json` (fonte
   SGP, atual de verdade): "Militares que tomaram" = quem está na OME
   selecionada HOJE e já tomou a vacina em qualquer momento/OME;
   "Efetivo Atual (OME)" = quantos a OME tem hoje. O cruzamento roda no
   EXTRATOR (`extrair_participacao_atual`), nunca no navegador — formatos de
   matrícula batem removendo o traço de efetivo_lista.json ("798009-4" →
   "7980094"), 907 dos 1.196 militares vacinados encontrados (o resto é
   inativo/licenciado, sem linha no efetivo ativo, corretamente fora). O
   card de percentual virou um "acelerômetro" (`GaugeKpi.jsx`, semicírculo
   SVG animado 0→valor, cor `--primary`) — já recebe uma prop `valorAlvo`
   pra uma meta de vacinação futura (não implementada agora, só o gancho:
   sem UI pra definir meta, sem persistência, mas o traço no arco já sabe
   se desenhar quando o valor chegar).

**Bug real encontrado testando, não só nas 4 abas em si:** a animação do
`GaugeKpi` ficava travada em 0% — usava `requestAnimationFrame`, que
simplesmente não dispara numa aba que não está compositando frames (o
Browser pane desta sessão, no momento do teste, não estava visível —
confirmado pelo próprio erro do `screenshot`). Trocado por `setTimeout`
(só depende do event loop, não de haver um frame pra pintar) — mesmo risco
existiria em produção se a página abrir numa aba em segundo plano.
Confirmado via DOM (`stroke-dashoffset` do arco preenchido, antes travado
no valor "0% cheio", depois batendo exato com a fração esperada).

**Testado no navegador, cada mudança conferida via DOM/texto da página**
(inclusive a ordem do dropdown de OME, pra confirmar antiguidade e não
alfabética). `npm run lint` limpo.

### 2026-09-21 (décima primeira rodada, mesmo dia) — Vacinação: donut mais estreito e Indicador de Participação com velocímetro de verdade

**Donut de marcas — a rodada anterior tinha corrigido o lugar errado.**
`max-w-md` estava só em volta do `<DonutChart>`, dentro do `SectionCard`
— o card (fundo branco + borda) continuava com a largura cheia da grade
acima, só o conteúdo interno é que ficava centralizado com espaço em
branco visível nas laterais. Corrigido movendo o `max-w-md mx-auto` pra
fora do `SectionCard` inteiro — confirmado numa viewport de 1400px: o card
de marcas ficou com 560px (a app roda com `zoom: 1.25`, então 28rem vira
560px de tela) contra 613px dos cards vizinhos ("Postos"/"Profissionais"),
visivelmente mais estreito e centralizado.

**`GaugeKpi.jsx` reconstruído como velocímetro de verdade** (o pedido
anterior tinha só um arco preenchido, sem ponteiro): agora tem ponteiro
saindo do centro do semicírculo até a borda do arco, ângulo proporcional a
`valor/máximo`, igual um medidor de velocidade — "0" numa ponta da base,
o efetivo total na outra, o valor bruto centralizado (desenhado por
último no SVG, por cima do ponteiro — literalmente "nasce atrás" do
número, pedido do usuário), e o percentual posicionado logo acima da
ponta do ponteiro (calculado no mesmo ângulo, num raio maior que o arco).
`valorAlvo` continua só o gancho pra meta futura, sem UI ainda.

**Layout da Aba 4 reorganizado:** 3 KpiCards iguais lado a lado
(Vacina Selecionada / Efetivo Atual da OME / Militares que tomaram),
centralizados num container `max-w-2xl mx-auto`; o velocímetro abaixo,
num card próprio `max-w-md mx-auto` com título "Proporção de vacinados" e
subtítulo dinâmico ("Porcentagem do efetivo atual da OME {OME} que já se
vacinou com a vacina {vacina}") — exatamente como pedido, nenhum dos dois
ocupa mais largura que o necessário.

**Testado no navegador via DOM**, inclusive a matemática do ponteiro (a
40% preenchido, ângulo 108°, ponta em (81,46; 42,94) — bate exato com
`100 + 60·cos(108°)`, `100 − 60·sin(108°)`) e o `stroke-dashoffset` do
arco preenchido (continua animando certo depois da troca pra
`setTimeout` da rodada anterior). `npm run lint` limpo.

### 2026-09-21 (décima segunda rodada, mesmo dia) — Velocímetro: 4 ajustes finos pedidos depois de ver o resultado

1. **Valor bruto sobrepunha o ponteiro.** Estava centralizado no meio do
   semicírculo (y=94), exatamente onde o ponteiro passa perto de 50%.
   Movido pra ABAIXO da base do arco (y=148, depois das legendas "0"/
   efetivo total), sem disputar espaço com o ponteiro em nenhum ângulo.
2. **Percentual cortado no topo perto de 50%.** `viewBox` começava em
   y=0, mas o rótulo de percentual (raio 98, fora do arco) chega a y≈2
   quando o ponteiro está quase vertical — a ascendente do texto passava
   de y=0 e cortava. `viewBox` mudado de `0 0 200 130` pra `0 -18 200 168`
   (18px de folga acima, mais altura embaixo pro valor bruto).
3. **Card do velocímetro na largura dos 3 cards de cima.** Trocado
   `max-w-md` por `max-w-2xl` no wrapper (mesma classe da grade dos 3
   `KpiCard`), e removido o teto próprio de `max-w-[280px]` que o SVG
   tinha — sem isso o `max-w-2xl` do card não tinha efeito nenhum no
   tamanho real do gráfico. Confirmado via DOM: 431px de SVG contra 475px
   do card (a diferença é o padding do `SectionCard`).
4. **Filtros de Vacina/OME reposicionados.** Viraram uma faixa centralizada
   (`justify-center`) logo acima dos 3 cards, com destaque visual (fundo
   `bg-primary/5`, borda `border-primary/20`) e texto "Selecione uma
   vacina:"/"Selecione uma OME:" no lugar de "Vacina"/"OME".

**Testado no navegador via DOM** (posição y de cada rótulo, incluindo o
percentual não mais negativo/cortado; largura do SVG vs. largura da grade
de cards). `npm run lint` limpo.

### 2026-09-21 (décima terceira rodada, mesmo dia) — Velocímetro: fontes menores, e COMANDO GERAL/SUBCOMANDO GERAL fundidos em GCG/GSG

**Fontes reduzidas e rótulo de percentual travado numa faixa segura.**
Perto de 0% ou 100% o ponteiro fica quase deitado nas pontas do arco
(x≈2 ou x≈198), e o rótulo de percentual — centralizado exatamente ali —
estourava a borda esquerda/direita do `viewBox`. Fontes: percentual e
rótulos da base (0/efetivo total) de 13px/11px para 10px; valor bruto de
30px para 20px (estava grande demais, pedido do usuário). E o x do rótulo
de percentual agora é travado entre 18 e 182 (`Math.min(182, Math.max(18,
...))`) — o ângulo real do ponteiro continua exato, só a posição do texto
não sai mais do `viewBox`. Confirmado em 0,0% (x caiu pro piso do
grampo, 18, em vez de 2) e em 40% (sem mudança, já estava dentro da
faixa seguro).

**COMANDO GERAL/SUBCOMANDO GERAL fundidos em GCG/GSG — a ORDEM estava
certa, a UNIDADE estava errada.** O usuário apontou: esses dois nomes em
`efetivo_lista.json` são o TITULAR sozinho (1 militar cada), não uma OME
própria — o efetivo dele conta dentro do GABINETE (GCG/GSG), mesma lógica
já usada no de-para da Vacinação (CG/SCG → GCG/GSG). A rodada anterior já
posicionava GCG/GSG corretamente bem no topo da antiguidade (o titular tem
o `ordem` mais baixo da corporação), mas isso acontecia porque "COMANDO
GERAL"/"SUBCOMANDO GERAL" apareciam como OMEs PRÓPRIAS de 1 pessoa — 3
lugares corrigidos pra fundir de verdade:
1. `src/lib/antiguidadeOme.js` — novo `DOBRA_GABINETE` (`{"COMANDO GERAL":
   "GCG", "SUBCOMANDO GERAL": "GSG"}`), aplicado antes de calcular o
   `ordem` mínimo por OME — GCG herda a posição de COMANDO GERAL em vez de
   COMANDO GERAL competir por uma posição própria.
2. `ModuloVacinacaoParticipacao.jsx` — o `<select>` de OME não lista mais
   "COMANDO GERAL"/"SUBCOMANDO GERAL" (fundidos antes de montar a lista);
   nova `efetivoAtualDe(sigla)` soma o efetivo do titular ao de GCG/GSG.
3. `extract_dashboard_vacinacoes.py` — mesmo `DOBRA_GABINETE` em Python,
   aplicado em `carregar_ome_atual_por_matricula()`: o titular já entra
   pré-fundido na matriz `participacao`, então "Militares que tomaram"
   também conta com ele. Reextraído: 462 pares (vacina, OME) — GCG some
   como chave própria "COMANDO GERAL", passa a ter as duas contagens
   somadas (ex. Meningocócica C: 34 → 38).

**Testado no navegador**: `<select>` de OME confirmado sem "COMANDO
GERAL"/"SUBCOMANDO GERAL" na lista, com GCG/GSG nas duas primeiras
posições (onde os titulares apareciam antes). `npm run lint` limpo.

### 2026-09-23 — Dashboard de Ocorrências: scaffold completo, dado real bloqueado por credencial

Segundo painel corporativo do lote de Igor (ver Parte 2 de
`dashboards/PENDENCIAS-PAINEIS-CORPORATIVOS.md`) a sair do protótipo
estático — mas, DIFERENTE de DF e Vacinação, **ainda sem dado real**: a
credencial de `roe_api_production` (10.193.1.252:15432) continua sem
funcionar (nem `datawarehouse-user`, nem `ctic` autenticam — ver
`DW_CATALOGO_FONTES.md`, seção Ocorrências). Esta rodada entrega tudo que
NÃO depende do banco, pronto para rodar assim que a credencial existir.

**Decisão de escopo (diferente de Vacinação, de propósito):** o usuário
pediu explicitamente que Ocorrências fique "sob tutela geral da DGO...
e também em todos os subordinados desta diretoria, observando o filtro
da OME" — ou seja, o padrão de Efetivo/Viaturas/Finanças (dado filtrado
por unidade + subárvore via `siglasPermitidas`, mesmo mecanismo de
`accessControl.js`), não o padrão exclusivo-DAS da Vacinação (sem filtro
de unidade). Implementado:
- `src/lib/ocorrenciasDashboard.js` — `subarvoreDgo()`/`estaNaSubarvoreDgo()`
  calculam a subárvore de DGO (DIM/DINTER I/DINTER II/DIESP e tudo abaixo,
  recursivamente, via `getSubordinados`); fora dela, os 8 módulos caem num
  `EmptyState` de escopo (mesmo princípio de "Despesas Diversas" em
  Finanças, restrita ao Comando Geral).
- `filtrarPorEscopoOcorrencias()` reusa a MESMA convenção de
  `siglasPermitidas` (campo `ome`) — nenhum mecanismo de acesso novo, só
  consumo do que já existe, como pedido.

**Onde encaixou na navegação:** dentro do indicador "Atividades
Específicas" (o mesmo guarda-chuva que já hospeda Mapa de Força e
Vacinação — ver `Indicador.jsx`/`DASHBOARDS_REAIS`), roteado por
`/atividades/:id/dashboard/:modulo` junto com os módulos de Vacinação
(`AtividadesDashboard.jsx` ganhou os 8 `ocorrencias-*` no `COMPONENTES` e
a checagem de subárvore antes de renderizar). Alternativa considerada e
descartada: indicador novo "Ocorrências" — exigiria mexer em
`organograma.js` (KPI mock por unidade, meta, `KPI_UNIDADE_MEDIDA`) só
para hospedar 8 abas que já cabem no guarda-chuva existente. **Sinalizado
para confirmação do usuário**: se "Atividades Específicas" não for o lugar
certo a médio prazo (o card de KPI desse indicador segue "Em construção"
por ser outro domínio, SGAT), a mudança de rota é pontual.

**Extrator (`etl/ocorrencias/extract_dashboard_ocorrencias.py`) — grão por
OCORRÊNCIA, não pré-agregado por card.** Diferente da abordagem "uma query
por card" do `status_ocorrencias.md`, a extração real é uma linha por
`roe_basico_ocorrencias` (mesmo padrão de grão-de-evento de
`extract_dashboard_vacinacoes.py`) — é o que permite ao frontend recalcular
qualquer quadrante filtrado pela OME sendo vista, em vez de fixar o filtro
só no card "Ocorrências por OME". SQL verificado contra os textos EXATOS
que Igor colou em `status_ocorrencias.md` (seção 1b — Visão Geral + APH).
Cobertura honesta, sem inventar coluna:
- **Real e completo:** Visão Geral (7/7 cards, incluindo "Natureza" — que
  deixa de ser 🔴 print do protótipo porque o SQL exato já veio, só faltava
  rodar) + a maior parte de APH (Finalizadas/Aguardando/Cidade/Subgrupo/
  Situação das vítimas, esta última com os DOIS números lado a lado: o bug
  de `WHERE` no `UNION ALL` original do Metabase, e a versão corrigida —
  ver `situacaoVitimas()`).
- **Inferido, não confirmado:** a chave do JOIN com `roe_aph_ocorrencias`
  ("Atendimentos a CVI"/"Vítimas entregues com vida"/parte de Perfil de
  Vítimas) — usei `roe_basico_id = roe_id` por analogia com a query de
  diagnóstico de Produtos Perigosos (essa sim literal), documentado como
  inferência no docstring, não como SQL recebido.
- **Bloqueado por falta de SQL/schema, não por credencial:** Incêndio
  (Duração média e 5 outros cards não nomeados), Salvamento (Tipo
  Predominante), Prevenção inteira (tabela `roe_prevencao_ocorrencias`,
  zero coluna verificada), Produtos Perigosos ("Perfil dos Botijões de
  GLP"), Perfil de Vítimas (sexo/faixa etária). `status_ocorrencias.md`
  confirma que Igor validou esses cards no Metabase, mas não colou o TEXTO
  da query nem o schema da tabela de detalhe veio verificado em
  `DW_CATALOGO_FONTES.md` — nomear coluna seria adivinhar.
- **Bloqueado por qualidade de dado, não por credencial nem SQL:** "Total
  por produto" (Produtos Perigosos) — o próprio Igor marcou 🟠 pending (656
  de 672 produtos com contagem exatamente 20, cara de lista de referência).
  O extrator NUNCA extrai esse card, mesmo depois de a credencial existir,
  até confirmar com quem administra `roe_prod_perigosos_ocorrencias`.

**`etl/ocorrencias/mapeamento_unidades.json` — scaffold, não de-para real.**
Diferente de `etl/das/mapeamento_unidades.json` (construído comparando
valores DISTINTOS reais da origem), este só tem as 2 convenções já
confirmadas em nível de DW inteiro (ADIDO, dobra DINTER numeral→romano
como aposta de baixo risco) — sem credencial não há `SELECT DISTINCT ome`
pra comparar contra o organograma. Reportado como pendência explícita, não
escondido.

**Frontend — 8 módulos em `src/pages/ocorrencias/`** (`ModuloVisaoGeral`,
`ModuloAph`, `ModuloIncendio`, `ModuloSalvamento`, `ModuloPrevencao`,
`ModuloProdutosPerigosos`, `ModuloGeolocalizacao`, `ModuloPerfilVitimas`),
mais `AguardandoCredencial.jsx` (banner compartilhado, mostrado enquanto
`src/data/real/ocorrencias_dashboard.json` ficar com os arrays vazios) e
`CardPendente.jsx` (por card específico sem SQL/schema, texto vindo de
`pendenciasSemSql` no JSON — não hardcoded). `src/data/real/
ocorrencias_dashboard.json` está vazio de propósito, com `_placeholder:
true` e `_motivo` explicando o bloqueio — nunca preenchido com número
inventado. Copiado também `dashboards/08-ocorrencias/geojs-26-mun.json`
para `src/data/real/ocorrencias_municipios.json` (geometria real dos 185
municípios de PE que Igor forneceu) — o mapa coroplético em si (aba
Geolocalização) NÃO foi desenhado nesta rodada (ranking por cidade em
hbar cobre o essencial com dado real; reconciliar grafia cidade↔geoJSON e
montar um SVG coroplético é trabalho de UI maior, sinalizado como próximo
passo, não fingido como pronto).

**Protótipo organizado:** `dashboards/ocorrencias.zip` descompactado em
`dashboards/08-ocorrencias/` (`dashboard-ocorrencias.html`,
`status_ocorrencias.md`, `geojs-26-mun.json`), seguindo a convenção de
`01-efetivo-geral/` — o zip original foi removido do working tree (estava
commitado desde `f693591`, redundante com a pasta).

**Verificado:** `npm run build` (ok, mesmo warning de chunk >500kB já
presente antes) e `npm run lint` (limpo). `npm run typecheck`: 349 erros
contra 266 da rodada anterior (+83) — mesmo padrão de ruído sistêmico já
documentado nas rodadas de Finanças/DF (TS infere prop de `SectionCard`/
`KpiCard`/`PanelGrafico`/`DonutChart`/`EmptyState` como obrigatória a
partir do uso, não erro real); confirmado comparando com o padrão
idêntico já pré-existente em `vacinacaoDashboard.js` (`serieCampo`,
`serieMensalPorCampo`) antes desta sessão.

**Pendente (nenhum resolvido nesta rodada, todos fora do meu alcance sem
mais informação):**
1. Credencial de `roe_api_production` (10.193.1.252:15432) — bloqueia
   TODO dado real do painel, o mesmo tipo de bloqueio que Vacinação teve
   até o usuário passar a credencial no chat.
2. SQL/schema de Incêndio (5 cards sem nome), Salvamento (Tipo
   Predominante), Prevenção inteira, Produtos Perigosos (Perfil dos
   Botijões de GLP), Perfil de Vítimas (sexo/faixa etária).
3. Chave real do JOIN com `roe_aph_ocorrencias` (hoje inferida).
4. De-para de OME real (`mapeamento_unidades.json` é scaffold).
5. Mapa coroplético da aba Geolocalização (hoje só ranking em hbar).
6. Confirmar com o usuário se "Atividades Específicas" é o lugar
   definitivo na navegação, ou se merece indicador próprio no futuro.

### 2026-09-23 (segunda rodada, mesmo dia) — 9ª aba: Atividade Comunitária, e defesa de overflow em PanelGrafico

**Gap encontrado:** `status_ocorrencias.md` (linha ~107-108) confirma que a
coluna `natureza` de `roe_basico_ocorrencias` tem EXATAMENTE 6 valores
(Atendimento Pré-Hospitalar, Salvamento, Prevenção, Incêndio, Produtos
Perigosos, Atividade Comunitária) — mas nem o protótipo do Igor nem a
integração das 8 abas desta manhã tinham aba para "Atividade Comunitária".
Confirmado por pedido explícito do usuário: verificar as 6 naturezas e
criar a aba que faltava, seguindo a mesma lógica das que já existiam.

**Implementado — `src/pages/ocorrencias/ModuloAtividadeComunitaria.jsx`
(9ª aba):** não existe (e não foi inventada) uma
`roe_atividade_comunitaria_ocorrencias` — `DW_CATALOGO_FONTES.md` só lista
tabela de detalhe para APH/Incêndio/Salvamento/Produtos Perigosos/
Prevenção. Por isso a aba nova fica só com o que `extrair_ocorrencias()`
já cobre (grão de `roe_basico_ocorrencias`, sem mudança nenhuma no
extrator para esta aba): Finalizadas/Aguardando finalização (mesmo padrão
de Incêndio/Salvamento), Ocorrências diárias (mesmo padrão de Salvamento,
via `serieDiaria`), e Cidade/Subgrupo/Grupo (mesmo padrão de APH/Visão
Geral, via `serieCampoOcorrencias`) — todos reconstruíveis sem tabela de
detalhe, então esta aba não tem NENHUM `CardPendente`, diferente das
outras 5 abas que dependem de schema ainda não verificado. Registrada em
`MODULOS_OCORRENCIAS_DASHBOARD` (`src/lib/ocorrenciasDashboard.js`) e no
`COMPONENTES`/`TODOS_MODULOS` de `AtividadesDashboard.jsx`, mesmo padrão
dos outros 8. Comentários "8 abas"/"Nª de 8" atualizados para 9 em todos
os `Modulo*.jsx`, `AguardandoCredencial.jsx`,
`extract_dashboard_ocorrencias.py` e `AtividadesDashboard.jsx`.

**Auditoria defensiva de layout (pedido do usuário: gráficos "corretos e
aparecendo por inteiro, sem ficar cortados"):** com o banco ainda
bloqueado no início desta rodada, foi montado um dataset sintético local
(nunca gravado em arquivo rastreado — só copiado temporariamente sobre
`ocorrencias_dashboard.json` para teste visual via browser, e revertido
depois) com OMEs/cidades/categorias de nome longo e ~270 dias de série
diária. Dois bugs REAIS de overflow encontrados e corrigidos em
`src/components/charts/PanelGrafico.jsx` (fix central, beneficia todo
gráfico `bar`/`line` do app, não só Ocorrências):
1. Gráfico `line` com muitos pontos (ex. "Ocorrências diárias", série por
   DIA) mostrava um rótulo de valor em CIMA DE CADA PONTO — com 200+ dias
   isso virava uma pilha ilegível de números sobrepostos.
2. Gráfico `bar` (vertical) com muitas categorias no eixo X (ex.
   "Diretoria" seria um problema se essa coluna algum dia tivesse mais que
   um punhado de valores) sofria o mesmo problema, mais o eixo X inteiro
   sobrepondo os rótulos de categoria (`interval={0}` forçava mostrar
   todo tick).

Correção: acima de 20 categorias, `PanelGrafico` agora afina o eixo X para
~15 ticks (`interval` calculado) e some com o rótulo de valor por
ponto/barra (o número exato continua no tooltip ao passar o mouse) — hbar
não entra nessa regra, já tinha sua própria defesa (altura dinâmica). Esta
correção foi validada depois com DADO REAL (a VPN voltou durante a
sessão e o extrator rodou com schema confirmado — ver seção seguinte) na
própria aba "Ocorrências diárias" da Atividade Comunitária: o gráfico
renderizou limpo, sem os dois bugs acima.

**Sinalizado, não implementado (fora do escopo desta rodada — ver
recomendação priorizada no relatório da sessão):**
- **Card "Vítimas com deficiência" (`ModuloPerfilVitimas.jsx`)**: mesmo
  bug de "donut sobrando espaço lateral" já corrigido em
  `ModuloVacinacaoExecucao.jsx` (`SectionCard` inteiro devia entrar em
  `max-w-md mx-auto`, não só o gráfico) — encontrado durante a auditoria
  sintética, mas NÃO corrigido nesta rodada porque o módulo está sendo
  reescrito em paralelo com dado real (Perfil de Vítimas é uma das 5 abas
  que dependiam de schema até a VPN voltar). Aplicar o mesmo fix de
  `max-w-md mx-auto` quando esse módulo estabilizar.
- **Mapa coroplético da Geolocalização**: continua como ranking em hbar
  (185 cidades reais confirmadas com a VPN de volta, dynamic height
  aguenta bem via scroll). Trocar por `GeoChoropleth.jsx` (já existe,
  usado em Efetivo) é uma mudança de UI maior — avaliação registrada, não
  implementada.

### 2026-09-23 (terceira rodada, mesmo dia) — Schema real de todas as tabelas roe_*, 5 abas saem do pendente, 3 bugs reais corrigidos

VPN confirmada ativa pelo usuário durante a sessão (depois de dois testes
sem sucesso, via `Test-NetConnection` no PowerShell da própria máquina —
`ipconfig`/`Get-VpnConnection` não mostravam adaptador nenhum na primeira
tentativa). Com a credencial `roe_api` já em `.env.local` (nunca
commitada, mesmo tratamento dado à de Vacinação), rodei
`information_schema.columns` contra as 7 tabelas `roe_*` (a lista real:
`roe_aph_ocorrencias`, `roe_basico_ocorrencias`, mais uma
`roe_basico_ocorrencias_nova` idêntica byte-a-byte em conteúdo e período
— mesmas 35.865 linhas, mesmo intervalo de datas —, `roe_incendio_ocorrencias`,
`roe_prevencao_ocorrencias`, `roe_prod_perigosos_ocorrencias`,
`roe_resumo_ocorrencias` — esta com 320 linhas a mais que as outras duas,
inclusive uma com ano corrompido no dado, "202-08-25" — e
`roe_salvamento_ocorrencias`). O extrator continua lendo
`roe_basico_ocorrencias` (não há motivo pra trocar, é idêntica à "nova").

**Colunas reais que eram só suposição no scaffold da manhã, agora
confirmadas e corrigidas:**
- `roe_aph_ocorrencias`: a SQL anterior supunha `entregue_vivo_texto`/
  `deficiencia` — NENHUMA das duas existe. Os nomes reais são
  `entregue_vivo` (boolean) e `status_deficiencia` (texto categórico:
  "Não"/"Não identificado"/"Sim"/nulo — NÃO é booleano, ver bug #2
  abaixo). `genero`/`idade`/`idade_em_meses` também confirmados —
  "Divisão por gênero" e "Faixa etária" saem do pendente.
- `roe_incendio_ocorrencias`: `duracao_combate_horas`/
  `duracao_rescaldo_horas`/`duracao_total_horas` já vêm calculadas pela
  origem (numeric, não `interval` pra fazer parse) — "Duração média" sai
  do pendente, por OME.
- `roe_salvamento_ocorrencias`: `tipo_predominante` confirmado —
  "Tipo Predominante" sai do pendente (20 categorias reais, não 19 como o
  status doc antigo contava — diferença provavelmente de uma categoria
  nova desde o snapshot do Igor, não investigada a fundo).
- `roe_prevencao_ocorrencias`: schema completo confirmado
  (`duracao_evento_horas`, `publico_estimado`, `publico_presente`,
  `situacao_avcb`, `area_estimada` — e a própria tabela já tem
  ome/diretoria/cidade, sem precisar de join com o básico). Os 4
  quadrantes saem do pendente juntos — inclusive "Área média dos
  eventos", que no protótipo original era 🔴 print por falta de tabela.
  Confirmado também que a coluna `natureza` desta tabela mistura os 6
  valores do domínio inteiro (não é exclusiva de "Prevenção") — bate com
  a nota já existente em status_ocorrencias.md ("consultada à parte, sem
  filtro de natureza").
- `roe_prod_perigosos_ocorrencias`: `nome_produto` (não "produto") e
  `perfil_botijao_glp` confirmados — "Perfil dos Botijões de GLP" sai do
  pendente. "Total por produto" continua retido de propósito: mesmo com
  credencial, é a pendência 🟠 de qualidade de dado que Igor sinalizou
  (656 de 672 produtos com contagem exatamente 20), decisão de produto
  pendente com quem administra a base, não de schema.

**De-para de OME corrigido:** as 12 OMEs distintas em `ome` já batiam 1:1
com a subárvore da DGO, sem precisar de mapeamento. `diretoria` tinha UM
valor genuinamente diferente da aposta registrada de manhã: a origem usa
`DINTER/1`/`DINTER/2` (barra, numeral arábico) — a aposta anterior era
`DINTER 1`/`DINTER 2` (espaço), então o de-para nunca disparava e o
gráfico "Diretoria" mostrava "DINTER/1"/"DINTER/2" ao vivo. Corrigido em
`etl/ocorrencias/mapeamento_unidades.json`.

Extrator rodado com dado real completo: 35.866 ocorrências, 15.099 APH,
3.969 incêndio, 4.935 salvamento, 5.318 prevenção, 11.805 produtos
perigosos.

**3 bugs reais de UI encontrados navegando com dado real (não visíveis
antes, porque os módulos bloqueados só mostravam "Aguardando
credencial"):**
1. **`ModuloAph.jsx` — "Atendimentos a CVI"/"Divisão de entregas com
   vida" sem rótulo nenhum.** `cvi`/`entregueVivo` são booleanos, e o
   código usava o booleano cru como `label` do gráfico — React descarta
   `true`/`false` como filho de JSX (não renderiza nem como texto), então
   a categoria ficava literalmente invisível no eixo/legenda, só o número
   aparecia. Corrigido: "Com CVI confirmado" como rótulo fixo (o card só
   soma o caso truthy mesmo, sempre foi 1 categoria só) e "Sim"/"Não" para
   entregue vivo.
2. **`ModuloPerfilVitimas.jsx` — "Vítimas com deficiência" mostrando
   100% "Com deficiência".** Herdado do scaffold da manhã, que assumia
   `deficiencia` como booleano antes do schema real existir. Com
   `status_deficiencia` sendo categórico (`"Não"` é a maioria, 11.582 de
   15.882), o `? "Com deficiência" : "Sem deficiência"` tratava qualquer
   valor não-nulo — inclusive `"Não"` — como truthy. Corrigido para
   grupo categórico direto (Não/Não identificado/Sim), sem inventar um
   booleano que a fonte não tem.
3. **`ModuloAph.jsx`/`ModuloProdutosPerigosos.jsx` — KPI row com 4
   colunas e só 3 cards.** `grid-cols-2 sm:grid-cols-4` com 3 `KpiCard`
   deixava a 4ª célula vazia E espremia "Vítimas entregues com vida" a
   ponto de cortar o título (`scrollWidth` 172px > `clientWidth` 150px
   numa coluna de 184px, medido via DOM, não só "parece cortado" no
   screenshot). Corrigido para `sm:grid-cols-3` nos dois módulos.

Todos os outros cortes suspeitos verificados via screenshot/DOM
(`scrollWidth > clientWidth` em toda folha, não só visual) nas 9 abas —
nenhum outro achado. `npm run lint`/`npm run build` limpos.

**Pendente, sinalizado no relatório da sessão, não desta rodada:**
- Bundle de produção ~28MB (`ocorrencias_dashboard.json` real de ~30MB
  importado estático) — considerar lazy-load/fetch numa rodada futura.
- Fix de `max-w-md mx-auto` no card "Vítimas com deficiência"/"Divisão
  por gênero" — já aplicado nesta rodada junto com a implementação real
  dos dois cards.
- Mapa coroplético real da Geolocalização, cruzamento natureza×diretoria,
  série temporal por natureza, taxa de não-atendimento — sugestões
  levantadas, não implementadas (ver relatório).

### 2026-09-23 — Backend de autenticação via SGU e empacotamento Docker completo (worktree isolada, para revisão)

Pedido: preparar a troca do stub de `authClient.js` por autenticação real via
SGU e deixar o Docker pronto para o servidor do CBMPE (CapRover em
`caprover-01`). Trabalho feito numa worktree separada — nada commitado, fica
para o usuário revisar.

**O que foi implementado, e é tecnicamente inequívoco:**

- **`backend/`** — serviço Express novo e pequeno, seguindo a mesma
  arquitetura do `forms-bm` (projeto irmão): `config/sguClient.js` chama
  `SGU_URL/auth/sign_in` com `{username: cpf, password}`, igual ao
  `forms-bm/forms/backend/config/sguClient.js`, confirmado que a resposta de
  sucesso já traz o perfil (`data.name`, `data.email`) sem lookup separado.
  `POST /auth/login` valida CPF/senha, chama o SGU, emite um JWT próprio
  (`JWT_SECRET`, expira em 8h). `GET /auth/me` verifica esse JWT — permite
  `authClient.js` confirmar que a sessão local ainda é válida sem duplicar
  lógica de expiração no navegador.
- **`src/lib/authClient.js`** ganhou um terceiro caminho (os dois antigos —
  admin fixo e protótipo de níveis — continuam, sem alteração de
  comportamento): quando o usuário digitado é um CPF de 11 dígitos, a senha
  vai para `backend/`, nunca direto ao SGU pelo navegador (CORS e exposição
  da lógica de auth do lado cliente descartadas, como o pedido antecipava).
  Mesma assinatura de funções — `Login.jsx`, `AuthContext.jsx`,
  `Register.jsx`, `ForgotPassword.jsx`, `ResetPassword.jsx` não mudaram.
- **Regra de segurança seguida à risca**: o CPF nunca sai do escopo da
  função que autentica — não vai no JWT, não vai na resposta HTTP, não fica
  em `localStorage`. É a mesma regra já registrada na entrada de 2026-08-24
  abaixo ("mantém o CPF fora do DW: usado na consulta, descartado em
  seguida"), estendida aqui para o próprio backend de auth.
- **Docker completo**: `backend/Dockerfile` (multi-stage dev/production,
  usuário não-root, healthcheck, no padrão do `forms-bm/forms/backend/
  Dockerfile`), `backend/captain-definition` (segundo app no CapRover),
  `backend/.env.example`. `Dockerfile` da raiz ganhou `ARG`/`ENV` para
  `VITE_ADMIN_USUARIO`/`VITE_ADMIN_SENHA`/`VITE_AUTH_API_URL` (antes não
  existiam — o build Docker sempre caía no fallback `adm`/`adm`, mesmo que
  Vercel já configurasse essas vars via env de plataforma, não de build
  arg). `docker-compose.yml` ganhou o serviço `backend` (rede própria
  `dw-cbmpe`, `restart: unless-stopped`, `depends_on`). `.env.example` da
  raiz ganhou `VITE_AUTH_API_URL`.

**Sobre o mapeamento SGU → perfil/OME — a pergunta que o pedido antecipava
como provavelmente em aberto, e o que descobri ao investigar:**

Essa pergunta **já tinha decisão de rumo registrada** na entrada
**2026-08-24** abaixo ("Decisão sobre `resolverOmePorCpf()`"): preferir
CPF → `ovrsgp.tb_pess` → matrícula → DW em vez do campo `military` que o
próprio SGU devolve, porque cobre 99,9% e faz a OME sair da `dim_ome` do DW
(hierarquia do organograma e CPPA/ADIDOS já resolvidos), mantendo o CPF fora
de tudo que é persistido ou servido ao navegador. Não é uma decisão nova
minha — é a que já estava tomada, e o backend novo (`backend/services/
omeResolver.js`) está escrito pra seguir exatamente esse pipeline quando for
ligado.

**O que NÃO liguei, e por quê**: ao conferir o schema real (`etl/dw/ddl/
02_core_dimensoes.sql`, `03_core_fatos.sql`) descobri que a decisão de 2026-
08-24 é direcional, não uma consulta pronta — faltam duas coisas que só dá
pra confirmar contra o banco de verdade (que não tenho acesso nesta sessão):

1. `core.dim_militar` **não tem coluna de OME** — só cadastro fixo do
   militar (matrícula, nome, posto...). A OME mora em
   `core.fato_efetivo_diario`, 1 linha por militar **por dia**, com
   `sk_ome` referenciando `dim_ome`. Resolver "a OME de hoje" de um
   militar exige pegar o `sk_tempo` mais recente daquele `sk_militar` — e
   o próprio DDL documenta um caso especial (ADIDOS aponta `sk_ome` pro
   COMANDO GERAL, não pra DGP) que a consulta final precisa decidir se
   replica aqui.
2. Isso exige o backend abrir uma segunda conexão de banco em runtime
   (`DATABASE_URL_SGP` pra achar a matrícula, `DATABASE_URL_DW` pra achar
   a OME) a cada login — hoje essas strings só são usadas por scripts de
   ETL rodados manualmente, nunca por um serviço que fica no ar. Não achei
   isso arriscado por si só, mas é uma peça nova (mais uma dependência de
   rede/infra no caminho crítico do login) que preferi não introduzir sem
   confirmar as duas colunas acima direto no banco.

Em vez de adivinhar a query, deixei o seam pronto e documentado
(`backend/services/omeResolver.js`, com o pipeline inteiro escrito em
comentário) devolvendo sempre `{ matricula: null, ome: null }`. Efeito
prático, e deliberadamente seguro: **hoje, todo login por CPF autentica de
verdade contra o SGU, mas entra com `nivelAcesso` nulo** —
`calcularAcesso(null, ...)` em `accessControl.js` já trata isso como "sem
unidade liberada" (falha fechada), não acesso total. `role` fica sempre
`"nivel"` no login por SGU (nunca outro valor) porque é o único que
`useAcessoUsuario.js` trata como restrito — usar qualquer outro role teria
liberado acesso total por acidente.

**O que falta decidir, pra mim ligar o resto (não é só a SQL):**

1. **Rodar a query contra o banco real** pra confirmar a coluna de OME em
   `fato_efetivo_diario`/`dim_ome` e a regra de "vigência" (data mais
   recente? existe uma flag de "atual"?) — não tenho acesso a
   `DATABASE_URL_SGP`/`DATABASE_URL_DW` nesta sessão pra testar.
2. **`/adm` hoje atribui perfil por uma sigla digitada** (`AGGD`, `DGP`...).
   Pra um militar autenticado por CPF, a chave natural vira a matrícula
   (mesma lógica de todo o resto do DW, nunca CPF) — isso muda a tela
   `/adm` (passa a precisar de um campo "matrícula" em vez de aceitar
   qualquer sigla) e não fiz essa mudança, porque não foi pedida e mexe em
   uma tela usada hoje pelo protótipo de demonstração.
3. **UX de "autenticado mas sem perfil ainda"**: hoje esse usuário loga e
   vê um dashboard vazio (nenhuma sigla liberada), sem nenhuma mensagem
   explicando por quê. Se isso deve virar uma tela própria ("aguardando
   atribuição de acesso") é decisão de produto, não fiz.
4. Se a resposta for "ligar por matrícula é caro/arriscado demais pra cada
   login", a alternativa mais simples é o administrador atribuir o CPF
   (não a matrícula) direto em `/adm`, igual ao campo `cpf` que
   `unidadeDoUsuario()` já lê em `accessControl.js` hoje — mais simples de
   implementar, mas reintroduz CPF do lado do cliente (a lista de
   `ATRIBUICOES` em `localStorage`, visível a quem abrir o DevTools),
   exatamente o que a decisão de 2026-08-24 evitou. Precisa decisão
   explícita antes de eu escrever isso.

**Validação rodada nesta sessão** (detalhe pro usuário conferir): `npm run
build` limpo (bundle de 6,5 MB, aviso de chunk grande já existia antes,
não é desta mudança). `npm run lint` limpo — não cobre `src/lib/**` nem
`backend/` (já excluídos do `eslint.config.js` da raiz; não criei config
próprio pro backend pra não expandir escopo). `node --check` em todo
arquivo de `backend/`. Subi o backend localmente (`SGU_URL` apontando pra
um host inexistente, de propósito) e testei com `curl`: `GET /` → 200;
`POST /auth/login` sem campos → 400; com CPF/senha válidos mas SGU
inalcançável → **503** (tratado à parte, não vazava 500 genérico até eu
corrigir `sguClient.js`/`authService.js` nesta sessão); `GET /auth/me` sem
token → 401, com token assinado manualmente → 200 devolvendo o payload sem
CPF. **Não testei contra o SGU de verdade** (sem rede pra
`10.193.0.20`/intranet nesta sessão) nem `docker build`/`docker compose
config` — **Docker não está instalado neste ambiente** (`docker: command
not found`); os `Dockerfile`s seguem o padrão já validado no `forms-bm` mas
não foram construídos aqui.

### 2026-09-23 (quarta rodada) — CPF resolve OME de verdade: achado o bug do banco errado, pipeline implementado e validado

Pedido do usuário: implementar de vez a resolução CPF -> OME (estava com
`nivelAcesso` sempre nulo, ver rodada anterior). Ao investigar por que
`core.fato_efetivo_diario` "não existia" (relatado horas antes, mesmo dia),
achei o bug: **`DATABASE_URL_DW` em `.env.local` apontava pro banco
`postgres`** (o banco padrão do servidor `10.193.1.252:54301`, onde vivem
as tabelas ad hoc do Igor — `fin_autorizacao`, `inativos_metabase` etc., já
lidas por Efetivo/Financas) — **não pro banco `dw`**, onde
`carga_core.py` de fato carregou o schema `core` em 2026-08-24. Os dois
bancos coexistem no mesmo servidor com a mesma credencial. Os scripts de
`etl/dw/*.py` já tratam isso corretamente (derivam `/dw` a partir de
`DATABASE_URL_DW` trocando só o nome do banco, nunca leem `/postgres`
como se fosse o DW) — só a minha suposição anterior estava errada, não o
código. `backend/config/db.js` (novo) reproduz a mesma derivação em vez de
introduzir uma env var nova.

**Pipeline implementado e testado de ponta a ponta** (`backend/services/
omeResolver.js`, usando `pg` — dependência nova em `backend/package.json`):
CPF -> `ovrsgp.tb_pess` (SGP) -> matrícula -> `core.dim_militar` +
`core.fato_efetivo_diario` (linha mais recente POR MILITAR, não um
`sk_tempo` global) -> `core.dim_ome.sigla`. Testado com um par CPF/matrícula
real do próprio banco (nunca logado nem impresso o CPF): resolveu `6º GB`
corretamente. Cobertura: 2.658 de 2.658 militares em `dim_militar` resolvem
OME (100%) — mas só 57,7% das matrículas do SGP inteiro (4.598) batem com
`dim_militar`, porque `dim_militar` é só o efetivo ATIVO (fonte Peculio) —
gente inativa/licenciada no SGP não resolve, o que é o comportamento
correto (falha fechada), não um bug.

**Achado que ainda não foi resolvido**: `core.fato_efetivo_diario` foi
carregado pela última vez em **2026-08-26** — quase 1 mês desatualizado.
Rodar `etl/dw/carga_core.py` de novo traria isso pro dia. Não rodei nesta
sessão: descobri, checando o script, que ele faz PARSE DIRETO de
`const ARVORE = {...}` em `src/data/organograma.js` via regex (e falha alto
se não achar) — e a worktree do editor de organograma (ainda não mesclada
nesta sessão) troca exatamente essa constante por `NODES_PADRAO` +
`montarOrganograma()`. Rodar `carga_core.py` com essa mudança mesclada
quebraria o parse. Antes de mesclar o editor de organograma OU rodar a
carga de novo, decidir: (a) manter um `const ARVORE = {...}` literal
derivado de `NODES_PADRAO` só para o parser do Python continuar
funcionando, ou (b) trocar `carga_core.py` para ler
`backend/data/organograma.json` (o novo armazenamento do editor) direto
como JSON em vez de regex sobre um arquivo JS — a opção (b) é mais robusta
e faz o DW refletir edições do admin automaticamente, mas é mudança no
próprio pipeline do DW, não decidi sozinho ainda.

**Ainda não implementado**: o mapeamento matrícula/OME resolvida -> PERFIL
de acesso em `accessControl.js`. Hoje `ATRIBUICOES` é indexado por um
"usuarioChave" de texto livre escolhido no `/adm` (ex. "DGO", "4GB") — não
por matrícula. Pra um login CPF real ganhar algum perfil, `/adm` precisa
passar a cadastrar atribuições por matrícula. Falta decidir o
comportamento PADRÃO de um militar real que ainda não foi cadastrado no
`/adm` — pergunta feita ao usuário na mesma rodada, ver resposta abaixo
quando houver.

**Resposta do usuário às duas perguntas em aberto acima:**

1. *Um militar loga pela primeira vez com CPF real, sem atribuição em
   `/adm` — o que ele deve ver?* "Nada, até o admin cadastrar (Recomendado)"
   — confirma o comportamento que `calcularAcesso(null/matrícula-sem-
   atribuição, ...)` já tinha por padrão (falha fechada): nenhuma unidade
   liberada, sem tela própria de "aguardando atribuição". Não precisou de
   código novo, só a confirmação de que o padrão já estava certo.
2. *Como reconciliar o editor de organograma (worktree separada, ainda não
   mesclada) com `carga_core.py`, que faz parse por regex de `const ARVORE`
   em `src/data/organograma.js`?* "Trocar `carga_core.py` pra ler o JSON do
   backend (Recomendado)" — feito (ver entrada seguinte).

### 2026-09-23 (quinta rodada) — Organograma editável mesclado, CPF liga direto a matrícula em `/adm`, e Atividades Específicas reagrupadas por família

**Organograma editável pelo administrador** (worktree isolada, mesclada
nesta rodada): `backend/data/organograma.json` passa a ser a fonte de
verdade da hierarquia (sigla/nível/pai/`ordem`), servida por
`GET /organograma` (público — o app inteiro precisa da árvore) e editável
por `POST/PUT/DELETE /organograma` (token de admin). `src/data/
organograma.js` trocou o antigo `ARVORE` estático por `NODES_PADRAO`
(mesmo conteúdo, agora só o FALLBACK) + `montarOrganograma(nodes)`, que
reconstrói unidades/indicadores/dashboards/alertas a partir de qualquer
árvore — visualização, controle de acesso e Atividades Específicas ficam
consistentes automaticamente quando o admin move/renomeia/cria uma OME.
Níveis hierárquicos (1 Comando Geral, 2 Subcomando Geral, 3 Estado Maior —
reservado, ainda sem unidade —, 4 Diretoria Geral, 5 Diretoria
Especialista, 6 OME Subordinada) explícitos em cada nó — deixou de ser "1 +
profundidade na árvore", porque GCG/CI/CPO/AECI/CCS/GSG/AJG/CPP são filhas
DIRETAS do Comando/Subcomando (profundidade 2) mas continuam nível 6
(gabinetes/comissões, confirmado pelo usuário), aparecendo no organograma
AO LADO do balão do pai, não abaixo.

Reconciliado com `etl/dw/carga_core.py` conforme a decisão do usuário
(ver acima): `arvore_do_organograma()` passou a ler
`backend/data/organograma.json` direto como JSON em vez de regex sobre
`organograma.js` — mais robusto, e uma edição do admin passa a valer
automaticamente na próxima carga do DW, sem precisar sincronizar os dois
lados manualmente.

**CPF resolve matrícula direto no formulário de `/adm`**: novo endpoint
`POST /pessoas/resolver-cpf` (admin-protegido, CPF só no corpo da
requisição, nunca em URL/log) chama o pipeline CPF → matrícula → OME da
rodada anterior e devolve `{matricula, ome, adido}`. `Administracao.jsx`
ganhou um botão "Resolver" que preenche a matrícula sozinho a partir do
CPF digitado — o admin não precisa mais saber a matrícula de cor pra
cadastrar alguém em `/adm`.

**Atividades Específicas reagrupadas por família** (`src/data/
atividadesEspecificas.js`, `src/pages/atividades/AtividadesDashboard.jsx`):
dashboards da mesma família (4 módulos de Vacinação, 9 de Ocorrências)
passam a ser UM balão/tile só na página de Atividades Específicas de uma
OME, não um módulo por dashboard misturado com os demais — clicar abre o
primeiro módulo (Visão Geral) com links pros módulos irmãos no topo.
Escopo por família:
- **Vacinação**: só aparece em unidades da DAS.
- **Mapa de Força / Ocorrências**: só em DGO e subordinadas — **exceto
  DIESP**, que não participa de Ocorrências apesar de ser subordinada da
  DGO (regra explícita do usuário).
- **Sem herança pro superior**: um painel que aparece na Atividades
  Específicas de uma OME subordinada NÃO aparece na do superior direto —
  só na página da subordinada onde o dado de fato existe. O superior
  continua navegando pra lá normalmente (visitando a OME subordinada
  direto), a regra é só sobre o que fica LISTADO na página dele, não sobre
  permissão de acesso.

Também nesta rodada: botão "Metabase — Faça seus próprios painéis" ao lado
do alternador de tema (link para `https://estatistica.bombeiros.pe.gov.br/`,
colapsa pra só ícone no mobile).

### 2026-09-23 (sexta rodada) — Organograma: arrastar-e-soltar com modo de edição, atribuições de perfil migradas pro backend, e três ajustes de layout

**Atribuições de perfil migradas de `localStorage` pro backend** — o
problema que isso resolve: `/adm` atribuía perfil (`ADMINISTRADOR`,
`TITULAR`...) só no `localStorage` do navegador de quem atribuía. Um
usuário SGU real, logando no PRÓPRIO navegador dele, nunca veria essa
atribuição — estruturalmente impossível de um administrador atribuído
conseguir fazer qualquer alteração, porque o backend não tinha visibilidade
nenhuma de quem tinha qual perfil. Corrigido com o mesmo padrão do
organograma editável: `backend/data/atribuicoes.json` +
`atribuicoesService.js` (`listar`/`definir`/`remover`, e
`perfilConcedeAdmin(matricula)` — consulta o arquivo a cada chamada, sem
cache, então um perfil revogado em `/adm` vale na próxima requisição, não
só no próximo login) + rotas `GET/PUT/DELETE /atribuicoes` (GET público,
mesma lógica do organograma). `backend/middlewares/requireAdmin.js` agora
libera as rotas de escrita (organograma E atribuições) tanto pro login
administrativo fixo quanto pra **qualquer usuário SGU real (token com
`matricula`) cujo próprio perfil seja `ADMINISTRADOR`** — validado ponta a
ponta contra o backend local, forjando um token de um usuário
`ADMINISTRADOR` e um `TITULAR`: o primeiro passou (200 no
`PUT /organograma/:id`), o segundo foi barrado (403). `Administracao.jsx`
trocou `lerAtribuicoes()`/`salvarAtribuicoes()` (localStorage) pelas
chamadas ao backend + `recarregar()` do `CbmpeProvider`, mesmo padrão já
usado em `OrganogramaEditor.jsx`.

**Por que o usuário `AGGD@GSG` (perfil ADMINISTRADOR) não tem o botão de
edição habilitado, mesmo depois dessa migração**: `AGGD` é um login do
protótipo de demonstração de `accessControl.js` (usuário + senha
`USUARIO@GSG`, sem CPF, sem chamada nenhuma ao backend — ver `authClient.js`
caminho 2). Esse caminho de login nunca teve, e continua sem ter, um token
de backend (`user.token` fica `undefined`) — não existe credencial real pro
backend validar, então não há como emitir um token pra ele mesmo que o
perfil seja `ADMINISTRADOR`. **Só um login por CPF real via SGU (caminho 3)
tem token de backend**, e é só esse caminho que `requireAdmin.js` consegue
reconhecer. Não é bug: é a fronteira entre "protótipo de demonstração,
sempre foi client-side" e "usuário real, autenticado de verdade" — estender
acesso de escrita de servidor a um login sem credencial real seria abrir
uma porta sem fechadura. Pra testar o fluxo de administrador atribuído de
verdade, precisa de um CPF real autenticando contra o SGU (ainda não testado
nesta sessão — falta a URL real do SGU, ver pendências).

**Botão de edição do organograma** (`src/pages/Organograma.jsx`): o
arrastar-e-soltar (implementado na rodada anterior, sempre ligado pra quem
tinha token) passou a ficar atrás de um botão explícito — ícone de lápis no
canto superior direito do card do organograma, visível só pra quem tem
token de escrita. Ligar mostra o aviso de modo de edição e habilita os
cards arrastáveis; desligar mostra um balão resumindo e confirmando tudo
que foi movido/reordenado na sessão (cada arrastar já persiste na hora —
o balão é só o resumo de confirmação, não um lote pendente de salvar).

**Três ajustes de layout, todos verificados no navegador via
`getBoundingClientRect`/DOM, não só visualmente:**
1. Unidades nível 6 diretamente subordinadas ao Comando/Subcomando (GCG,
   CI, CPO, AECI, CCS / GSG, AJG, CPP) numa ÚNICA linha ao lado do balão
   (antes quebravam em várias linhas/colunas num grid 2 colunas) — `flex`
   sem quebra a partir do breakpoint `lg`, continua podendo quebrar linha
   no mobile (senão ficaria ilegível, estourando pros dois lados da tela).
2. Balões de COMANDO GERAL/SUBCOMANDO GERAL centralizados de verdade na
   página, com as subordinadas deslocando só pra direita — bug real de CSS
   Grid: uma coluna `1fr` cresce até o tamanho MÍNIMO do conteúdo antes de
   distribuir o espaço livre, então o painel largo de subordinadas fazia a
   coluna vazia do outro lado encolher pra 0, descentralizando o balão.
   Corrigido com `min-width: 0` na coluna das subordinadas, forçando as
   duas colunas `1fr` a ficarem realmente iguais (confirmado:
   `outerCenter === starCenter`, ambos 902.5px).
3. **DPLAG "afastada", como se tivesse uma linha invisível acima** — bug
   real, achado ao investigar o relato do usuário: a ordenação por `ordem`
   (rodada anterior) fazia DPLAG (sem subordinada própria, "folha") virar
   um pacote de 1 item SOZINHO no fim da lista de colunas da DGA (porque
   vem depois de DLOG/DEIP, que têm subordinada, na ordem de exibição);
   numa grade de 4 colunas, o 5º item quebra linha sozinho, alinhado à
   esquerda embaixo dos outros 4 — exatamente o efeito relatado. Corrigido
   voltando a agrupar TODAS as folhas de uma Diretoria Geral num bloco só
   (mesma regra de antes do bug), com as que TÊM subordinada vindo primeiro
   — funciona pros dois casos: a DGO só tem uma folha (DIESP), que cai
   naturalmente por último (mesma ordem pedida: DIM, DINTER I, DINTER II,
   DIESP); a DGA tem sete, que agora ficam empacotadas juntas sem nenhuma
   sobrando sozinha.

**Também nesta rodada**: removido o campo de CPF da tela de usuários em
`Administracao.jsx` — nunca esteve de fato ligado a nada
(`resolverOmePorCpf()` sempre foi um stub que devolve `null`) e, com
atribuições agora persistidas em arquivo no servidor, mantê-lo teria
introduzido CPF armazenado fora do navegador do admin, quebrando a
disciplina de nunca persistir CPF mantida desde 2026-08-24.

**Commit e push**: tudo desta rodada e da rodada anterior (organograma
editável, CPF em `/adm`, Atividades Específicas por família — que ainda não
tinham sido commitados) foram commitados e enviados a `origin/main`.

**Em aberto, sem mudança desde a rodada anterior:**
- SGU real ainda não testado (sem `SGU_URL` real — nenhuma URL real existe
  em nenhum dos dois repositórios, só placeholder vazio de propósito).
  Precisa que o usuário informe a URL real, em chat, só uso em sessão.
- Docker segue não encontrado nesta máquina, apesar do usuário ter dito que
  está instalado — sem confirmação do usuário sobre isso, `docker build`/
  `docker compose config` continuam não testados aqui.
- `core.fato_efetivo_diario` segue com a carga de 2026-08-26 (quase 1 mês
  desatualizada) — rodar `etl/dw/carga_core.py` de novo (idempotente,
  agora já lendo `backend/data/organograma.json`) deixaria em dia; não
  rodei, por não ter sido pedido nesta rodada.

### 2026-09-25 — Login só pelo SGU, nome/CPF no /adm, Estado-Maior "em construção" e levantamento de ingestão

**Autenticação.** Removidos o administrador fixo (`adm`/`adm`, `VITE_ADMIN_*`
no front e `ADMIN_*`/`/auth/admin-login` no backend) e os usuários de
demonstração (`SIGLA@GSG`, `ATRIBUICOES_PADRAO`). Login só por CPF via SGU;
administrador = matrícula com perfil `ADMINISTRADOR` em
`backend/data/atribuicoes.json`. Sem backend, as atribuições caem em vazio
(falha fechada), não mais em usuários de demonstração. Também saíram do
arquivo de atribuições as três chaves de demonstração que sobravam (`DGO`,
`DINTER2`, `4GB`).

**/adm > Usuários.** Cada linha mostra nome e CPF (consulta ao vivo no SGP,
rota admin `POST /pessoas/identificar`, nada persistido — exceção registrada
em `DW_GOVERNANCA.md`), e o formulário mostra o nome da matrícula encontrada
pelo CPF. O modal tinha dois defeitos: `max-h-[85vh]` virava ~106% da janela
por causa do `zoom: 1.25` do `html` (em Chrome o `vh` é multiplicado pelo
zoom — medido: 816px de altura numa janela de 768px), e o corpo crescia ao
expandir um perfil. Agora o teto divide por `--app-zoom` e a altura do corpo
fica travada no tamanho com que o modal abre.

**Estado-Maior Geral.** Ele e 1º/2º/3º EMG (e qualquer unidade criada abaixo
dele) viram "Em construção": sem chefe, sem indicador, sem painel, métricas
zeradas. Achado no caminho: como não tinham entrada em `METRICAS`, caíam no
`METRICAS_PADRAO` fictício e somavam 80 militares inventados no total do
Subcomando Geral.

**Ingestão.** Levantamento completo em [`DW_INGESTAO.md`](DW_INGESTAO.md):
quatro caminhos de chegada de dado (JSON no bundle, `public/`, backend ao
vivo, hardcoded), só o Mapa de Força e a resolução de OME leem o DW. Medido
no banco: só o Pecúlio recarrega sozinho — SGP, escala, mapa de força,
Frota, reserva e Finanças pararam em 2026-08-24 — e existe um único usuário,
superusuário. Diretrizes D1–D10 e plano de conexão em 6 etapas no mesmo
documento; perguntas em aberto na seção 6 dele.

**Mesma sessão, depois das respostas do usuário** (API = backend Node;
estado do app no banco; chefes via QOD/Lotação; tabelas do banco `postgres`
vêm de planilhas do Igor): criado o schema `app` no banco `dw`
(`etl/dw/ddl/06_app.sql`), backend passou a gravar organograma e perfis lá
(semente importada e conferida idêntica), `carga_core.py` lê a hierarquia da
tabela. Reconciliação do Efetivo DW × app e próximos passos em
[`DW_INGESTAO.md`](DW_INGESTAO.md) seções 6–8.

### 2026-09-29 — DW v1: fdw para as fontes internas, papéis, planilhas do Windmill no `raw`

Pedido do usuário: organizar para que todo dado esteja no `dw` e o sistema
se conecte a ele, olhando fonte a fonte. Desenho completo em
[`DW_INGESTAO.md`](DW_INGESTAO.md) seção 9. O que foi feito e medido:

- **Servidor `10.193.1.252:54301`: confirmado como o DW, com 4 bancos.**
  `dw` (nosso), `postgres` (Metabase), `dw_dim` e `dw_diesp`, estes dois
  achados agora e **do próprio usuário** (seção 3 do `DW_INGESTAO.md`).
- **Fontes Postgres internas via `postgres_fdw`** (decisão do usuário):
  `08_fdw.sql` (procedimento `stg.carregar_raw`), `configurar_fdw.py`
  (servidores, mappings, foreign tables sem colunas de CPF) e
  `etl/windmill/dw/raw_fdw.py` (gatilho). SGP, escala, mapa de força e Frota
  foram recarregados, pela primeira vez desde 08-24. O mapa de força levou
  **19 s** para 1,9 milhão de linhas.
- **Um ajuste no `carga_core.py`**: `reference_date` da Frota agora chega como
  `date`, e não mais como texto. O regex passou a rodar em `::text`, e o
  descarte das 3 datas com ano impossível continua igual.
  `carga_core.py` foi rodado de novo, sem erro.
- **`validar.py` com expectativas dinâmicas.** As 10 "falhas" eram o total
  de agosto (2658) cravado no código, contra 2655 de hoje. Agora o total vem
  da planilha em `raw` e o resto são invariantes. Resultado: 19/19 ok.
- **Papéis D7**: `07_papeis.sql` cria os papéis-grupo sem login.
  `app_reader` só enxerga `marts` + `app`. Para isso nasceu
  `marts.ome_atual_militar`, e o `backend/services/omeResolver.js` deixou de
  ler `core` (0 divergências contra a consulta antiga).
- **Scripts do Windmill do usuário lidos** (só leitura, via API): as URLs de
  CIM, inativos, escolaridade e Material Operacional foram reaproveitadas em
  `raw_planilhas.py`. Carregados `raw_cim`, `raw_inativos`,
  `raw_escolaridade` e `raw_materiais` (3 de 5: CP e natureza estão
  despublicadas). O `raw_planilhas.py` agora isola a falha de uma planilha.
  Dois jobs do usuário estão falhando e dois têm chave de service account no
  código. Detalhe na seção 9 do `DW_INGESTAO.md`.
- **Efetivo e Neon** (nota do usuário): o Neon tem o efetivo mais atual
  porque o "Pecúlio Metabase V1" roda de hora em hora a partir da planilha.
  O DW lê a **mesma planilha** direto; com a mesma agenda, tem o mesmo
  frescor. `postgres.public.peculio_metabase_v1` não foi tocada.
- Credenciais do Windmill: só no `.env.local` (gitignored).
- Local: `.claude/launch.json` ganhou `dw-cbmpe-backend` (porta 4000).

**Mesma data, segunda parte** (o usuário autorizou publicar, commitar e
aposentar o `dw_dim`):
- **`dw_dim` aposentado sem apagar nada**: renomeado para
  `dw_dim_aposentado_20260929`, com `CONNECT` revogado. Antes, as tabelas úteis
  e sem dado pessoal foram para `dw.raw_ref`. Achado no caminho: o
  `carga_core.py` tirava as coordenadas das OMEs do `dw_dim`, por meio do
  `casar_coordenadas_ome.py` importado do disco. Agora a cadeia é
  `raw_ref` → `stg.coordenada_ome` → `core`, com resultado idêntico.
- **`carga_core.py` só lê o banco `dw`**. Não lê mais arquivo local, nem o
  SGP direto, nem o `dw_dim`. É pré-requisito para rodar no Windmill.
- **`validar.py` checa as cargas das últimas 24h (D8)**, e o
  `raw_planilhas.py` registra falha de download em `stg.carga`. As planilhas
  CP e natureza (HTTP 410) ficam "pausadas".
- **Publicador `etl/windmill/publicar_dw.py`**: cria a pasta `f/dw`, as
  variáveis secretas, os 6 scripts (publicados a partir do repositório),
  o flow `dw_diario` e a agenda das 05:30. **Não foi executado**: o
  controle de permissões da sessão bloqueou. Fica para o usuário rodar.

**Mesma data, terceira parte:**
- `publicar_dw.py` passou a ler o `.env.local` sozinho. A primeira tentativa
  do usuário falhou com `KeyError: 'WINDMILL_URL'`.
- **Material Operacional e Controle do tempo de serviço em standby**
  (decisão do usuário): as 5 planilhas de materiais ficam "pausadas" no
  `raw_planilhas.py`, e os dois scripts do usuário no Windmill não foram
  tocados.
- **O `DROP` do `dw_dim` não foi feito pelo Claude**: apagar dado
  definitivamente é ação que ele não executa. O comando foi entregue para o
  usuário rodar. O banco segue renomeado e sem acesso.
- **O "total" de Finanças do app (R$ 2.310.957,65) está desatualizado.** É a
  soma de `financas.json` (card "Finanças" do organograma): valor **pago**,
  só EMPENHADO, SFI Ordinário inteiro + Autorização e Carnaval com
  enquadramento SI. Foi gerado em **2026-08-07** a partir do Neon. Com a
  mesma regra, as tabelas `public.fin_*` dão hoje **R$ 2.596.953,65** (SFI
  1.165.888,00 + Autorização SI 1.353.687,65 + Carnaval SI 77.378,00). Não é
  o mesmo número do dashboard DF: ele usa valor liquidado no SFI e valor
  empenhado nos demais cards. Resolve quando Finanças for migrada para
  `marts` (etapa 3.4).

### 2026-09-29 (quarta parte) — Flow no ar, usuários de banco, Vacinação/ROE/QOD no DW, app lendo o DW

Pedido: "execute todos os próximos passos; o que for necessário confirmar,
confirme". Confirmado com o usuário antes de executar:
- **App:** fica na Vercel por ora → migrar com fallback, já pronto para o
  CapRover.
- **Usuários de banco:** criar, com senhas só no `.env.local` e no Windmill.
- **Vacinação:** tudo, sem CPF.
- **ROE:** só as views do painel, sem dado pessoal de cidadão.
- **Finanças:** migrar para o DW.

**O que o primeiro flow no Windmill revelou:** as cargas `raw` faziam
`DROP TABLE`, e o Postgres recusava porque o `carga_core.py` cria views em
`stg` sobre a raw. Agora é `TRUNCATE` quando a estrutura não muda, e
`DROP ... CASCADE` só quando muda (as views voltam no passo do core). Vale
para os três carregadores.

**Testar como `windmill_etl` antes de publicar pegou mais três problemas:**
- `CREATE SCHEMA IF NOT EXISTS` exige permissão mesmo quando o schema existe.
- O SGP não pede senha, e o fdw recusa isso para quem não é superusuário
  (`password_required 'false'` no mapping de `etl_writer`).
- Objetos com dono diferente conforme quem rodou a carga. Agora toda carga
  conecta com `role=etl_writer`, e `etl_writer` é dono de `raw_*`, `stg` e
  `core` (`07_papeis.sql`).

**Resultado:** o flow completo rodou no Windmill como `windmill_etl` em 224s,
tudo ok, com o validador passando. O backend local roda como `app_backend`
e é negado em `core`, `raw` e `stg`.

**Novo no DW:**
- `raw_vacina` e `raw_roe` via fdw.
- `raw_qod` (8 abas do QOD publicado).
- `core.fato_financeiro`: os 3 blocos da aba "Banco de Dados - NÃO MEXER",
  por posição, com o cabeçalho conferido.
- `stg.de_para_destino_financas`: o antigo `mapeamento_unidades.json`.
- De-para `sistema = 'organograma'`.
- `marts.efetivo_organograma`, `frota_organograma`, `financas_organograma`,
  `financas_destino_sem_mapeamento` e `carga_status`.

**App:** `GET /dados/metricas` no backend e `aplicarMetricasDw` no front
(`DW_INGESTAO.md` seção 10). Testado com uma sessão de teste local: o Comando
Geral saiu com 2.654 militares, 771 viaturas e R$ 2.596.953,65 do DW.

### 2026-09-29 (quinta parte) — QOD, rotas nominais, painéis e build interno

Pedido: "siga com os passos 1, 2, 3 e 4, continuamente". Detalhe e tabela de
rotas em [`DW_INGESTAO.md`](DW_INGESTAO.md) seção 11.

**Confirmado com o usuário:**
- O previsto passa a ser o número de vagas FUNCIONAL da FUNCOES_DPLAG. Com
  isso, 2º GB e 6º GB mudam.
- A regra dos chefes segue a proposta.

**1. QOD:**
- `core.qod_vaga`, `qod_funcao` e `qod_ocupacao` (com
  `etl/dw/ddl/11_qod.sql`).
- `marts.previsto_organograma` (5.412 vagas em 43 unidades).
- `marts.chefe_organograma` (43 titulares, 2 vagos), que substitui a tabela
  `OFICIAIS` mantida à mão.

**2. Nominais:**
- `marts.efetivo_nominal` e `lotacao_militar` (`12_nominal.sql`).
- `acessoService.js`, que calcula no servidor o que cada perfil pode ver.
- `/dados/efetivo` e `/dados/lotacao`. No front, `src/data/efetivoLista.js`
  e `lotacaoFuncao.js` trocam para o DW, e os índices pré-calculados viraram
  cálculo sob demanda.
- Testado no navegador com o perfil DF: a tabela de Efetivo mostrou só os 18
  militares da DF, vindos do DW.

**3. Painéis:**
- `13_paineis.sql`, com as regras de limpeza dos extratores em funções
  `stg` (`SECURITY DEFINER` onde leem tabela).
- `/dados/painel/*` e `usePainelDw`.

**4. Build interno:** `VITE_APP_INTERNO` (bundle de 27 MB → 3,9 MB, sem
AGGD).

**Windmill:** flow republicado e rodado com sucesso, com o QOD e a
`ficha_financ` carregados pelo `windmill_etl`.

### 2026-10-01 — Titular pelo Pecúlio, regra de indisponível, mocks removidos, regras do Mapa de Força

Decisões do usuário (a Vercel deixa de ser restrição: o app vai para a VM
interna, então não se mantém JSON no bundle por causa dela):

- **Fonte da verdade do titular e da matrícula é o Pecúlio.** Titular da unidade
  = o militar mais antigo da OME na planilha (`stg.peculio.ordem`). Conferido:
  bate com a marca `Titular` da OBS em **45 de 45** OMEs (só `ADIDO` não tem
  titular, e não é unidade). ABMG é o Maj JOÃO PAULO (o QOD dizia "Vago") e o
  Subcomandante Geral é o Cel CURVÊLO (a matrícula do QOD diverge). `CPP` e `DGA`
  não têm OME no Pecúlio e saem como vagas. `marts.chefe_organograma`
  (`11_qod.sql`) foi reescrita; o QOD só empresta o nome da função.
- **Agregado** (marca `Ag` na OBS, 19 pessoas, todas com OME) soma no efetivo
  **indisponível** da OME da coluna OME; os 6 com OME `ADIDO` ficam na OME
  fantasma ADIDOS. **Regra de indisponível:** adido, ou afastado (LTS/LM), ou
  LTIP, ou LE, ou agregado; readaptado sozinho continua disponível. Está em
  `ehIndisponivel()` (`src/lib/efetivoDashboard.js`) e nas colunas `agregado` e
  `indisponivel` de `marts.efetivo_nominal` (`12_nominal.sql`). Dos 19 agregados,
  18 já eram indisponíveis; só o Subten DOS SANTOS (GBS, cargo eletivo) entra.
- **Painel 09 (Intenção de Movimentação):** o SQL do Metabase das duas
  agregações inferidas chegou. "Distribuição das solicitações" é o **top 10 de
  OMEs pelas opções 1, 2 e 3** (soma das três), e não por motivo. "Origem das
  solicitações" é a contagem por `ome_atual`. **Ainda não reimplementadas.**
- **Atividades Específicas e Materiais:** removido o número fictício (`acoes` e
  `materiaisPct`) do `organograma.js`. Os dois indicadores seguem como "Em
  construção", sem valor, série nem tendência. Atividades Específicas só mostra
  as famílias com dado real (Mapa de Força, Vacinação, Ocorrências). **Material
  Operacional está descontinuado:** outro sistema, do Igor, vai substituí-lo.
- **Mapa de Força:**
  - o DW deve guardar só os **últimos 30 dias**; quem precisar de mais vai ao
    sistema próprio do Mapa de Força (**ainda não aplicado**: ver pergunta sobre
    o histórico de emprego de viatura);
  - coordenadas sem posto próprio: DGO, CAT/RMR e DIESP usam o QCG; CAT/SE usa o
    4º GB; CAT/AG e DINTER I usam o 2º GB; **todos os postos do GBMar usam a sede
    do GBMar até o usuário informar os postos** (regra em
    `conferir_coordenadas.py`, `REGRA_COORDENADA_POR_OME`);
  - SBFN (Fernando de Noronha) é a seção `SBFN/GBI` do QOD;
  - postos `SEDE` lançados por OME que não é a dona são viaturas de uma OME
    ativadas no quartel de outra (a AR do GBAPH ativa no GBS): o efetivo e o
    lançamento são da OME de origem, o local é o do quartel;
  - na DINTER II, os postos "3º GB", "4º GB", "5º GB" e "9º GB" valem como SEDE
    do GB indicado;
  - o de-para posto → seção usa o **QOD** como fonte da verdade
    (`etl/mapa_forca/de_para_posto_qod.csv`, a partir da aba `ID_ATUALIZADO`);
  - a lista dos 44 postos sem coordenada própria está em
    `etl/mapa_forca/postos_sem_coordenada.csv`.
- **QOD:** o link publicado continua no ar (HTTP 200, xlsx, as 8 abas). A aba
  `QOD_FUNCOES` ainda diz AGOSTO; a de setembro é a `ID_ATUALIZADO`, que corrige,
  por exemplo, a 2ª SB do 6º GB (Bom Conselho), que em agosto vinha rotulada
  como a 1ª SB (Garanhuns). O `carga_core.py` ainda lê `QOD_FUNCOES`.

**Não aplicado no banco:** os DDL de `11_qod.sql` e `12_nominal.sql` foram
editados, mas o controle de permissões da sessão bloqueou aplicá-los no `dw`.
Ficam para o usuário autorizar ou rodar.

**Mesma data, segunda parte:**
- DDL aplicado como `datawarehouse-user` (autorizado pelo usuário): `marts.chefe_organograma`
  e `marts.efetivo_nominal` reescritas, e o dono das duas passou a `etl_writer`
  (como `etl_writer` não era possível trocar uma view de superusuário). Conferido como
  `app_reader` e `bi_reader`: 46 chefes, 267 indisponíveis, 19 agregados; `bi_reader`
  segue sem acesso ao nominal. **A CPP repete o titular da CPO (Maj FRANÇA)**; **a
  DGA aparece "Em construção" no card do organograma**, sem "Cel XXXX" nem "Vago".
- QOD: a planilha **QOD CONFERÊNCIA** (link publicado) é o link fixo da DPlaG e da
  CPPA. O QOD formatado de setembro (`1-teebSQ…`) traz o efetivo fixado por lei
  (5.249, LC 527/2023) e a distribuição por posto/graduação e por seção. Cruzando
  as duas, o previsto por unidade bate, exceto: 2º GB (671 × 485), 6º GB (201 × 232)
  e 1 a 4 vagas em GCG, GSG, 3º GB, DGP, CPPA e DPlaG (29 × 25). No total, as
  funções FUNCIONAIS do DW somam 5.412 contra 5.249 fixados (163 a mais, 133 delas
  em Sd, Cb e 3º Sgt). O quadro "GERAL 001" do arquivo novo ainda traz "JULHO 2026".

**Mesma data, terceira parte — relatórios, DF e quadros do QOD:**
- **Relatórios para apresentar** (em `docs/relatorios/`, com os anexos .xlsx):
  `Relatorio_QOD_divergencias.docx` (DPlaG e CPPA) e `Relatorio_DF_apontamentos.docx`
  (Diretoria de Finanças). São gerados por `etl/dw/auditar_qod.py`,
  `etl/financas/auditar_planilha.py` e `docs/relatorios/gerar_relatorios.py`.
  Nada foi corrigido: só apontado.
- **DF (Finanças), tudo no DW; sem JSON.** Regra do usuário: o sistema mostra os dados
  como estão; só se trata a **grafia** do tipo de gasto (caixa, espaço, hífen, "Globa",
  "Miliar") e do mês (palavras extras, MAIO/MAI, data do Carnaval gravada como número),
  em `tratar_grafia_financas()` (`carga_core.py`); o original fica em
  `ficha_financ_original` e `mes_original`. Colunas novas em `core.fato_financeiro`
  (`oficio`, `item`, `empenho`, `mes_rotulo`, `mes_ordem`), `stg.financas_destino` e a
  view `marts.painel_df_lancamento` (sem SEI, descrição nem observação, que trazem nome
  de falecido). Dashboard DF: módulos mantidos; **"Despesas Diversas" virou "Diárias"** (sem o
  gráfico de Auxílio Funeral) e nasceu a aba **"Despesas Gerais"**, com filtros por OME,
  Enquadramento, Situação e Mês. Removidos `financas.json`, `financas_dashboard.json`,
  `extract_financas.py` e `extract_dashboard_df.py`.
  `Plan1` é ignorada; "Banco de Dados - NÃO MEXER" é a consolidação das outras abas.
- **Quadros do QOD (previsto).** Decisão do usuário: nomenclatura e ocupantes vêm da
  QOD CONFERÊNCIA (QOD_CONSOLIDADA); a distribuição por OME/seção vem da planilha de
  quadros de setembro. Implementado o **previsto por unidade a partir do GERAL 001**
  (`raw_qod_quadros`, `core.qod_quadro_unidade`, `marts.previsto_quadro`, que o backend
  passou a ler). O schema `raw_qod_quadros` precisou de superusuário (o `etl_writer` não
  tem CREATE no banco) e foi criado na quarta parte. Nomenclatura das funções a partir da
  QOD_CONSOLIDADA: **não feita** (ver "Em aberto" no fim).

### 2026-10-01 (quarta parte) — LOB Nova no organograma; ID_ATUALIZADO; quadros do QOD no DW

- **ID_ATUALIZADO é a aba com o ID fixo das funções** (usuário). O `carga_core.py` passou
  a ler `raw_qod.id_atualizado` (e não mais `qod_funcoes`): 1.855 funções, 2.761 das 2.772
  ocupações casam com uma função (11 códigos órfãos na QOD_CONSOLIDADA).
- **Quadros do QOD no DW.** Schema `raw_qod_quadros` criado (superusuário, autorizado),
  planilha de quadros carregada, `core.qod_quadro_unidade` com 46 quadros e **previsto
  total 5.249** (o efetivo fixado). O backend lê `marts.previsto_quadro` (com
  fallback às vagas da DPlaG se a tabela estiver vazia). Diferem das vagas da DPlaG:
  2º GB 485 (671), 6º GB 232 (201), 3º GB 305 (306), DGP 62 (65), DPLAG 25 (29).
  Fonte `qod_quadros` publicada no Windmill.
- **LOB Atual/Nova.** Seletor no canto superior direito do organograma, só para
  Administrador, Comandante e Subcomandante Geral (e o login local AGGD); default Atual;
  guardado no navegador; quem não tem o direito volta sozinho para a Atual
  (`LobGuard.jsx`). A Nova é uma segunda árvore (`NODES_NOVA`, em `src/data/organograma.js`) e
  vale para **o app inteiro**: cards, contagens (rollup pela nova hierarquia), tabelas de
  Efetivo e Viaturas, dashboards. Regras: unidades com função de Coronel ficam com o card
  dourado (o asterisco do pedido era só para situar e **não aparece na tela**);
  DEIP→DECI, DLOG→DAL, CINT→CSM/INT, CMAN→CSM/MOTO levam os dados da sigla antiga;
  ARI, AJ, DINTER III, GI, CEI, CFO, CAEBM, CCBM e CRESEP nascem "Em construção"; AJ é nova
  e a AJG segue com seus dados (DGA); **DPlaG extinta e absorvida pela DGA**: fica como nó
  `oculto` (soma nas contagens da DGA, não aparece) e seu diretor não vira diretor da DGA.
  A DINTER III fica sem subordinados, sobre a DIESP (4 colunas). Estado-Maior e os
  subordinados de DIM, DINTER I e II não mudam. A LOB Nova não é editável em /adm.
- **Ajustes da LOB (mesmo dia).** **LOB Atual** (só visualização, sem mexer no banco;
  `ajustarLobAtual` em `src/lib/cbmpe.js`): sem o Estado-Maior Geral e suas subordinadas
  ("ainda não existem"); a **DGA, extinta, some**: a DGO fica **como estava** e as
  subordinadas da DGA mantêm **exatamente** as colunas de antes (DLOG, DEIP e as duas
  colunas de diretorias), só que **sem o quadro e o card da DGA**, na linha dela, ao lado
  da DGO (`colunasSoltas` em `Organograma.jsx`); elas passam a ser filhas diretas do
  Subcomando Geral (nível 5), e os totais dele não mudam; AECI com a cor de função de Coronel.
  **LOB Nova, DGA:** GI dentro do grupo da DGP; o grupo da DGP fica embaixo do da DAL (mesma
  coluna); DF, DTIC, DVP e DAS na 3ª coluna; só a AJG na 4ª; fundo mais escuro nas
  subordinadas da ABMG (CEI, CFO, CAEBM).

## Em aberto e próximos passos (2026-10-01)

**Falta fazer, por tema (em ordem do que mais destrava):**

1. **Dimensionamento da VM e pedido de firewall à ATI.** Não feito. Já medido: o banco `dw`
   tem **626 MB** (Mapa de Força 236 MB; `core` 206 MB; Frota 105 MB). Falta: vCPU/RAM/disco
   para o front (nginx) e o backend, IOPS, backup, **lista de portas** (DW 54301, Frota
   54329, ROE 15432, SGP/escala em 10.193.0.16, mapa de força/vacina/SGU em 10.193.0.20,
   Windmill, DNS, NTP) e as perguntas ao TI (raiz de host ou subcaminho; TLS; hostname).
   Quadro final em `docs/deploy-solicitacao-ti.md`. **Deploy no CapRover em standby.**
2. **Primeira execução do flow novo.** ~~Pendente~~ **Feita em 2026-10-06** (ver o bloco
   "2026-10-06" no topo). Falta acompanhar a agenda das 05:30 de 07/10 sozinha.
3. **QOD.**
   - Nomenclatura das funções a partir da **QOD_CONSOLIDADA** (decisão do usuário):
     não feita. Hoje o nome da função vem da `ID_ATUALIZADO`; 11 códigos de função da
     QOD_CONSOLIDADA não existem nela.
   - Os quadros por **seção/SB** estão no `raw_qod_quadros` mas **não alimentam nada**
     (só o GERAL 001, por unidade, é usado). O previsto por divisão ainda vem do
     `efetivo_previsto_divisoes.json` (extrator antigo).
   - Divergências a levar à DPlaG e à CPPA: ver `Relatorio_QOD_divergencias.docx`
     (2º GB 485 × 671, 6º GB 232 × 201, 163 vagas funcionais acima do fixado, matrícula do
     Subcomandante Geral, 47 postos desatualizados, IDs que mudam, numeração de quadros).
4. **Mapa de Força.**
   - **Retenção de 30 dias** (decisão do usuário): **aplicada na apresentação** (views
     `marts.mapa_forca_*` cobrem os últimos 30 dias, a janela anda com a carga). O **corte
     físico** do `raw`/`core` (o DW guarda desde 2019) **não foi feito** — depende de
     confirmar que o resumo agregado (`emprego_viatura_resumo`) basta.
   - ~~Tirar os 12 MB nominais de `public/dados/mapa-forca/`~~ **feito em 2026-10-06**
     (rota no backend, recorte por perfil, arquivos removidos).
   - **Coordenadas dos postos: standby** (o usuário monta a tabela). Lista dos 44 sem
     coordenada em `etl/mapa_forca/postos_sem_coordenada.csv`. Postos de praia do GBMar: o
     usuário informa depois (por ora, sede do GBMar). Regras de fallback já no código
     (`REGRA_COORDENADA_POR_OME`).
   - **De-para posto → seção do QOD** em `etl/mapa_forca/de_para_posto_qod.csv`: 49 casam; 27
     ficam a decidir (CATs, CMAN, ABMG, QCG, CIODS, DAP, DPCIP, CIAT, CEASA e os postos
     `SEDE` lançados por outra OME, ex. "GBS (SEDE)": 1ª SBS ou o comando?).
5. **Painel 09 (Intenção de Movimentação).** ~~Não reimplementado~~ **Feito em 2026-10-06**,
   do DW, com o SQL do Metabase (top 10 por opção; origem por `ome_atual`) e filtros de
   categoria e motivo. Falta só conferir os números com o Metabase do Igor (hoje 19
   solicitações com matrícula e 389 atendidas na planilha).
6. **Domínios que ainda saem de JSON no front:** só os valores de partida de
   `organograma.js` (`efetivo.json`, `efetivo_previsto.json`, `efetivo_lista.json`).
   ~~Painéis pessoais de Efetivo e de Viaturas, lotação e previsto por divisão~~ **feitos em
   2026-10-06** (e `agregado` já entra em `ehIndisponivel()`).
7. **LOB Nova.** Visualização apenas; quando a nova LOB valer de verdade, a árvore vai para
   `app.organograma_unidade`. Pendências: testar o seletor com um usuário comandante e
   subcomandante reais (SGU); dar OME às unidades novas (ARI, AJ, DINTER III, GI, CEI, CFO,
   CAEBM, CCBM, CRESEP) e, na Nova, o DW seguir as OMEs renomeadas; nas tabelas nominais a LOB
   Nova só funciona com o backend ligado ao DW.
8. **DF (Finanças).** Os dois relatórios aguardam a apresentação. Candidatos a unificar o
   tipo de gasto (a DF decide): "Cota Global" × "Cota Global CBM" × "DEA - COTA GLOBAL",
   "Gestão das Taxas" × "Gestão de taxas", "Curso" × "Cursos de formação", "Diárias -
   Operação X" sem o prefixo "EXECUTIVA -". A view `marts.painel_df_funeral` ficou sem uso
   (pode sair). Revisar visualmente a aba Despesas Gerais com a DF.
9. **Segurança (antigas, seguem abertas).** Rotacionar as credenciais que passaram pelo
   chat (DW, Neon e as demais da lista); chaves de service account coladas nos scripts
   "Material Operacional" e "Controle do tempo de serviço" do Windmill; confirmar que as
   credenciais lidas nas origens (SGP, mapa de força, Frota, ROE) são somente leitura;
   `DROP` do `dw_dim_aposentado_20260929` (o Claude não apaga dado); destino do `dw_diesp`.
10. **Material Operacional: descontinuado.** Aguardar a nova fonte e os painéis do Igor.
11. **Qualidade do código.** `npm run typecheck` tem 394 erros que já existiam (props de
    componentes sem tipos); o lint passa. Não há teste automatizado de front.

**Decisões do usuário que valem daqui para frente:** a Vercel não é restrição (sem fallback
em JSON por causa dela); o Pecúlio é a verdade para matrícula e titular; Atividades
Específicas só mostra o que tem dado real; o sistema mostra dados como estão e só trata
grafia; previsto vem do quadro, funções do `ID_ATUALIZADO`, ocupantes da QOD_CONSOLIDADA.
