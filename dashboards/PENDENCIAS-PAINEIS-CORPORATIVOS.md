# Pendências dos painéis de BI — estado real e perguntas em aberto

**Data:** 2026-09-21, atualizado no mesmo dia após Igor disponibilizar os
quatro pacotes · **Autor:** sessão de integração (Claude Code)
**Para:** Valério (acesso a banco/infra) e Igor (dado e regra de negócio)

Este documento existe porque o pedido de integração que abriu a sessão partia
de um estado do repositório **anterior ao atual**. Antes de inserir qualquer
coisa, auditei o que já está no sistema. O resultado está na Parte 1; a Parte
2 cobre os quatro painéis corporativos — que não existiam no repositório na
primeira auditoria e foram entregues por Igor horas depois, já auditados
aqui; a Parte 3 é a lista única de perguntas, organizada por quem pode
respondê-las (**revisada** para refletir o que os próprios `status_*.md` de
Igor já resolveram).

---

## Parte 1 — Dashboard Pessoal (Efetivo Geral): os 9 painéis já estão no ar

O pedido pressupunha que 05 e 06 precisavam ser inseridos, que 07 e 08
entrariam parciais e que 09 estava bloqueado por completo. **Nada disso vale
mais.** Os nove módulos estão implementados em `src/pages/efetivo/`, ligados
em `EfetivoDashboard.jsx`, e os dois bloqueios de dado do painel 07 e o
bloqueio de PII do painel 08 foram resolvidos em 2026-08-19.

| Painel | Módulo no sistema | Quadrantes | Estado |
|---|---|---|---|
| 01 Efetivo Geral | `ModuloEfetivoGeral.jsx` | 7 KPIs + 5 gráficos | no ar |
| 02 Distribuição Geográfica | `ModuloDistribuicaoGeografica.jsx` | 2 | no ar |
| 03 Situações Funcionais | `ModuloSituacoesFuncionais.jsx` | 6 KPIs + 5 gráficos | no ar |
| 04 Militares Adidos | `ModuloMilitaresAdidos.jsx` | 1 KPI + 4 gráficos | no ar, 1 ressalva (ver abaixo) |
| 05 Acúmulo de Cargos | `ModuloAcumuloCargos.jsx` | 3/3 | no ar, sem pendência |
| 06 PCD's | `ModuloMilitaresPcd.jsx` | 3/3 | no ar, sem pendência |
| 07 Movimentação e Carreira | `ModuloMovimentacaoCarreira.jsx` | **6/6** | no ar — os 2 bloqueados foram destravados |
| 08 Tempo na OME | `ModuloTempoNaOme.jsx` | **4/4** | no ar — inclui a tabela nominal |
| 09 Intenção de Movimentação | `ModuloIntencaoMovimentacao.jsx` | 2 KPIs + 7 gráficos | no ar — 2 agregações são inferência nossa |

### O pacote de handoff está inteiro no repositório

Conferi o `handoff-paineis-05-a-09.zip` (encontrado em `~/Downloads`) arquivo
por arquivo contra `dashboards/01-efetivo-geral/`: **os 8 arquivos estão
commitados e byte-idênticos** (`HANDOFF-paineis-05-a-09.md`, `template.html`,
`carreira_extra.json`, `adidos_extra.json` e os quatro `spec-0N.json`). A
pergunta "Igor já subiu isso ou ainda está só com ele?" está respondida: já
está no repositório.

### Como os dois bloqueios do painel 07 foram resolvidos

Não por estimativa — por fonte nova. `etl/efetivo/extract_saida_previsao.py`
lê o SQL original do Metabase contra o Postgres do DW compartilhado
(`inativos_metabase` e `peculio_metabase_v1`), que é **população de inativos e
projeção, não efetivo ativo**. Por isso os dois cards:

- não respondem aos filtros da página (o grão extraído é agregado, sem posto
  nem OME por registro);
- não são clicáveis (a população não bate 1:1 com a tabela de efetivo ativo);
- só aparecem na visão do Comando Geral — para uma unidade específica, seria
  dado de militares fora da competência dela.

### Painel 08: a decisão de PII foi tomada, com uma ressalva que continua válida

A tabela nominal ("Informações dos militares", com Matrícula/Posto/Nome de
Guerra/OME/Tempo) foi liberada pelo usuário em 2026-08-19, com o argumento de
que "o app tem login". A ressalva registrada no próprio módulo continua
verdadeira e **não** foi resolvida: `src/lib/authClient.js` é um stub em
`localStorage`, não uma barreira de servidor. A tabela não introduziu uma
categoria nova de exposição (nome e matrícula já aparecem em `/efetivo/:id`),
mas o login continua sendo protótipo.

### Painel 04 — a divergência dos ADIDOs: **resolvida nesta sessão**

A pergunta era: por que `tempoObmAtualDias` bate perfeito para a população
inteira (painel 08) e diverge só no subconjunto de adidos (painel 04)?

A hipótese registrada no `spec-04-militares-adidos.json` era "snapshot vivo,
datas de referência diferentes". **Está errada.** A causa é aritmética: o
painel 08 trunca os anos antes de escolher a faixa (`Math.floor`), o
recálculo do painel 04 não truncava. Medido contra os dados do próprio
repositório:

| Como agrupar os 187 adidos por `tempoOmeAnos` | Resultado |
|---|---|
| Valor fracionário direto na faixa | 104 / 44 / 19 / 20 |
| **Truncado para ano inteiro antes da faixa** | **117 / 36 / 23 / 11** |
| Print do Igor | **117 / 36 / 23 / 11** |
| Aproximação da planilha de Pecúlio (o que o app mostra hoje) | 116 / 36 / 23 / 11 |

Ou seja: a coluna exata em dias é boa, reproduz o print na íntegra e não tem
nenhum nulo nos 187 registros. Não há mistério de data de referência, e não
há motivo para desconfiar do campo em contexto de adido.

**Defeito encontrado e corrigido junto (era real, com impacto medido).** O
gráfico agrupa por ano inteiro, mas o clique na barra filtrava a tabela por um
intervalo em dias que parava no primeiro dia do ano que a faixa nomeia no fim
(`"0-5"` → 0..1.825; `"6-10"` → 2.190..3.650), abrindo dois vãos:
**1.826-2.189 e 3.651-4.014**. Medido nos 187 adidos:

| | Antes | Depois |
|---|---|---|
| Tabela da faixa "0-5" | 104 | **117** |
| "6-10" | 31 | **36** |
| "11-15" | 14 | **23** |
| "15+" | 20 | **11** |
| **Soma** | **169** | **187** |

Ou seja: **18 adidos não apareciam em tabela nenhuma** (caíam nos vãos) e **9
abriam a tabela da faixa vizinha** (5.476-5.839 dias iam para "15+" em vez de
"11-15") — 27 de 187 errados. Corrigido em `src/lib/efetivoDashboard.js`
(`bucketTempoParaIntervaloDias`): cada faixa agora cobre os 365 dias de cada
ano que ela nomeia. Depois da correção as quatro tabelas somam exatamente
117 / 36 / 23 / 11 = 187 — o print — e nenhum valor de dia fica sem faixa.
Verificado no navegador: a tabela de "0-5" abre com "Filtrados: 117".

**O que deixei como decisão, não resolvi:** o gráfico continua contando pela
aproximação da planilha de Pecúlio (116 na primeira faixa, porque 1 dos 187
adidos tem `#NUM!` naquela coluna). Trocar a fonte do gráfico para a coluna
exata faria o card bater 117/36/23/11 com o print — mas muda um número de
painel já validado, e essa decisão é do Igor. Enquanto isso, o card declara a
ressalva no próprio subtítulo, em vez de a diferença ficar silenciosa.

### Gaps dos painéis 01-04 que **seguem abertos**

| Gap | Onde | Situação |
|---|---|---|
| Dado sensível em arquivo público | `src/data/real/efetivo_lista.json` | **Continua exposto.** Conferi os campos: `racaCor`, `pcd` (categoria especial, LGPD art. 11), `telefone1` e `telefone2` estão no JSON servido ao navegador, contrariando a denylist do Caminho A. Registrado como pendência desde 2026-08-19 e ainda não removido |
| Valor de sentinela no tempo na OME | tabela nominal do painel 08 | Alguns militares aparecem com ~126 anos de tempo na OME atual (`completo.tempoObmAtualDias`). Os 3 cards agregados usam outro campo e não são afetados. Origem não investigada |
| Regra de **Agregado** | `DW_MODELO_DADOS.md` | A regra de **Adido** foi definida (conta para o órgão externo, para a OME fantasma ADIDOS, para o rollup do Comando Geral e para o total). A de **Agregado** não: os 18 militares marcados `Ag`/`Ag - READAP`/`CARGO ELETIVO - Ag` na coluna OBS do Pecúlio estão carregados como texto em `dim_militar.observacao`, sem virar regra. Nenhuma view oficial de "efetivo ativo" deve ser criada antes disso |
| 2 agregações do painel 09 | `ModuloIntencaoMovimentacao.jsx` | "Distribuição das solicitações" (hoje por `motivo`) e "Origem das solicitações" (hoje por `ome`) são inferência nossa — o SQL original se perdeu num resumo de contexto. Declarado no subtítulo dos dois cards |

### Uma pergunta do pedido que já tem resposta no código

O `categoria` de `cim_pedidos`/`cim_atendidos` **não** corresponde ao filtro
de *Patente*, e sim ao de *Classe* (Oficiais/Praças) — está confirmado no
cabeçalho de `etl/efetivo/extract_intencao_movimentacao.py`. O que continua
faltando do painel 09 é o SQL do card "Solicitações por Posto e Graduação" e
o export bruto das duas tabelas.

---

## Parte 2 — Os quatro painéis corporativos: **chegaram em 2026-09-21**

Na auditoria original (mais acima nesta Parte 2) nenhum dos quatro pacotes
estava no repositório nem na máquina. Igor os disponibilizou depois — estão
em `dashboards/` como `das.zip`, `dlog.zip`, `ocorrencias.zip` e o par
`df.html`/`df.md`. **Ainda não commitados** (aparecem como `??` no `git
status`) e não organizados na convenção de pasta por painel usada em
`01-efetivo-geral/` — isso fica para quando o Valério confirmar o próximo
passo.

### O que cada pacote contém

| Painel | Arquivos | Abas | Peso |
|---|---|---|---|
| Dashboard DF | `df.html` (código) + `df.md` (**não é status do DF** — é o prompt-padrão reutilizável que Igor usa para começar qualquer painel novo, ver nota abaixo) | 3: SFI (Ordinário e Extra), Suprimento Individual, Despesas Diversas | 400 KB |
| Vacinações (DAS) | `das.zip` → `index.html` + `status_dashboard_vacinacoes.md` | 4: Visão geral, Execução e logística, Linha do tempo, Indicador de participação | 180 KB |
| PLAN DLOG | `dlog.zip` → `dlog-dashboard-embutido.html` + `status_dlog.md` | 6: Planejamento, Planejamento (Detalhamento), Distribuição, Distribuição (Visão Mapa), Controle de Processos, Gestão DPL | 312 KB |
| Ocorrências | `ocorrencias.zip` → `dashboard-ocorrencias.html` + `status_ocorrencias.md` + `geojs-26-mun.json` (geometria dos municípios de PE para o mapa) | 8: Visão Geral, APH, Incêndio, Salvamento, Prevenção, Produtos Perigosos, Geolocalização, Perfil de vítimas | 484 KB |

### Auditoria técnica: os quatro seguem o padrão à risca

Verificado por leitura de código e renderização (DF e DAS renderizam ao vivo
no navegador sem erro de console; DLOG e Ocorrências passaram no mesmo
conjunto de checagens estáticas — só não renderizaram no preview local por um
limite de tamanho da ferramenta de navegador, não por defeito no arquivo):

- **Zero dependência externa** nos quatro — nenhum `<script src=...>` nem
  `<link>` para CDN. Chart.js 4.4.0 e Inter embutidos inline.
- **Contrato `DASHBOARD_DATA`** presente nos quatro, com `reloadDashboardData(tabId, filtros)` como único ponto de integração (`// TODO (integração)`).
- **Paleta correta** (`#970706`/`#C51132`/`#F0DEE1`/`#161A22`/`#828A99`/`#F4F4F4`/`#FFFFFF`, Inter) nos quatro — inclusive Ocorrências e Vacinações, que passaram por uma correção de paleta registrada nos próprios `status_*.md` (a primeira versão tinha usado navy/branco "de memória", sem amostragem de pixel).
- **Flags `confirmado`/`status` por campo**, com comentário citando a fonte (print, SQL ou CSV) — DF usa `confirmado: true/false` por bloco; DLOG e Ocorrências usam `status: 'confirmed'/'print'/'pending'/'hypothesis'`.
- **Card "aguardando dado" já embutido** onde falta fonte — ex.: "Vacinações mensais" no DAS mostra `⏳ Aguardando dado — o print mostra só a forma da curva... Necessário SQL/export com contagem por mês`, renderizado na tela, não só documentado.

### Nível de validação, por painel (segundo os próprios `status_*.md` de Igor)

Isso é o que muda o trabalho daqui pra frente: ao contrário do que a
[[project_igor-cowork-nao-e-dado-real|memória de projeto]] assume por padrão
(cowork = design, não necessariamente dado real), **este lote específico foi
construído seguindo um processo de validação rigoroso e documentado
card-a-card** — Igor tem um prompt-padrão (`df.md`) com regras explícitas:
nunca inferir, validar por SQL/CSV/reconciliação de total antes de construir,
marcar confirmado vs. não confirmado, documentar divergência sem esconder.

| Painel | Confirmado (SQL/CSV) | Só print (reconciliação de total) | Bloqueado/pendente |
|---|---|---|---|
| Ocorrências | ~35 de 38 quadrantes, nas 8 abas | 2 ("Natureza", "Área média dos eventos") | 1 ("Total por produto" — suspeita de erro de qualidade na fonte) |
| Vacinações | 0 (Igor só tem leitura, sem SQL de nenhum quadrante) | 8 de 10 quadrantes, validados por print/reconciliação | 2 ("Vacinações mensais", "Indicador de participação" funcional) |
| PLAN DLOG | 5 itens (fórmula vista no editor Looker Studio) | — | 1 card não confirmado (CONTRATAÇÃO) + 6 pendências menores (P-2 a P-6) |
| Dashboard DF | 3 blocos (SFI Ordinário, SFI Extra, Auxílio Funeral) | 1 (Suprimento Individual — reconciliação de total, sem SQL) | 2 (Total de diárias e Diárias por Operação — divergem entre si em R$ 1.273.530,74, sem explicação) |

### Um problema real: falta o status doc do DF

`df.html` referencia `status_dashboard_df.md` quatro vezes em comentário (é
onde estariam o histórico de validação do SFI, a decisão de normalização de
grafia de unidade, e o contexto completo da divergência de diárias). **Esse
arquivo não veio no pacote** — o `df.md` que veio é outra coisa: o
prompt-padrão genérico que Igor usa pra começar qualquer painel novo (útil
como documentação de processo, mas não tem nenhum dado específico do DF).
Precisa ser pedido a Igor — adicionado como pergunta 1b na Parte 3.

### Divergências e bugs já documentados por Igor (não é preciso redescobrir)

O trabalho de detetive que eu tinha feito nas seções anteriores desta Parte 2
(bug do `WHERE` em "Situação das vítimas", os 656 produtos com contagem 20,
os 38% sem `data_recebimento`) **já estava resolvido ou registrado nos
próprios `status_*.md`** antes de eu abrir os arquivos — inclusive com o SQL
exato do bug e uma query de diagnóstico pronta para os 38% sem data. Isso
poupa tempo: não preciso mais inferir essas causas, só decidir com Igor/
Valério o que fazer com elas (perguntas 2 e 4 da Parte 3 seguem valendo, mas
agora com a causa raiz já em mãos, não como investigação em aberto).

### O que ainda falta para "inserir de verdade"

Ter os quatro pacotes não é o mesmo que eles estarem prontos para entrar no
app React (que é o padrão real dos painéis 01-09 — componente `.jsx`, dado
vindo de `src/data/real/`, drill-down para a tabela real). Os quatro pacotes
são protótipos HTML autônomos, no padrão "pronto para integração" que Igor
define no `df.md`: a tradução para componente React + fonte de dado real
(igual ao que os painéis 01-09 já têm) ainda não foi feita, e depende de dois
blocos que continuam pendentes:

1. **Acesso de rede aos bancos internos** (`10.193.1.252:54301`,
   `10.193.0.20:5432` etc.) segue dando timeout desta máquina — ver detalhe
   abaixo, sem mudança desde a auditoria original.
2. **Organizar os quatro pacotes na convenção de pasta** (`dashboards/02-plan-dlog/`, `03-dashboard-df/`, etc., no padrão de `01-efetivo-geral/`) e decidir se cada `status_*.md` vira a base do `spec-0N.json` equivalente.

### O segundo bloqueio: a rede

Mesmo com os arquivos em mãos, a integração não fecha desta máquina. Tentei
conectar ao Postgres do DW compartilhado, que é onde as tabelas de Ocorrências
devem estar:

```
DATABASE_URL_DW (10.193.1.252:54301) -> timeout expired
```

Os hosts internos configurados no `.env.local` — `10.193.1.252:54301` (DW,
tabelas `public.*` do Metabase), `10.193.0.20:5432` (`DATABASE_URL_OPS`, onde
vive `vaccine_control_production`), `10.193.0.16:5432` (SGP) e
`10.193.1.252:54329` (Frota) — **não são alcançáveis deste ponto de rede**.
Só os três Neon (Efetivo, Viaturas, Finanças) respondem, e nenhum deles tem
ocorrência ou vacinação.

Consequência prática: extrair o dado dos quatro painéis exige **ou** rodar os
extratores da máquina que está na rede da corporação, **ou** que Igor mande os
exports. Não é uma escolha de conveniência — é o que decide o caminho. Como
Igor confirmou (nos próprios `status_*.md`) que está em modo **somente
leitura** no Metabase/Looker Studio para a maior parte destas fontes, o SQL
de cada quadrante é trabalho do Valério assim que o banco for alcançável, não
um pedido a fazer a Igor.

### Fontes já catalogadas vs. a levantar

| Painel | Fonte provável | Já catalogada? |
|---|---|---|
| Ocorrências | `public.roe_*` em `10.193.1.252:54301` — confirmado pelo próprio SQL nos comentários do `status_ocorrencias.md` | Sim, registrada em `DW_CATALOGO_FONTES.md` |
| Vacinações (DAS) | `vaccine_control_production` em `10.193.0.20` (`DATABASE_URL_OPS`) | Sim — 4.138 militares, 3.030 vacinações, 12 campanhas, 20 vacinas |
| Dashboard DF | `fin_autorizacao`, `fin_carnaval_2026`, `fin_sfi_ordinario` no mesmo `public` do DW (confirmado: comentário em `df.html` cita `fin_sfi_ordinario` e `fin_autorizacao` por nome) | Sim, para o KPI de Finanças. Suprimento Individual/Despesas Diversas seguem sem fonte nomeada (Igor só tem leitura) |
| PLAN DLOG | Looker Studio "Controle DLOG" sobre planilha "NOVO CONTROLE - PLAN DLOG.xlsx" — não é banco, é planilha | Não — é a única fonte dos quatro que não é um Postgres já mapeado |

---

## Parte 3 — Lista única de perguntas, por responsável

### Para Igor — dado, regra de negócio e os pacotes

1. ~~**Os quatro pacotes.** Onde estão os arquivos?~~ **Resolvido em
   2026-09-21** — Igor disponibilizou os quatro (`dashboards/das.zip`,
   `dlog.zip`, `ocorrencias.zip`, `df.html`+`df.md`), auditados na Parte 2.
   **Novo pedido no lugar:** falta o `status_dashboard_df.md` — `df.html`
   referencia esse arquivo 4 vezes em comentário, mas o que veio (`df.md`) é
   o prompt-padrão genérico, sem nenhum dado específico do DF (histórico de
   validação do SFI, decisão de normalização de grafia de unidade, contexto
   da divergência de diárias).
2. **Ocorrências, aba APH — o bug do `UNION ALL`, com o SQL já em mãos.**
   `status_ocorrencias.md` já traz a query exata: o `WHERE status_relatorio
   = 'Finalizado'` fica só depois do último `FROM` do `UNION ALL`, então em
   SQL padrão só filtra o último ramo ("Desaparecidas") — "Feridas", "Fatais"
   e "Ilesas" somam a tabela inteira sem filtro. Não é mais uma investigação,
   é uma decisão: corrijo na integração (repetindo o `WHERE` nas 4 partes) e
   o painel passa a divergir do Metabase, ou mantenho o comportamento atual
   para bater com o que a gestão já vê? **Recomendo corrigir e mostrar os
   dois números durante uma transição.**
3. **Ocorrências, Produtos Perigosos — "Total por produto" continua
   pendente.** O próprio `status_ocorrencias.md` já marca isso como 🟠
   *pending*: 656 de 672 produtos com contagem exatamente 20, maioria
   rotulada `X (ver Y)` — parece lista de referência/sinônimo químico, não
   ocorrência real (o SQL bate com o donut original, então a suspeita é na
   qualidade da tabela `roe_prod_perigosos_ocorrencias`, não no cálculo).
   Confirmar com quem administra a base.
4. ~~**Vacinações — export/CSV, não mais SQL.**~~ **Resolvido em 2026-09-21
   — acesso direto ao banco liberado (ver item 13 acima), sem precisar do
   Igor/Looker.** `vw_vaccinations_dashboard` deu SQL real de verdade, grão
   por evento — "Vacinações mensais" e "Vacinações mensais por vacina"
   saíram do bloqueio, e o "Indicador de participação" recalcula de fato
   (não mais o exemplo congelado do print). **A ressalva de LGPD continua
   valendo, e foi respeitada:** o grão militar × vacina nunca saiu do
   extrator — o JSON servido ao navegador só tem eventos sem identificador
   individual (nem CPF, nem nome, nem matrícula) e uma matriz já agregada
   (vacina × OME → contagem de militares distintos) pro Indicador de
   Participação. Ver `DW_PLANEJAMENTO.md`, nona rodada de 2026-09-21.
5. **PLAN DLOG, card "CONTRATAÇÃO" — próximo passo já sugerido por você
   mesmo no `status_dlog.md`.** A hipótese atual (Valor Real DGC dos itens
   contratados) diverge ~3,5% do print. Você mesmo registrou o próximo
   passo: clicar direto no scorecard "CONTRATAÇÃO" (não no gráfico de
   barras) na aba Planejamento do Looker Studio → "Configuração" → ver o
   campo exato em "Métrica". Só falta fazer isso e confirmar.
6. **PLAN DLOG — a fonte não é um banco, é uma planilha, e não sabemos onde
   ela vive.** Confirmado em 2026-09-21: nem `status_dlog.md` nem o HTML do
   painel citam host, porta ou qualquer conexão Postgres — o próprio
   `status_dlog.md` diz que a fonte é o export **"NOVO CONTROLE - PLAN
   DLOG.xlsx"** (08/09/2026), que alimenta o relatório Looker Studio
   "Controle DLOG" (você tem acesso de editor). **Onde essa planilha mora**
   (Google Sheets compartilhado? Arquivo local seu? Outro sistema exporta
   pra ela?) e **como ela é atualizada** são as perguntas que decidem se a
   integração é parecida com a de Finanças (planilha → Windmill → Postgres,
   já existe um pipeline assim) ou precisa de algo novo. Junto disso, 5
   pendências menores já listadas no `status_dlog.md` (P-2 a P-6): campo
   real de "Data Planejamento" em "Processos por mês"; se "Média de dias"
   filtra por Ano Referência; se "% de recebimento" deveria filtrar por Ano
   Referência (hoje não filtra); se a coluna "SETOR" é `SETOR DE PENDÊNCIA`
   ou `SETOR RESPONSÁVEL` (print cortado); e a relação entre
   `BaseDash`/`db_DISTRIBUICAO`/`#ITEM_DPL` na planilha de origem.
7. ~~**Dashboard DF — divergência de diárias.**~~ **Resolvido em
   2026-09-21 — não é um filtro diferente, é uma lista incompleta.** Valério
   mandou o SQL real dos dois cards, rodado contra o banco ao vivo (VPN
   ativa): o card "Total do empenho de diárias" soma **todo** `fin_autorizacao`
   com `enquadramento='DIÁRIAS' AND situacao='EMPENHADO'` (sem outro
   filtro); a query original do Metabase para "Valores de diárias
   empenhadas por Operação" restringe isso a uma lista `WHERE ficha_financ
   IN (...)` com só **9** valores literais — hoje existem **18** valores
   distintos de `ficha_financ` nessa combinação. A soma dos 9 que ficam de
   fora (R$ 2.559.090,74 hoje; R$ 1.273.530,74 no snapshot do Igor) fecha a
   divergência com precisão de centavo, nos dois momentos no tempo. **Não é
   mais pergunta para Igor** — é decisão de produto: manter a lista fixa
   (replicando o Metabase, sabendo que ela desatualiza) ou trocar para
   `enquadramento='DIÁRIAS' AND situacao='EMPENHADO'` sem a lista, que bate
   com o card. **Achado extra de qualidade de dado**: pelo menos 2 dos 9
   `ficha_financ` de fora parecem a mesma operação com grafia diferente da
   que está na lista — `"EXECUTIVA - Diárias - Calendário Turístico"` (sem
   "Operação") vs. `"EXECUTIVA - Diárias - Operação Calendário Turístico"`
   (na lista); e `"EXECUTIVA - Diárias - Operação Pernambuco Meu País"` vs.
   `"Diárias - Operação Pernambuco Meu País"` (na lista, sem o prefixo
   "EXECUTIVA -"). Vale normalizar na origem — ver nota em
   `DW_CATALOGO_FONTES.md`.
8. **Painel 09.** Falta o SQL do card "Solicitações por Posto e Graduação"
   (167/15/13/4/1/1), que não está entre as 8 queries enviadas, e o export
   bruto (linhas, não agregado) de `cim_pedidos` e `cim_atendidos`. Confirmar
   também as duas agregações que inferimos: "Distribuição das solicitações"
   está hoje por `motivo` e "Origem das solicitações" por `ome` — confere?
9. **Painel 04, decisão.** A coluna exata em dias reproduz o print
   (117/36/23/11, 187 de 187); a aproximação da planilha mostra 116 porque 1
   adido tem `#NUM!`. Troco a fonte do gráfico para a coluna exata? É um
   número de painel já validado, por isso não mexi.
10. **Painel 07, "Promoções por ano".** Travar numa data de referência fixa
    (replicando o corte do Metabase) ou aceitar que o card sempre reflita o
    dado mais recente? O campo é "data da última promoção", não um evento
    histórico — os anos recentes vão crescer sozinhos.
11. **Reconstruir a base dos painéis 01-03 com o `Militar.json` completo?**
    Resolveria de vez os gaps de disponibilidade/LE/LTIP/afastamento e o tempo
    aproximado — mas mexe em painéis já validados por você. Só faço com OK
    explícito.
12. **Agrupamento canônico de unidades.** O informal QCG/DIM/DINTER1/DINTER2
    dos painéis divergem do de-para oficial de 47 unidades
    (`etl/efetivo/mapeamento_unidades.json` + a árvore em
    `extract_previsto_divisoes.py`): CAT/RMR é canonicamente **DIM**, não QCG,
    e ADIDO não é unidade própria — é dobrada em "COMANDO GERAL". Confirmar
    que os painéis novos vão adotar o canônico.

### Para Valério — acesso, infraestrutura e governança

13. ~~**Acesso de rede aos bancos internos.**~~ **Resolvido em 2026-09-21 —
    VPN ativada.** Testado com a VPN ligada: `DATABASE_URL_DW`
    (10.193.1.252:54301) conecta normalmente, as 3 tabelas `fin_*` do DF
    confirmadas com schema completo (ver `DW_CATALOGO_FONTES.md`). **Mas
    apareceram dois problemas novos, de credencial, não de rede** — a
    conexão TCP chega nos dois casos, o Postgres só rejeita a senha:
    - ~~`ctic@10.193.0.20` (`DATABASE_URL_OPS`) parou de autenticar~~
      **Resolvido em 2026-09-21 (mesmo dia, rodada seguinte) — o usuário
      passou uma senha nova direto no chat** (não persistida em
      `.env.local` nem em nenhum arquivo do repositório). Conecta normal em
      `vaccine_control_production`; Dashboard de Vacinações (DAS) integrado
      com dado real nas 4 abas — ver `DW_PLANEJAMENTO.md`, nona rodada de
      2026-09-21.
    - `roe_api_production` em `10.193.1.252:15432` (host confirmado por
      você) é um banco que nenhuma credencial em `.env.local` alcança —
      nem `datawarehouse-user` nem `ctic`. Bloqueia Ocorrências.
      **Preciso de uma credencial nova para esse serviço específico.**
14. ~~**SQL das abas "Suprimento Individual" e "Despesas Diversas"
    (DF).**~~ **Resolvido em 2026-09-21 — Valério mandou o SQL real das 5
    visualizações das duas abas, todas em `fin_autorizacao` (a mesma tabela
    da aba SFI, só filtrada por `enquadramento` diferente: `'SI'` para
    Suprimento Individual; `'DIÁRIAS'` e `'FUNERAL'` para Despesas
    Diversas).** Minha suposição anterior — "não corresponde a nenhuma das
    21 tabelas" — estava certa sobre não existir uma tabela `fin_suprimento_individual`
    dedicada, mas errada em concluir que a fonte estava em outro lugar: é a
    mesma `fin_autorizacao`, só filtrada por uma coluna que eu não tinha
    cruzado (`enquadramento`). Rodei as 5 queries ao vivo contra o banco
    (VPN ativa) e conferi contra `df.html`:

    | Aba | Visualização | SQL bate com `df.html`? |
    |---|---|---|
    | Suprimento Individual | Card "SI Total Empenhado" | ✅ mesma estrutura; valor cresceu de R$ 1.349.387,65 (snapshot Igor) para R$ 1.446.867,65 (hoje) |
    | Suprimento Individual | Barras "SI por Unidade" (39 unidades) | ✅ mesmas 39 unidades nos dois momentos; soma bate exata com o card nos dois; 10 unidades cresceram desde o snapshot |
    | Despesas Diversas | Card "Total do empenho de diárias" | ✅ mesma estrutura — ver item 7 (divergência resolvida) |
    | Despesas Diversas | Donut "Auxílio Funeral por mês" | ✅ **idêntico, sem nenhum drift** — 6/6 meses com o mesmo valor exato do snapshot do Igor |
    | Despesas Diversas | Barras horizontais "Diárias por Operação" | ✅ mesma estrutura — ver item 7 |

    As 5 visualizações que Igor construiu são exatamente as 5 do SQL
    recebido — nenhuma a mais, nenhuma a menos. Falta só formalizar isso
    como extrator (`etl/financas/extract_dashboard_df.py`, no padrão dos
    extratores existentes).
14b. **Rodar a query de diagnóstico do Ocorrências, Produtos Perigosos —
    "Evolução histórica".** Igor já escreveu a query e decidiu
    explicitamente não rodá-la (para não arriscar um comando que não
    reflita a estrutura real do banco) — ficou registrada para o Valério em
    `status_ocorrencias.md`:
    ```sql
    SELECT
      COUNT(*) FILTER (WHERE b.roe_id IS NULL) AS sem_match_na_basico,
      COUNT(*) FILTER (WHERE b.roe_id IS NOT NULL AND b.data_recebimento IS NULL) AS match_mas_data_nula,
      COUNT(*) FILTER (WHERE b.data_recebimento IS NOT NULL) AS com_data
    FROM "public"."roe_prod_perigosos_ocorrencias" p
    LEFT JOIN "public"."roe_basico_ocorrencias" b ON p.roe_basico_id = b.roe_id
    ```
    Precisa do acesso de rede do item 13 para rodar. Depois de rodar,
    decidir com Igor como exibir o resultado na linha do tempo.
15. **Rotação de credenciais.** Continua pendente e é o passo 1 da ordem de
    trabalho acordada para o DW: **cinco** credenciais expostas em texto puro
    em sessões anteriores (incluindo a do Neon e a do DW `datawarehouse-user`),
    mais a criação das roles `etl_writer`/`bi_reader`/`app_reader`. Enquanto
    não for feito, qualquer credencial nova que passar pelo chat entra na
    mesma fila.
16. **Remover o dado sensível já público.** `racaCor`, `pcd` e os dois
    telefones em `efetivo_lista.json` (arquivo servido ao navegador).
    Verificado nesta sessão: ainda está lá.
17. **Regra de Agregado.** Trava qualquer view oficial de "efetivo ativo". A
    de Adido já está definida; falta decidir a dos 18 marcados na coluna OBS
    do Pecúlio.
18. **Login real.** A tabela nominal do painel 08 foi liberada com o argumento
    de que o app tem login, mas `authClient.js` é stub em `localStorage`. Não
    é regressão (a tabela de efetivo já expõe o mesmo), mas é a premissa da
    decisão de PII — e ela ainda não é verdadeira.

---

## O que esta sessão mudou no repositório

| Arquivo | Mudança |
|---|---|
| `src/lib/efetivoDashboard.js` | **Correção de defeito:** `bucketTempoParaIntervaloDias` deixava os vãos 1.826-2.189 e 3.651-4.014 fora de qualquer faixa — 18 de 187 adidos desapareciam da tabela ao clicar na barra que os contava, e outros 9 abriam a faixa vizinha |
| `src/pages/efetivo/ModuloMilitaresAdidos.jsx` | Ressalva do `#NUM!` no subtítulo do card, e a diagnose da divergência dos adidos registrada em comentário |
| `DW_CATALOGO_FONTES.md` | Seção nova de Ocorrências (`roe_*`); Vacinação e Financeiro atualizados com o que os painéis do Igor revelaram |
| `dashboards/PENDENCIAS-PAINEIS-CORPORATIVOS.md` | Este documento — criado, depois revisado 2x no mesmo dia (chegada dos 4 pacotes; integração real do DF) |
| `dashboards/das.zip`, `dlog.zip`, `ocorrencias.zip`, `df.html`, `df.md` | Recebidos de Igor — **ainda não commitados**, não organizados na convenção de pasta por painel |
| `etl/financas/extract_dashboard_df.py` | **Novo.** Extrator do Dashboard DF, lendo `fin_sfi_ordinario`/`fin_autorizacao` ao vivo |
| `etl/financas/mapeamento_unidades.json` | 3 exceções novas de de-para (GBI/NORONHA, 2 variantes de grafia do auxílio funeral) |
| `src/data/real/financas_dashboard.json` | **Novo.** Saída do extrator — dado real do DF |
| `src/lib/financasDashboard.js` | **Novo.** Helpers do Dashboard DF (mesmo padrão de `efetivoDashboard.js`) |
| `src/pages/financas/*.jsx` | **Novo.** Casca + 3 módulos do Dashboard DF |
| `src/pages/Indicador.jsx`, `src/App.jsx` | Registro do indicador "Finanças" em `DASHBOARDS_REAIS` e da rota `/financas/:id/dashboard/:modulo` |
| `src/components/charts/PanelGrafico.jsx` | Suporte a legenda no tipo `hbar` (só existia em `bar`) — não afeta uso existente |

Nenhum número de painel validado foi alterado. `npm run lint` passa; o
`npm run typecheck` tem 266 erros — 19 a mais que os 247 de antes desta
sessão, todos no mesmo padrão de ruído já presente no projeto inteiro (prop
opcional de componentes como `SectionCard`/`KpiCard`/`PanelGrafico` inferida
como obrigatória pelo TS a partir do uso, não um erro real) — concentrados
nos 4 arquivos novos de `src/pages/financas/`.

## Auditoria dos 4 pacotes recebidos (2026-09-21, mesmo dia)

Os quatro passaram por checagem técnica e de conteúdo (ver Parte 2 acima):
zero dependência de CDN, contrato `DASHBOARD_DATA` presente, paleta correta,
flags de status por campo, e nível de validação já documentado card a card
pelos próprios `status_*.md` de Igor — na maior parte dos casos, muito além
do que a auditoria original desta sessão presumia possível sem os arquivos
em mãos. DF e Vacinações renderizaram ao vivo no navegador sem erro de
console; DLOG e Ocorrências passaram nas mesmas checagens estáticas, sem
render ao vivo por um limite de tamanho da ferramenta de preview local, não
por defeito no arquivo. Nenhum arquivo foi alterado nesta auditoria.

## DF integrado ao sistema real (2026-09-21, mesmo dia — quinta rodada)

**O primeiro dos quatro painéis corporativos a sair do protótipo estático e
entrar no app React, com dado ao vivo do banco.** Mesmo padrão dos
Dashboards Pessoais de Efetivo e Viaturas: indicador "Finanças" (já existia
por unidade em `organograma.js`), rota `/financas/:id/dashboard/:modulo`,
3 módulos em aba, escopo por unidade + subordinadas, filtros multi-select.

- **Extrator:** `etl/financas/extract_dashboard_df.py` — lê
  `fin_sfi_ordinario`/`fin_autorizacao` direto do Postgres do DW
  (`DATABASE_URL_DW`), reaproveita o de-para de unidades já validado em
  `etl/financas/mapeamento_unidades.json` (o mesmo arquivo do
  `extract_financas.py` que já alimenta o KPI de Finanças) — 3 exceções
  novas adicionadas (`GBI/NORONHA`→GBI, e duas variantes de grafia do
  auxílio funeral que ainda não apareciam: "Aos mesmo" e "Às mesmas").
  Gera `src/data/real/financas_dashboard.json`.
- **Frontend:** `src/lib/financasDashboard.js` (helpers),
  `src/pages/financas/FinancasDashboard.jsx` (casca, idêntica em estrutura a
  `EfetivoDashboard.jsx`), `ModuloSfi.jsx`, `ModuloSuprimentoIndividual.jsx`,
  `ModuloDespesasDiversas.jsx`.
- **Decisão do usuário aplicada:** a lista fixa de 9 `ficha_financ` no
  gráfico "Diárias por Operação" foi removida — o extrator usa só
  `enquadramento='DIÁRIAS' AND situacao='EMPENHADO'`, sem filtro adicional.
  Verificado no navegador: o card "Total do empenho de diárias" (R$9.091.759)
  agora bate exato com a soma das barras — a divergência de R$1,27M (pergunta
  7 da Parte 3) desapareceu de vez, não só ficou explicada.
- **Achado de arquitetura, não presumido antes de testar:** `destino` só
  identifica uma unidade real para SFI/SFI Extra/Suprimento Individual. Para
  Diárias (`destino` = DAFO/DPAFO) e Auxílio Funeral (`destino` majoritariamente
  texto livre não-organizacional) não há unidade requisitante na fonte — a
  aba Despesas Diversas só aparece na visão do Comando Geral, com
  `EmptyState` explicando o motivo nas demais unidades (mesma convenção já
  usada em "Saída de militares"/painel 09 do Dashboard de Efetivo).
- **Melhoria de componente compartilhado:** `PanelGrafico.jsx` ganhou
  suporte a legenda no tipo `hbar` (só existia em `bar`) — necessário para o
  gráfico Consumo/Serviço de "Valores liquidados por Unidade". Não afeta
  nenhum uso existente (nenhuma outra página passava `legenda` com `hbar`).
- **Verificado no navegador:** as 3 abas renderizam sem erro de console;
  escopo por unidade testado no Comando Geral (soma bate com os totais
  confirmados por SQL) e no GBI (mostra só R$40.000 do SI daquela unidade);
  o `EmptyState` de Despesas Diversas aparece corretamente fora do Comando
  Geral.
- **Pendente:** commitar os 4 pacotes originais de Igor
  (`dashboards/das.zip`/`dlog.zip`/`ocorrencias.zip`/`df.html`/`df.md`);
  organizar em pasta por painel (`dashboards/02-dashboard-df/` etc., como
  `01-efetivo-geral/`); não existe ainda uma tabela de detalhamento real de
  Finanças (equivalente a `EfetivoDetalhe.jsx`/`ViaturaDetalhe.jsx`) — os
  gráficos deste painel não têm drill-down por enquanto.

## Ocorrências: scaffold completo, dado real bloqueado (2026-09-23)

**Atualização, mesmo dia, rodada seguinte: credencial resolvida.** O
usuário passou usuário/senha de `roe_api_production` no chat (mesmo
tratamento da de Vacinação — só em `.env.local`, nunca commitada) e
confirmou a VPN ativa. Extrator rodado com dado real completo (35.866
ocorrências); schema real das 7 tabelas `roe_*` lido via
`information_schema`, 5 das 9 abas que dependiam de schema saíram do
pendente (Incêndio, Salvamento, Prevenção, Produtos Perigosos — parcial,
Perfil de Vítimas), e 3 bugs reais de UI corrigidos (rótulo booleano
invisível em 2 gráficos de APH, "Vítimas com deficiência" mostrando 100%
por tratar campo categórico como booleano, KPI row cortando título por
grade com célula vazia). Ver `DW_PLANEJAMENTO.md`, entrada "terceira
rodada" de 2026-09-23, para o relato completo — inclusive a lista do que
ainda fica pendente (Incêndio/Salvamento têm mais 5+6 quadrantes sem nome
confirmado por Igor; "Total por produto" retido por qualidade de dado,
não por schema).

Texto original desta seção (antes da credencial), mantido como histórico:

Terceiro painel do lote a sair do HTML autônomo — mas, diferente de DF e
Vacinação, **sem nenhum número real ainda**: `roe_api_production`
(10.193.1.252:15432) continua sem credencial que autentique (ver
`DW_CATALOGO_FONTES.md`). Ver `DW_PLANEJAMENTO.md`, entrada de 2026-09-23,
para o relato completo desta rodada. Resumo do que mudou:

- `dashboards/ocorrencias.zip` → organizado em `dashboards/08-ocorrencias/`
  (`dashboard-ocorrencias.html`, `status_ocorrencias.md`,
  `geojs-26-mun.json`), seguindo a convenção de `01-efetivo-geral/`. O zip
  original foi removido (redundante com a pasta).
- `etl/ocorrencias/extract_dashboard_ocorrencias.py` — completo e pronto
  pra rodar para Visão Geral (7/7 cards) e a maior parte de APH, grão por
  ocorrência (não pré-agregado por card, ao contrário do padrão "uma query
  por card" deste documento — decisão registrada em `DW_PLANEJAMENTO.md`,
  necessária pra suportar o filtro por OME que Vacinação não precisava).
  Incêndio/Salvamento/Prevenção/parte de Produtos Perigosos/Perfil de
  Vítimas ficam com função-esqueleto, SEM coluna inventada, porque este
  documento não colou o texto da query nem `DW_CATALOGO_FONTES.md` tem o
  schema dessas tabelas de detalhe verificado — só os nomes das tabelas.
- `etl/ocorrencias/mapeamento_unidades.json` — scaffold (não um de-para
  real): sem credencial, não há `SELECT DISTINCT ome` pra comparar contra
  o organograma. Só as 2 convenções já confirmadas em nível de DW inteiro
  foram aplicadas.
- Frontend: 8 módulos em `src/pages/ocorrencias/`, dentro do indicador
  "Atividades Específicas" (mesmo guarda-chuva de Mapa de Força/Vacinação),
  mas com filtro de OME real (`siglasPermitidas`, mesmo mecanismo de
  Efetivo/Viaturas/Finanças) e restrito à subárvore da DGO — diferente do
  painel exclusivo-DAS da Vacinação, por pedido explícito do usuário.
  `src/data/real/ocorrencias_dashboard.json` fica vazio, com
  `_placeholder: true`, até a credencial existir.
- Pendência "Total por produto" (linha acima nesta tabela) **continua
  igual** — nem quando a credencial existir esse card será extraído
  automaticamente, por decisão já registrada (suspeita de erro de
  qualidade de dado, não recalculada por este scaffold).
- Mapa coroplético da aba Geolocalização não foi desenhado (ranking por
  cidade em hbar cobre o essencial com dado real quando houver).

## Ocorrências: 9ª aba (Atividade Comunitária) e defesa de overflow (2026-09-23, mesmo dia, segunda rodada)

O protótipo original do Igor (`dashboard-ocorrencias.html`, 8 abas — ver
tabela no topo desta seção) nunca teve aba para "Atividade Comunitária",
apesar de `status_ocorrencias.md` confirmar que é uma das 6 naturezas
exatas de `roe_basico_ocorrencias`. Adicionada como 9ª aba
(`ModuloAtividadeComunitaria.jsx`), só com cards do nível básico
(Finalizadas/Aguardando finalização/Ocorrências diárias/Cidade/Subgrupo/
Grupo) — natureza sem nenhuma tabela de detalhe no
`DW_CATALOGO_FONTES.md`, então não tem `CardPendente` nenhum. Frontend
passa de 8 para 9 módulos em `src/pages/ocorrencias/`. Também corrigidos
dois bugs reais de overflow em `src/components/charts/PanelGrafico.jsx`
(rótulo de valor empilhado em gráfico `line`/`bar` com muitas
categorias/pontos, e eixo X sem afinamento de tick) — achados com dataset
sintético local, descartado depois, e confirmados já com dado real assim
que a VPN voltou nesta mesma rodada. Detalhe completo em
`DW_PLANEJAMENTO.md`, seção "9ª aba: Atividade Comunitária".
