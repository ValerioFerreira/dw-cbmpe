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

| Sistema/Fonte | Tipo | Formato de acesso | Responsável | Frequência | Sensibilidade | Status |
|---|---|---|---|---|---|---|
| A LEVANTAR | A LEVANTAR | A LEVANTAR | A LEVANTAR | A LEVANTAR | A LEVANTAR | A confirmar |

## Efetivo / RH

| Sistema/Fonte | Tipo | Formato de acesso | Responsável | Frequência | Sensibilidade | Status |
|---|---|---|---|---|---|---|
| SGP (Sistema de Gestão de Pessoal), schema `ovrsgp` | Sistema interno | Acesso direto a banco (Postgres, schema `ovrsgp`) — host/credenciais/alcance de rede pro Windmill a levantar | A LEVANTAR | A LEVANTAR | Misto — PII pesado + dado sensível (saúde), ver escopo proposto em `DW_MODELO_DADOS.md` | Escopo de entidades proposto (a confirmar campo a campo); conexão e frequência a levantar. Ficha `/militar/:matricula` — Caminho A (público, só não sensível, lido da base Neon) implementada 2026-08-19; Caminho B (ficha completa do SGP) engatilhado, aguarda conexão ao SGP + autenticação real — allowlist/denylist em `DW_GOVERNANCA.md`, mapa de blocos em `DW_MODELO_DADOS.md` |
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

## Atividades Operacionais

| Sistema/Fonte | Tipo | Formato de acesso | Responsável | Frequência | Sensibilidade | Status |
|---|---|---|---|---|---|---|
| A LEVANTAR | A LEVANTAR | A LEVANTAR | A LEVANTAR | A LEVANTAR | A LEVANTAR | A confirmar |

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
