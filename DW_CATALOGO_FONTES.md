# DW CBMPE — Catálogo de Fontes de Dados

> Checklist vivo. Cada domínio tem uma tabela a preencher conforme o
> levantamento avança (Fase 1 do roadmap em
> [`DW_PLANEJAMENTO.md`](DW_PLANEJAMENTO.md)). Linhas com `A LEVANTAR`
> ainda não foram confirmadas — não presumir nada sobre elas.

## Como preencher

Para cada fonte identificada num domínio, preencher:

| Campo | O que registrar |
|---|---|
| Sistema/Fonte | Nome do sistema, planilha ou fonte externa |
| Tipo | Sistema interno / Planilha / Sistema externo |
| Formato de acesso | API, export CSV/Excel, acesso direto a banco, e-mail manual, etc. |
| Responsável/Contato | Pessoa ou setor dono da fonte |
| Frequência de atualização | Com que frequência a fonte muda / pode ser extraída |
| Sensibilidade | PII / Agregado / Misto (ver [`DW_GOVERNANCA.md`](DW_GOVERNANCA.md)) |
| Status | A confirmar / Confirmado |

## Mapa de conexões (levantado em 2026-08-24)

Levantamento feito conectando e listando schema a schema. **Praticamente
todo o dado que o DW vai precisar está em dois servidores Postgres da rede
interna**, alcançáveis com duas credenciais. Credenciais em `.env.local`
(gitignored) — nunca no repositório.

### `10.193.0.16:5432` — banco `db_portal_sistemas_prod` (var. `DATABASE_URL_SGP`)

Postgres 9.5.25. Todos os sistemas internos "OVR" convivem como schemas do
mesmo banco.

| Schema | Sistema | Tabelas | Status para o DW |
|---|---|---|---|
| `ovrsgp` | SGP — gestão de pessoal | 60 | **Fonte-alvo de Efetivo** (autoridade de OME desde já; autoridade de efetivo quando for regularizado) |
| `ovresc` | Escala eletrônica | 38 | **Cadastro-mestre do mapa de força** — ver nota abaixo. 379.875 escalas, 1.015.888 militares escalados |
| `ovrsgat` | SGAT — atividades técnicas (AVCB, projetos, vistorias, DAE) | 133 | Candidato a "Atividades Específicas" — a levantar |
| `ovrbg` | Boletim Geral | 13 | A levantar |
| `ovrsrp` | Requerimentos | 20 | A levantar |
| `ovrglobal` | Tabelas comuns (pessoa, edificação, veículo, região) | 42 | A levantar |
| `ovrsca` | Controle de acesso (usuários/grupos/módulos) | 10 | Fora de escopo analítico |
| `ovrsac` / `sacbm1` | SAC | 6 | A levantar |
| `ovrsgo` | Ocorrências (despacho) | 22 | **Fora de uso** (confirmado pelo usuário 2026-08-24) |
| `ovrroe` | Relatório de ocorrência (APH, incêndio, salvamento) | 56 | **Fora de uso** (idem) |
| `ovrsmf` | Mapa de força antigo (ScriptCase) | 27 | **Congelado**: dados de 2018-02 a 2020-10. Sucedido pelo `mapa_forca_api_development` |

### `10.193.0.20:5432` (var. `DATABASE_URL_OPS`)

Servidor de aplicações Rails. 32 bancos; só três interessam por ora.

| Banco | Sistema | Estado |
|---|---|---|
| `mapa_forca_api_development` | **Mapa de força** | **Produção, apesar do nome.** 342.018 lançamentos, 1.026.255 militares lançados, 212.628 viaturas lançadas, 264.031 recursos operacionais, 1.235.283 linhas de auditoria. Cobre 2019-11 até hoje |
| `vaccine_control_production` | Vacinação | Populado: 4.138 militares, 3.030 vacinações, 12 campanhas, 1.643 medições de sinais vitais |
| `bombeiro_civil_prod` | Bombeiro civil | Só tabelas de domínio preenchidas; nenhum requerente. Sem uso ainda |
| `map_force_production` | — | **Vazio.** Não confundir com o `_development`, que é o definitivo |

> **Atenção ao nome `mapa_forca_api_development`.** É o banco de produção do
> mapa de força — confirmado pelo usuário em 2026-08-24. Existe um
> `map_force_production` vazio ao lado. Se alguém "corrigir" isso algum dia,
> a carga quebra em silêncio.

### `10.193.1.252:54329` — banco `frotas_production` (var. `DATABASE_URL_FROTA`)

Terceiro servidor, com credencial própria. Sistema de gestão de frotas
(Rails). É a origem real do domínio Viaturas.

| Tabela | Papel |
|---|---|
| `vehicles` | Cadastro da viatura (841 linhas) |
| `transfers` | Histórico de OME — a OME atual é a transferência mais recente |
| `vehicle_statuses` | Histórico de situação — mesma lógica |
| `omes` | Catálogo próprio de OMEs da Frota |
| `fuel_transactions` | Abastecimentos |
| `vehicle_*_types`, `license_categories` | Domínios |

### O DW não lê o Neon (decidido em 2026-08-24)

Enquanto o app foi apresentação, o Neon foi a fonte prática de Efetivo,
Viaturas e Finanças. **Para o DW, não é.** Os bancos Neon são *cache de
aplicação*: alimentados por script Windmill com `TRUNCATE` a cada rodada,
com recorte de colunas e regra de negócio já aplicada.

| Domínio | O DW lê de | Não lê de |
|---|---|---|
| Efetivo | Planilha do Pecúlio (Google Sheets), via `etl/windmill/dw/raw_planilhas.py` | Neon `Militar` |
| Viaturas | `frotas_production`, via `DATABASE_URL_FROTA` | Neon `Viatura` |
| Finanças | Planilha de Finanças (Google Sheets) | Neon `FinancaLancamento` |

O efeito foi medível: lendo a planilha em vez do Neon, `dim_militar` caiu de
2.703 para **2.658** (o Neon guardava resíduo de `ativo=false` que o
`TRUNCATE` não limpava) e `dim_viatura` subiu de 805 para **813** (o recorte
de colunas do Neon descartava viatura sem placa).

As tabelas Neon continuam existindo e continuam sendo alimentadas — o app
publicado depende delas. Ver `etl/windmill/README.md` para a separação entre
os scripts que sustentam as aplicações e os que carregam o DW.

### O mapa de força e o `ovresc` são um sistema só, partido em dois bancos

Verificado em 2026-08-24, com 100% de casamento de ids em todos os casos: as
chaves estrangeiras do mapa de força apontam para o `ovresc`, em outro
servidor, sem constraint declarada.

| Coluna no `mapa_forca_api_development` | Aponta para | Ids usados | Casam |
|---|---|---|---|
| `launches.service_type_id` | `ovresc.tb_tipo_servi` | 149 | 100% |
| `launches.service_shift_id` | `ovresc.tb_turn_servi` | 44 | 100% |
| `launches.service_station_id` | `ovresc.tb_posto` | 141 | 100% |
| `launch_militaries.service_occupation_id` | `ovresc.tb_func_oper` | 150 | 100% |
| `omes.id_scriptcase` | `ovrsgp.tb_ome.id_ome` | 31 | 100% |
| `stations.ome_id_scriptcase` | `ovrsgp.tb_ome.id_ome` | — | 100% |

Consequências práticas:

- **O `ovresc` não pode ser descartado.** Ele é o cadastro-mestre (tipo de
  serviço, turno, posto, função operacional) do mapa de força vivo.
- A tabela local `stations` do mapa de força **não** é a autoridade dos
  postos: `launches.service_station_id` casa 100% com `ovresc.tb_posto` e
  deixa 21 ids de fora quando comparado com `stations.id`. A `stations`
  local serve de complemento (endereço, município, AIS, lat/long) — e está
  com `0.0` em quase todas as coordenadas.
- A ligação OME entre mapa de força e SGP é uma **FK real**, não um
  casamento por nome. Isso torna o mapa de força a fonte com o melhor
  casamento de unidade de todas.

### Servidores e schemas fora de uso

| Onde | O que era | Decisão |
|---|---|---|
| `10.193.1.252:54301`, banco `dw_dim` | Primeira tentativa de DW (schemas `efetivo`, `frotas`, `materiais`) | **Em desuso.** Manter de pé até a carga nova estar validada: é a única fonte de latitude/longitude das OMEs |
| `10.193.1.252:54301`, schema `dw_cbmpe` | Segunda tentativa de DW (esquema estrela, DDL criado, 0 linhas) | **Em desuso.** Tabelas podem ser removidas |
| `10.193.1.252:54301`, schema `public` | Tabelas que alimentam o Metabase (`peculio_metabase_v1`, `inativos_metabase`, `cim_*`, `fin_*`) | **Não mexer.** Mantidas por terceiros, em uso |

## Fontes externas (objetivo 1 — prioridade atual)

Decisão de 2026-08-07 (ver `DW_PLANEJAMENTO.md`, "Recalculando a rota: 3
objetivos do projeto"): dados dispersos **fora** dos sistemas internos —
sistemas externos usados pela corporação, planilhas Google Sheets — são a
prioridade atual de levantamento, porque sistemas internos já têm banco
próprio (não precisam de rotina de *coleta* nova, só de extração dos
principais dados pro `core`).

| Sistema/Fonte | Tipo | Formato de acesso | Responsável | Frequência | Sensibilidade | Status |
|---|---|---|---|---|---|---|
| A LEVANTAR | Sistema externo / Planilha (Google Sheets) | A LEVANTAR | A LEVANTAR | A LEVANTAR | A LEVANTAR | Lista ainda não levantada — próximo passo prático mais urgente |

Essas fontes, uma vez identificadas, são coletadas pelo Windmill e pousam
em `raw`/`staging` do Postgres do DW (mesmo banco dos sistemas internos,
schemas separados) — ver [`DW_ARQUITETURA.md`](DW_ARQUITETURA.md).

## Organograma / Estrutura Organizacional

**Autoridade definida em 2026-08-24: o SGP (`ovrsgp.tb_ome`).** Toda outra
lista de unidade da corporação passa a ser reconciliada contra ela.

| Sistema/Fonte | Tipo | Formato de acesso | Responsável | Frequência | Sensibilidade | Status |
|---|---|---|---|---|---|---|
| `ovrsgp.tb_ome` | Sistema interno | `DATABASE_URL_SGP` | DGP / DTIC | Baixa (muda em reestruturação) | Não sensível | **Autoridade do cadastro** (quais OMEs existem, sigla, nome, tipo AD/OP, status A/I, coordenada): 82 linhas. **Não é autoridade da hierarquia** — ver abaixo |
| `ovrsgp.tb_secao` | Sistema interno | idem | idem | idem | Não sensível | Seções internas de cada OME — a levantar |

### Cadastro vem do SGP, hierarquia vem do organograma (2026-08-24)

Decisão do usuário, textual: **"Organograma é a verdade."**

A distinção importa porque as duas coisas são independentes. O SGP diz
*quais* OMEs existem; o organograma diz *de quem cada uma depende*. Ao
carregar o DW as duas leituras divergiram em 27 unidades — a DGP, por
exemplo, fechava 77 militares por rollup no SGP e 39 no organograma.

`core.dim_ome` carrega a coluna `origem_hierarquia` justamente para não
esconder isso:

| `origem_hierarquia` | Unidades | Significado |
|---|---|---|
| `organograma` | 45 | O pai veio do organograma oficial (`src/data/organograma.js`) |
| `sgp` | 26 | Não consta do organograma; mantém o pai do SGP |
| `regra` | 11 | Pai definido por regra explícita nossa (ver `carga_core.py`) |

A coluna `no_organograma` (46 unidades verdadeiras) responde diretamente
"esta OME é reconhecida pelo organograma oficial?".

**O organograma vive em `src/data/organograma.js`**, não numa tabela. O
`carga_core.py` lê a constante `ARVORE` desse arquivo e falha alto se o
parse render menos de 5 nós — assim uma refatoração no front não degrada a
hierarquia do DW em silêncio. Se o organograma virar tabela algum dia, é
esse leitor que muda, e mais nada.

### Estado das unidades resolvido com o usuário (2026-08-24)

| Situação | Resolução |
|---|---|
| **DGA** | Ainda não existe. Fica `planejada`, `conta_efetivo = false`, sem filhos — e as 9 diretorias que penderiam dela pendem **direto do Subcomando Geral**, que passa a ter 17 filhos diretos. Quando a DGA for criada, basta mudar o status |
| **AJ** | Existe hoje, subordinada ao **GCG** |
| **GBFN** | Tornou-se **SBFN**, seção subordinada ao **GBI**. Os lançamentos históricos ficam atrelados a ela |
| **CAC, CPA, CPTO, CTA, CEMET II, DFEA** | **Extintas.** Marcadas como tal no DW; a correção na origem fica a critério do usuário |
| **CATs numeradas** | Herdam do sufixo 1 da sua região (ver Coordenadas, abaixo) |
| **GTA** | Não é OME: entra como **adido**, com órgão externo `GTA` |

O GBFN **não** exigiu SCD tipo 2: o usuário quer o histórico lido sob a
estrutura atual, que é exatamente o que uma dimensão sem versionamento faz.
SCD2 na `dim_ome` só seria necessário para o oposto — ver 2021 com a
estrutura de 2021. Fica registrado como opção, não como pendência.

### Quantas unidades cada sistema conhece

O tamanho do problema de reconciliação, medido em 2026-08-24:

| Fonte | Unidades | Chave para o SGP |
|---|---|---|
| `ovrsgp.tb_ome` | 82 | — (é a autoridade) |
| Mapa de força (`omes`) | 31 | **FK real** via `id_scriptcase` — 31/31 |
| Escala (`ovresc.tb_posto_ome`) | 760 postos | via `ovresc`, mesma família do SGP |
| Vacinação (`omes`) | 91 | a levantar |
| Frota (`omes`) | ~48 | por sigla — de-para necessário |
| Pecúlio / Neon (`Militar.ome`) | 46 | por sigla — `etl/efetivo/mapeamento_unidades.json` |
| `dw_dim.efetivo.ome` (em desuso) | 48 | por sigla/nome — casado em 2026-08-24 |

### Coordenadas geográficas

Situação em 2026-08-24: **nenhuma OME tem coordenada real no SGP** — as 75
linhas não-nulas de `nr_latd`/`nr_long` estão gravadas como `0,0`. A única
fonte com latitude/longitude preenchida é o `dw_dim.efetivo.ome`, da
primeira tentativa de DW.

`etl/sgp/casar_coordenadas_ome.py` transporta essas coordenadas para o SGP.
Resultado: das 82 linhas, **63 recebem coordenada e 0 ficam em divergência**
(45 por casamento automático, 15 por regra explícita, 7 assumindo o QCG); 19
ficam de fora (5 situações funcionais modeladas como OME, 8 OMEs inativas, 6
unidades extintas ainda marcadas como ativas). O script **só gera relatório**
— gravar exige `--aplicar`, e isso ainda não foi feito.

Regras de coordenada confirmadas pelo usuário:

- Toda diretoria/unidade administrativa sem sede própria conhecida fica no
  **QCG** (`-8.051522, -34.890144`). Inclui a CAT/RMR.
- **DINTER/1** usa a coordenada do 2º GB; **DINTER/2**, a do 4º GB.
- As **CAT numeradas foram absorvidas pela de número 1**: nome e numeração
  ficam como estão, mas a coordenada é compartilhada por região —
  `CAT/ZM*` usa o 1º GB, `CAT/AGRESTE*` o 2º GB, `CAT/SERTÃO*` o 4º GB.
- **GBFN** (hoje Seção, SBFN, vinculada ao GBI) recebe coordenada literal
  `-3.85609, -32.42678` — é o único ponto fora do continente.
- Seis unidades extintas (ids 35, 37, 42, 54, 57, 86) não recebem
  coordenada, mas **não devem ser inativadas** por nossa conta.

### Problemas de qualidade conhecidos na `tb_ome`

- **Duas DGP**: id 25 (`DGP`, nível 2) e id 8 (`DGP.`, nível 3, com ponto
  no nome). Ambas ativas, ambas com militares apontando via FK. Decisão do
  usuário em 2026-08-24: **somar as duas** — vira um de-para no `stg`,
  apontando as duas para o mesmo `sk_organizacao`. Não alterar o SGP.
- **Situações funcionais modeladas como OME**: `INATIVOS` (id 3), `ADIDO`
  (4), `OUT SIT / DGP` (5), `LIC / DGP` (6), `CFHP 2017` (80). Não são
  unidades e nunca devem receber coordenada. Ver a regra de efetivo ativo
  em `DW_MODELO_DADOS.md`.
- **Seis unidades extintas seguem com `ic_stat = 'A'`**: 2º GI (35), CTEDC
  (37), DIINT (42), COM/DCTO (54), CRD (57), 11º GB (86).

## Efetivo / RH

| Sistema/Fonte | Tipo | Formato de acesso | Responsável | Frequência | Sensibilidade | Status |
|---|---|---|---|---|---|---|
| SGP (Sistema de Gestão de Pessoal), schema `ovrsgp` | Sistema interno | Acesso direto a banco — **conexão obtida em 2026-08-24**: `10.193.0.16:5432`, banco `db_portal_sistemas_prod`, var. `DATABASE_URL_SGP` | A LEVANTAR | A LEVANTAR | Misto — PII pesado + dado sensível (saúde), ver escopo proposto em `DW_MODELO_DADOS.md` | Escopo de entidades proposto (a confirmar campo a campo); conexão e frequência a levantar. Ficha `/militar/:matricula` — Caminho A (público, só não sensível, lido da base Neon) implementada 2026-08-19; Caminho B (ficha completa do SGP) engatilhado, aguarda conexão ao SGP + autenticação real — allowlist/denylist em `DW_GOVERNANCA.md`, mapa de blocos em `DW_MODELO_DADOS.md` |
| Neon (Postgres gerenciado) — tabela `Militar` | Sistema interno (mantido pelo usuário) | Acesso direto a banco (connection string própria, fora da rede interna/VPN) | A LEVANTAR | Sincronizado por script Windmill a partir de planilha Google Sheets — frequência real a levantar | Misto — `efetivo.json` é agregado (contagem por unidade); `efetivo_lista.json` é individual por decisão deliberada e confirmada (postoGrad/matrícula/nome/nomeGuerra/sexo/idade — ver `DW_GOVERNANCA.md`); painel "dados completos" adiciona campo sensível LGPD, coleta pendente | Confirmado para Efetivo (contagem por `ome`, `ativo=true`) — ver extração em `etl/efetivo/`. Não substitui o SGP para o aprofundamento futuro do domínio |
| QOD ("Quadro de Organização e Distribuição", planilha oficial, "08 - QOD - AGOSTO - 2026.xlsx") | Planilha | Arquivo local compartilhado diretamente pelo usuário (sem link/API — 97 abas, uma por unidade + seções internas) | A LEVANTAR | Ad hoc — compartilhado manualmente pelo usuário quando atualizado; sem mecanismo de coleta automática ainda | Agregado (só o total previsto por unidade e por divisão interna sai dos extratores, nunca dado de militar individual) | Confirmado para Efetivo Previsto por unidade (aba GERAL 001, coluna TOTAL) — ver `etl/efetivo/extract_previsto.py` — e por divisão/seção interna de cada unidade (uma aba por unidade, ex. "GBI 012", "DGP 080") — ver `etl/efetivo/extract_previsto_divisoes.py`, gera `src/data/real/efetivo_previsto_divisoes.json`. Pendente de homologação/publicação em BGE (usado mesmo assim, a pedido do usuário). Também serve de fonte de `dim_funcao` (vagas de função por unidade/seção) pro cruzamento com a Repercussão Financeira abaixo |
| Pecúlio.xlsx (DGP, planilha oficial) | Planilha | Arquivo local compartilhado diretamente pelo usuário | A LEVANTAR | Ad hoc | Misto — mesmos campos já cobertos por PII em `efetivo_lista.json` | **Confirmado pelo usuário: é a mesma fonte que já alimenta o Neon** (linha acima) — não é uma superfície de integração nova, só a planilha de origem visível. Ver `DW_MODELO_DADOS.md` |
| Repercussão Financeira.xlsx (CPPA, planilha oficial) | Planilha | Arquivo local compartilhado diretamente pelo usuário (12 abas; relevante: `DIST_FUNCOES`) | A LEVANTAR | Ad hoc — planilha viva, em atualização contínua pela CPPA (não um snapshot fechado) | Misto — matrícula/nome (PII) + função/seção (agregável) | **Implementado**: `etl/efetivo/extract_lotacao_funcao.py` lê `DIST_FUNCOES`, casa matrícula com `efetivo_lista.json` (Pecúlio/Neon) e gera `src/data/real/lotacao_funcao.json`. Rodada de 2026-08-17: 716/2.659 militares com função (~27%, cobertura parcial confirmada pelo usuário como em expansão). Aba `REPERC_FINANC` catalogada mas não integrada (redundante — só posto-tier, sem seção) |
| Funções - DPlaG.xlsx (DPlaG, catálogo oficial de funções) | Planilha | Arquivo local compartilhado diretamente pelo usuário (aba `QOD_FUNCOES`, 1.754 linhas) | A LEVANTAR | Ad hoc | Agregado (catálogo de definição de função, sem matrícula) | **Confirmado pelo usuário**: é a fonte de onde a coluna "NOME DA FUNÇÃO E SEÇÃO/OME" do `DIST_FUNCOES` acima passa a ser preenchida — usado por `extract_lotacao_funcao.py` como dicionário pra casar o texto da função com a divisão/seção exata (prioridade 1 de casamento, antes de heurística de texto ou rollup na árvore do QOD) |
| Postgres do "data warehouse" compartilhado (`10.193.1.252:54301`, dbname `postgres`) — tabelas `inativos_metabase`, `peculio_metabase_v1`, `cim_pedidos`, `cim_atendidos`, `escolaridade_militares` | Sistema interno | Acesso direto a banco (env var `DATABASE_URL_DW`) — **diferente do Neon** usado pelos outros extratores de Efetivo | Igor (mantém os scripts de carga a partir de planilhas Google Sheets públicas) | Ad hoc — recarregado manualmente por Igor via TRUNCATE+COPY | Agregado nos 3 extratores nossos (nunca matrícula/nome extraídos); as próprias tabelas de origem têm matrícula/nome (não extraímos) | **Confirmado 2026-08-19**: alimenta os painéis 07 (`extract_saida_previsao.py` — `inativos_metabase`/`peculio_metabase_v1`) e 09 (`extract_intencao_movimentacao.py` — `cim_pedidos`/`cim_atendidos`) do Dashboard Pessoal de Efetivo. `escolaridade_militares` catalogada mas não usada em nenhum painel ainda. **Credencial exposta em texto puro no chat — recomendação de rotação registrada em `DW_PLANEJAMENTO.md`** |

## Frota

| Sistema/Fonte | Tipo | Formato de acesso | Responsável | Frequência | Sensibilidade | Status |
|---|---|---|---|---|---|---|
| Sistema de gestão de frotas (app Rails), banco `frotas_production` | Sistema interno | Acesso direto a banco (Postgres, `10.193.1.252:54329`, rede interna, alcançável pelo Windmill) | A LEVANTAR | Sincronização pontual via Windmill (não agendada ainda) | Não-PII de militar, mas dado de veículo identificável (placa/chassi/patrimônio) já é extraído — ver linha do Neon abaixo | Confirmado para Viaturas — OME e status atuais derivados do registro mais recente em `transfers`/`vehicle_statuses` (tabela `vehicles` não tem FK direta pra nenhum dos dois). Ver extração em `etl/viaturas/` |
| Neon (Postgres gerenciado, dedicado a Frota) — tabela `Viatura` | Sistema interno (mantido pelo usuário) | Acesso direto a banco (connection string própria, fora da rede interna/VPN) | A LEVANTAR | Alimentado pelo Windmill a cada rodada manual do `windmill-viaturas.py` | Não-PII de militar; dado de veículo identificável (placa, patrimônio, chassis, renavam) já sai daqui pro app — decisão deliberada, ver `DW_PLANEJAMENTO.md` 2026-08-07 "Exceção deliberada..." e 2026-08-18 (ficha da viatura). Campos ricos por veículo: tipo, marca/modelo/ano, combustível, posse, destinação, rastreamento (GPS), condutores vinculados, categoria de habilitação exigida, odômetro, último abastecimento (data/valor) | Confirmado — 1 linha por viatura, agregação/enriquecimento por unidade fica nos scripts locais (`etl/viaturas/extract_viaturas.py` → `viaturas.json`/`viaturas_lista.json`/`viaturas_detalhe.json`). `viaturas_detalhe.json` (por placa, ~805 de 840 viaturas — só as com placa cadastrada) alimenta o Dashboard Pessoal de Viaturas (`/viaturas/:id/dashboard/:modulo`, 5 módulos, 2026-08-19) e a ficha por viatura (`/viatura/:placa`) |

## Financeiro

| Sistema/Fonte | Tipo | Formato de acesso | Responsável | Frequência | Sensibilidade | Status |
|---|---|---|---|---|---|---|
| Planilha Google Sheets de Finanças ("Banco de Dados - NÃO MEXER") | Planilha | Link público de export `.xlsx`, carregado no Postgres interno por script Windmill existente (`windmill-financas.py`, não alterado) | A LEVANTAR | Sincronização via Windmill (frequência a levantar) | Misto — linhas de auxílio funeral/suprimento individual têm nome, matrícula e CPF de militar em texto livre (colunas de descrição/observação); não extraídas para o DW | Confirmado para o KPI de Finanças — só linhas EMPENHADO, Autorização/Carnaval restrito a enquadramento "Suprimento Individual", SFI Ordinário completo. Ver `etl/financas/` |
| Postgres interno (`10.193.1.252:54301`, banco `postgres`) — tabelas `fin_autorizacao`, `fin_carnaval_2026`, `fin_sfi_ordinario` | Sistema interno | Acesso direto a banco (rede interna, alcançável pelo Windmill) | A LEVANTAR | Já existente, alimentado pelo script Windmill da planilha | Não-PII para o que é extraído (colunas com PII — ofício, SEI, descrição, observação — nunca saem daqui para o Neon) | Confirmado como fonte para o novo `windmill-financas-sync.py` |
| Neon (Postgres gerenciado, mesmo banco de Viaturas) — tabela `FinancaLancamento` | Sistema interno (mantido pelo usuário) | Acesso direto a banco (connection string própria, fora da rede interna/VPN) | A LEVANTAR | Alimentado pelo Windmill a cada rodada manual do `windmill-financas-sync.py` | 1 linha por lançamento financeiro (origem, destino, enquadramento, situação, valores, mês) — sem ofício/SEI/descrição/observação | Confirmado — agregação por unidade fica no script local (`etl/financas/extract_financas.py`) |

## Atividades Operacionais — Mapa de Força e Escala

Fonte mais rica levantada até agora, e a única que liga militar, viatura,
OME e tempo no mesmo registro. **Já traz quase seis anos de histórico
pronto** (2019-11 até hoje) — ao contrário dos demais domínios, aqui o DW
não precisa começar a acumular do zero.

| Sistema/Fonte | Tipo | Formato de acesso | Responsável | Frequência | Sensibilidade | Status |
|---|---|---|---|---|---|---|
| Mapa de força (`mapa_forca_api_development`) | Sistema interno | `DATABASE_URL_OPS` | DTIC | Contínua (lançamentos ao longo do dia) | **Misto — contém CPF** (`launch_militaries.military_cpf`, `action_logs.user_cpf`) | Estrutura levantada e chaves testadas em 2026-08-24; integração ainda não desenhada |
| Escala eletrônica (`ovresc`) | Sistema interno | `DATABASE_URL_SGP` | DTIC | Contínua | Misto | Cadastro-mestre do mapa de força — ver mapa de conexões |
| Mapa de força antigo (`ovrsmf`) | Sistema interno | `DATABASE_URL_SGP` | — | Congelado | Misto | Histórico 2018-02 a 2020-10. Só interessa se quisermos série anterior a 2019-11 |

### Tabelas do mapa de força

| Tabela | Linhas | Grão |
|---|---|---|
| `launches` | 342.018 | 1 lançamento = OME × posto × tipo de serviço × turno × data |
| `launch_militaries` | 1.026.255 | 1 militar em 1 lançamento (matrícula, CPF, nome, posto e função — desnormalizados no ato) |
| `launch_vehicles` | 212.628 | 1 viatura em 1 lançamento |
| `launch_operational_resources` | 264.031 | 1 tipo de recurso em 1 lançamento, **com quantidade** |
| `action_logs` | 1.235.283 | 1 alteração: campo, valor antigo, valor novo, **motivo**, CPF do usuário |
| `service_orders` | 7.319 | Ordem de serviço/evento (ex. jogo de futebol, TAF) |

Todas as tabelas de fato usam *soft delete* (`discarded_at`) — o ETL tem
que filtrar, senão conta lançamento cancelado (4.657 em `launches`).

### Chave de militar

`launch_militaries.military_registration` é a matrícula **sem hífen,
mantendo o dígito verificador**: `704028-8` no Pecúlio vira `7040288` aqui.
Medido em 2026-08-24: casa com **94,1%** do efetivo ativo (2.501 de 2.658).

### Chave de viatura — a Frota e o mapa de força não estão ligados

O mapa de força tem catálogo próprio de tipos de viatura, que **diverge** do
sistema de Frotas (10 acrônimos só existem lá: ABTS, ABSM, AAM, AAR, AE,
APP, APS, ASA, ATC, CCI; 3 só na Frota: AAS, ATE, BIR). E o `order_number`
é texto digitado no ato do lançamento.

Cobertura medida sobre 48.067 lançamentos de viatura em 12 meses:

| Chave testada | Cobertura |
|---|---|
| acrônimo + número de ordem | 59,9% |
| só o número de ordem | 80,6% |
| **número de ordem, ignorando zeros à esquerda e o sufixo `L` da Frota** | **98,6%** |

O sufixo era a peça que faltava: a Frota grava `39L`, `92L`, `24L`; o mapa
de força grava `039`, `092`, `024`. O **acrônimo é a parte não confiável** —
em 26% dos casos que casam pelo número o tipo diverge (`MSA-911` no mapa de
força é um `ABT` na Frota).

Resíduos, ambos tratáveis: **150 pares ambíguos** (número de ordem
reciclado — viatura baixada, nova herdou o número; resolve por data, contra
a `dim_viatura` SCD2) e **42 pares sem casamento** (1,4% do volume:
MTP-1066/1067/1068, MSA-991/992 e outros).

## Vacinação

| Sistema/Fonte | Tipo | Formato de acesso | Responsável | Frequência | Sensibilidade | Status |
|---|---|---|---|---|---|---|
| `vaccine_control_production` | Sistema interno | `DATABASE_URL_OPS` | A LEVANTAR | Por campanha | **Dado de saúde — sensível, LGPD art. 11** | Estrutura listada em 2026-08-24; integração não desenhada |

4.138 militares, 3.030 vacinações, 12 campanhas, 20 vacinas, 8 marcas, 24
aplicadores, 1.643 medições de sinais vitais, 414 registros, 91 OMEs. Tem
`versions` (PaperTrail) com 5.515 linhas — trilha de auditoria própria, ou
seja, histórico de graça.

A levantar: por que são 4.138 militares contra 2.658 ativos (inclui
inativo? civil? histórico acumulado?), e se a chave é matrícula.

## Materiais / Patrimônio — Fase 2, fora do escopo atual

Domínio adiado (decisão de 2026-08-07, ver `DW_PLANEJAMENTO.md`). Não
levantar fontes para este domínio ainda.

## O que já sabemos hoje (nível corporação, não por fonte específica)

- As fontes são mistas entre sistemas internos, planilhas e sistemas
  externos. A primeira fonte interna (SGP) já foi analisada; fontes
  externas ainda precisam ser listadas (prioridade atual, ver seção
  acima).
- O destino de todas as fontes é o mesmo Postgres em servidor interno,
  acessível via VPN — mas o papel difere: fontes externas pousam em
  `raw`/`staging` (coleta) e alimentam o `core`; fontes internas já
  persistidas (ex. SGP) só têm os principais dados extraídos direto pro
  `core`, sem passar por `raw`/`staging` (ver [`DW_ARQUITETURA.md`](DW_ARQUITETURA.md)).
- A frequência de atualização varia por domínio/fonte — a definir linha a
  linha nas tabelas acima, não um valor único para o DW inteiro.
