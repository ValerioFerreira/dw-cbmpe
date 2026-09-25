# DW CBMPE — Como o dado chega ao sistema, e como deve chegar

> Levantamento feito em 2026-09-25, a pedido do usuário ("verifique todas as
> formas que todos os dados que o sistema já possui chegam/chegaram ao
> sistema, e estabeleça as diretrizes para que tudo seja corretamente
> colocado no banco, e que o sistema seja conectado ao banco do DW").
> Tudo marcado como **medido** foi conferido direto no banco/código nesta
> data; o resto é leitura dos scripts e dos demais `DW_*.md`.
>
> Documentos relacionados: [`DW_ARQUITETURA.md`](DW_ARQUITETURA.md) (camadas),
> [`DW_ETL.md`](DW_ETL.md) (Windmill), [`DW_CATALOGO_FONTES.md`](DW_CATALOGO_FONTES.md)
> (hosts/credenciais por fonte), [`DW_GOVERNANCA.md`](DW_GOVERNANCA.md) (PII),
> [`DW_PROCESSO_INTEGRACAO.md`](DW_PROCESSO_INTEGRACAO.md) (fonte nova).

## 1. Resumo: hoje o dado chega por quatro caminhos, e só um deles é o DW

| # | Caminho | O que passa por ele | Problema |
|---|---|---|---|
| A | **Extrator Python → JSON em `src/data/real/` → embutido no bundle do app** | Quase todos os números do app (Efetivo, Viaturas, Finanças, Vacinação, Ocorrências, QOD, Lotação, painéis de Efetivo) | Rodado **à mão**, sem agenda. O JSON vai dentro do JavaScript que o navegador baixa **antes do login** — inclusive dado nominal. Cada extrator lê uma origem diferente (Neon, fonte original, banco `postgres`, planilha local), e só alguns passam pelo DW |
| B | **Extrator Python → `public/dados/`, baixado pelo app sob demanda** | Mapa de Força (1 arquivo por dia) | Já lê do DW, mas `public/` é servido sem autenticação — a guarnição é nominal |
| C | **Backend Node (`backend/`) consultando ao vivo** | Login (SGU), CPF → matrícula (SGP), matrícula → OME (`dw.core`), nome/CPF no /adm (SGP) | É o único caminho autenticado. Usa o **superusuário** do DW |
| D | **Hardcoded / fictício no código** | Chefes das unidades, divisões internas, séries históricas, alertas, Materiais, Atividades Específicas, métricas de unidades sem dado | Não é dado: é protótipo de UI. Precisa ser trocado por fonte real ou marcado "Em construção" |

A meta é ter um caminho só: **fonte → DW (`raw` → `stg` → `core` → `marts`) →
backend (API autenticada) → app.** O resto deste documento detalha o inventário
e as regras para chegar lá.

## 2. Inventário, dado por dado

### 2.1 Dado real que o app exibe hoje (caminho A/B)

| Arquivo no app | Gerado por | Lê de | Passa pelo DW? | Última atualização / frequência |
|---|---|---|---|---|
| `efetivo.json`, `efetivo_lista.json` | `etl/efetivo/extract_efetivo.py` | **Neon** `Militar` ← Windmill `apps/peculio_para_metabase_e_neon.py` ← planilha Google do Pecúlio | Não (o DW tem a mesma planilha em `raw_peculio`, carregada à parte) | Manual |
| `efetivo_previsto.json` | `etl/efetivo/extract_previsto.py` | **Arquivo `.xlsx` local** do QOD (passado na linha de comando) | Não | Manual, por arquivo recebido |
| `efetivo_previsto_divisoes.json` | `etl/efetivo/extract_previsto_divisoes.py` | Mesmo `.xlsx` do QOD + `SUBSETORES` de `src/data/organograma.js` | Não | Manual |
| `lotacao_funcao.json` | `etl/efetivo/extract_lotacao_funcao.py` | QOD publicado (link Google, `.xlsx`) ou arquivo local | Não | Manual |
| `efetivo_dashboard/intencao_movimentacao.json` | `etl/efetivo/extract_intencao_movimentacao.py` | Banco `postgres`, `public.cim_pedidos`/`cim_atendidos` (carregados de planilha por terceiro — Igor/Metabase) | Não (mesmo servidor, **outro banco**) | Manual |
| `efetivo_dashboard/saida_previsao.json` | `etl/efetivo/extract_saida_previsao.py` | Banco `postgres`, `public.inativos_metabase` + `peculio_metabase_v1` | Não | Manual |
| `efetivo_dashboard/{militares,filtros,adidos_extra,carreira_extra,previsto}.json` | derivados do efetivo (ver `DW_PLANEJAMENTO.md`, 2026-08-19) | Neon `Militar` | Não | Manual |
| `efetivo_dashboard/municipios_pe.json` | `etl/_geo/baixar_malha_ibge.py` + `projetar_municipios.py` | API de malhas do IBGE | Não (dado de referência) | Pontual |
| `viaturas.json`, `viaturas_lista.json`, `viaturas_detalhe.json` | `etl/viaturas/extract_viaturas.py` (+ `mapa_forca/reconciliar_viaturas.py`) | **Neon** `Viatura` ← Windmill `apps/frota_para_neon.py` ← sistema de Frotas | Não (o DW lê a Frota direto em `raw_frota`) | Manual |
| `financas.json` | `etl/financas/extract_financas.py` | **Neon** `FinancaLancamento` ← `public.fin_*` ← planilha de Finanças | Não | Manual |
| `financas_dashboard.json` | `etl/financas/extract_dashboard_df.py` | Banco `postgres`, `public.fin_sfi_ordinario`/`fin_autorizacao` | Não (o DW tem a planilha em `raw_financas`, sem uso) | Manual |
| `vacinacao_dashboard.json` | `etl/das/extract_dashboard_vacinacoes.py` | Fonte original `vaccine_control_production` (10.193.0.20) | Não | Manual |
| `ocorrencias_dashboard.json`, `ocorrencias_municipios.json` | `etl/ocorrencias/extract_dashboard_ocorrencias.py` | Fonte original `roe_api_production` (10.193.1.252:15432) | Não | Manual |
| `public/dados/mapa-forca/*.json` (91 dias) | `etl/mapa_forca/extract_mapa_forca.py` | **`dw`** (`core.fato_lancamento_*`) | **Sim** | Manual |
| Insígnias (`public/insignias/`) | `etl/_geo/copiar_insignias.py` | Pasta de imagens recebida | — (arquivo estático) | Pontual |
| Coordenadas das OMEs | `etl/mapa_forca/coordenadas_postos.py`, KMZ, `etl/sgp/casar_coordenadas_ome.py` | KMZ + `ovrsgp.tb_ome` | Parcial — `--aplicar` nunca rodou (bloqueado pelo usuário) | Pontual |

### 2.2 Dado que o backend lê ao vivo (caminho C)

| Uso | Origem | Observação |
|---|---|---|
| Login | SGU (`SGU_URL`) | Só identidade; nada gravado |
| CPF → matrícula (+ nome) | SGP `ovrsgp.tb_pess` (`DATABASE_URL_SGP`) | Fonte original, não o DW — o DW não guarda CPF, de propósito |
| Matrícula → OME | `dw.core.fato_efetivo_diario` + `dim_ome` | **Único ponto em que o sistema já lê o DW ao vivo** |
| Nome + CPF na lista de usuários do /adm | SGP `ovrsgp.tb_pess` | Desde 2026-09-25; só administrador; nada persistido |
| Organograma editável | `backend/data/organograma.json` | Estado do app, fora de qualquer banco |
| Perfis de acesso | `backend/data/atribuicoes.json` | Idem |

### 2.3 Dado fictício ou hardcoded que ainda aparece (caminho D)

Tudo em `src/data/organograma.js`, salvo indicação:

| O quê | Situação | Fonte real candidata |
|---|---|---|
| Chefe/cargo de cada unidade (`OFICIAIS`) | Nomes fictícios "coerentes" | QOD/Lotação (quem ocupa a função de Comandante/Diretor/Chefe) ou SGP — **ver pergunta 3** |
| Divisões internas (`SUBSETORES`) | Lista curada à mão | `raw_sgp.tb_secao` (1.100 seções) / abas do QOD |
| `METRICAS` → `acoes`, `materiaisPct`, `financaPct` | Fictícios (efetivo, previsto, viaturas e finanças já são sobrepostos por real) | Materiais: fora de escopo (Fase 2). Atividades: por painel |
| `METRICAS_PADRAO` (unidade sem entrada) | Fictício | Deve virar zero/"sem dado", nunca inventado — já feito para o Estado-Maior Geral em 2026-09-25 |
| Séries históricas dos indicadores (`gerarSerie`) | Geradas por semente aleatória | `core.fato_*_diario` (efetivo e frota já têm série diária no DW) |
| Alertas (`ALERTAS_BASE`) | Fictícios, curadoria manual | Regras sobre `marts` (a definir com o gestor — Fase 3.5) |
| Atividades Específicas / painéis do Igor | Design validado card a card, dado parcial | Por painel (ver memória "Igor/Cowork não é dado real") |
| Estado-Maior Geral e 1º/2º/3º EMG | **"Em construção"** desde 2026-09-25 | — |

## 3. Estado do DW (medido em 2026-09-25)

Servidor `10.193.1.252:54301`, dois bancos:

- **`dw`** — o data warehouse de fato, no desenho de camadas:
  `raw_sgp`, `raw_escala`, `raw_mapa_forca`, `raw_frota`, `raw_reserva`,
  `raw_peculio`, `raw_financas` → `stg` (de-paras, log de carga) → `core`
  (15 dimensões + fatos: `fato_efetivo_diario`, `fato_frota_diaria`,
  `fato_lancamento_militar` ~900 mil linhas, `fato_lancamento_viatura`,
  `fato_averbacao`, `fato_previsao_reserva`…) → `marts` (10 views:
  `efetivo_por_ome`, `frota_por_ome`, `militar`, `emprego_*`, `adidos_por_orgao`,
  `qualidade_reconciliacao`, `tempo_reserva_por_militar`).
- **`postgres`** — **não é o DW**, apesar de estar no mesmo servidor. Schema
  `public` com tabelas de terceiros/Metabase (`fin_*`, `cim_*`,
  `inativos_metabase`, `peculio_metabase_v1`, `escolaridade_militares`) e um
  schema `dw_cbmpe` vazio (tentativa antiga). Quatro extratores do app leem
  daqui.

**Frescor** (`stg.carga`): só a planilha do **Pecúlio** está sendo recarregada
(última carga hoje, 2026-09-25 — daí o `fato_efetivo_diario` estar em dia).
**Todas as outras fontes pararam em 2026-08-24**: SGP, escala, mapa de força,
Frota, reserva e Finanças. Nada disso está agendado.

**Acesso**: existe **um único usuário**, `datawarehouse-user`, e ele é
**superusuário** — usado pelo ETL, pelo backend do app e por quem mais tiver a
credencial. Os papéis `etl_writer`/`app_reader`/`bi_reader` (pendência de
2026-08-24) ainda não foram criados.

**Fora do DW**: QOD (previsto e lotação), Vacinação, Ocorrências (ROE),
Intenção de Movimentação, Inativos. O DW também tem `raw_financas`, mas
nenhum painel lê dali.

## 4. Diretrizes

Regras para todo dado novo **e** para migrar o que já existe. Valem para
qualquer pessoa ou agente que mexer no projeto.

### D1. Todo dado entra pelo DW, pela ordem das camadas
Fonte → `raw_<fonte>` (cópia fiel, sem transformar) → `stg` (tipagem,
de-para, limpeza) → `core` (modelo integrado) → `marts` (contrato de leitura).
Nenhum extrator novo grava JSON em `src/data/real/` nem em `public/`. Regra de
negócio (filtros, agregações, "CPPA soma na DGP" etc.) mora em `stg`/`core`/
`marts` — nunca no extrator nem no front.

### D2. `raw` é cópia fiel, com rastro
Cada tabela `raw` leva `carga_id` e `extraido_em`, e **toda** carga registra
uma linha em `stg.carga` (fonte, tabela, início, fim, linhas, status). Sem
filtro, sem descarte de linha, sem "consertar" dado na extração — é isso que
permite reprocessar o passado quando uma regra mudar. Full refresh em
transação é o padrão; incremental só quando o volume pedir (ver `carga_raw.py`).

### D3. Ler a fonte original, nunca uma cópia intermediária
O DW lê o sistema de origem (SGP, Frota, mapa de força, ROE, vacinação…) ou a
planilha original — **nunca o Neon**, nem as tabelas do banco `postgres` que
terceiros alimentam, porque ambos já vêm transformados/recortados (motivo
detalhado em `etl/windmill/README.md`). Quando a fonte for planilha, ler o
**link publicado** (Google Sheets), não um arquivo solto na máquina de alguém;
arquivo local só em carga inicial, e o nome/versão do arquivo vai para
`stg.carga.observacao`.

### D4. Chaves únicas de integração
- **Militar**: matrícula normalizada (só dígitos) → `core.dim_militar`.
- **Unidade**: sigla/código da fonte → `stg.de_para_ome` → `core.dim_ome`. O
  organograma do app é a autoridade da hierarquia (`dim_ome_ancestral`).
- **Viatura**: placa / número de ordem normalizado → `stg.de_para_viatura` →
  `core.dim_viatura` (SCD2).
- **Tempo**: `core.dim_tempo`.
Fonte nova que não casa com essas chaves não entra no `core` até ter de-para.

### D5. Dado pessoal
CPF **não entra no DW** (é chave só de autenticação, consultada ao vivo no
SGP). Campos da denylist de `DW_GOVERNANCA.md` só em schema/papel restrito.
Dado nominal nunca vai para o bundle do front nem para `public/` — só sai pela
API, atrás de login e do perfil do usuário.

### D6. O app só lê `marts`, e só pelo backend
O front não importa mais JSON de dado. O backend expõe endpoints autenticados
(JWT do SGU) que consultam **só `marts`**, com o controle de acesso por perfil
aplicado **no servidor** (hoje ele é só visual, no navegador). Se um painel
precisar de algo que não está em `marts`, cria-se a view em `marts` — o
backend não consulta `raw`/`stg`/`core` nem a fonte original (exceção única:
autenticação/SGP, item 2.2).

### D7. Papéis de banco separados
- `etl_writer`: escreve em `raw_*`/`stg`/`core`/`marts`; usado só pelo Windmill.
- `app_reader`: `SELECT` em `marts` (+ o schema de estado do app, se aprovado —
  pergunta 2); usado só pelo backend.
- `bi_reader`: `SELECT` em `marts` para Metabase/Power BI.
O superusuário fica só para administração. As credenciais expostas em
2026-08-24 são rotacionadas junto com a criação dos papéis.

### D8. Toda carga é agendada e observável
Cada fonte tem um script no Windmill (`etl/windmill/dw/`) com frequência
registrada no catálogo; `carga_core.py` e `validar.py` rodam depois. Falha de
uma fonte não derruba as outras. O app mostra a data da última carga de cada
domínio (lida de `stg.carga` via backend), para ninguém confundir dado velho
com dado atual.

### D9. Sem número inventado na tela
Enquanto um indicador não tem fonte, ele aparece como **"Em construção"** —
nunca com valor de semente aleatória nem com `METRICAS_PADRAO`. Série
histórica só existe se vier de um fato diário do DW.

### D10. Fonte nova segue o processo
Qualquer fonte nova: `DW_PROCESSO_INTEGRACAO.md` primeiro (tirar todas as
dúvidas), depois catálogo, depois D1–D9.

## 5. Plano de conexão do sistema ao DW

Em ordem; cada etapa entrega algo usável e não quebra o que já funciona.

1. **Papéis de banco** (D7) — criar `etl_writer`/`app_reader`/`bi_reader`,
   trocar a credencial do backend para `app_reader`. Depende de quem administra
   o servidor.
2. **Camada de dados no backend** — rotas `GET /dados/...` autenticadas,
   consultando `marts`, com o perfil do usuário filtrando as OMEs no servidor.
   `src/lib/cbmpe.js` passa a buscar delas, mantendo o mesmo formato que as
   telas já consomem (o "seam" documentado em `AGENTS.md`).
3. **Migração domínio a domínio**, na ordem do que o DW já tem pronto:
   1. **Efetivo** (`marts.efetivo_por_ome`, `marts.militar`) — substitui
      `efetivo.json`/`efetivo_lista.json` e tira o dado nominal do bundle.
   2. **Viaturas** (`marts.frota_por_ome`, `core.dim_viatura`).
   3. **Mapa de Força** (`marts.emprego_*`) — troca `public/dados/` por endpoint.
   4. **Finanças** — nova view em `marts` sobre `raw_financas`.
   5. **QOD (previsto/lotação)**, **Vacinação**, **Ocorrências**, **Intenção
      de Movimentação**, **Inativos** — primeiro entram em `raw_*` (D1/D3),
      depois ganham view.
   A cada domínio migrado, o JSON correspondente sai de `src/data/real/` e o
   script de `etl/<dominio>/` é aposentado.
4. **Agendamento** (D8) — todas as fontes de `carga_raw.py`/`raw_planilhas.py`
   no Windmill, com `carga_core.py` + `validar.py` em seguida.
5. **Desligar o Neon** — quando Efetivo, Viaturas e Finanças lerem do DW, os
   três scripts `apps/*_para_neon.py` podem parar (o Pecúlio → Metabase
   continua).
6. **Trocar os fictícios** da seção 2.3 por fonte real, ou "Em construção" (D9).

## 6. Decisões do usuário (2026-09-25)

1. **API do app = o backend Node que já existe** (`backend/`), estendido com
   rotas `/dados/*` sobre `marts`. A proposta FastAPI de `DW_ARQUITETURA.md`
   fica descartada.
2. **Estado editável do app vai para o banco `dw`, schema `app`** —
   **feito em 2026-09-25**: `etl/dw/ddl/06_app.sql` (tabelas
   `app.organograma_unidade`, `app.atribuicao`, `app.atribuicao_adicional`),
   `backend/services/*Store.js` lendo/gravando lá, semente importada por
   `backend/scripts/semear_estado_app.js` (50 unidades e 8 usuários, conferidos
   idênticos aos JSON), e `etl/dw/carga_core.py` lendo a hierarquia de
   `app.organograma_unidade` em vez do arquivo. `backend/data/*.json` virou só
   semente de instalação nova; o volume Docker deixou de ser necessário.
   Ressalva: `app.atribuicao.cpf_pendente` guarda CPF de quem ainda não teve a
   matrícula encontrada — é a mesma exceção que já existia no arquivo
   (`DW_GOVERNANCA.md`), agora dentro do banco `dw`, fora das camadas
   analíticas.
3. **Chefes das unidades virão do QOD/Lotação** (quem ocupa a função de
   comando). Depende de o QOD entrar no DW (`raw_qod`, regra D3).
4. **Tabelas do banco `postgres` vêm de planilhas Google mantidas por Igor/
   Metabase** — trazer as planilhas originais para `raw_*` do DW e parar de ler
   do banco `postgres`. Falta: os links das planilhas de `cim_*`,
   `inativos_metabase` e `escolaridade_militares` (as de Finanças e Pecúlio já
   estão em `etl/windmill/dw/raw_planilhas.py`).

## 7. Reconciliação do Efetivo — DW × app (medido em 2026-09-25)

Primeiro domínio a migrar (etapa 3.1). `marts.efetivo_por_ome` (último dia,
2026-09-25, 2.655 militares) contra o `efetivo.json` que o app mostra hoje
(gerado em 2026-08-21 do Neon, 2.658):

- **21 unidades batem exatamente.**
- **14 diferem por 1 a 4 militares** — deriva de um mês entre as duas datas.
  Exceção: **DGP 39 × 27**, que é a regra "CPPA soma na DGP" (CPPA tem 11),
  hoje aplicada no extrator e ainda não no DW — tem de ir para o `marts` (D1).
- **15 unidades não casam pela sigla**: o DW usa a sigla do SGP (`CG`, `SCG`,
  `DINTER/1`, `GBMAR`, `CAT / RMR`…) e o app a do organograma. O de-para já
  existe em `carga_core.py` (`ORGANOGRAMA_PARA_SGP` + normalização), mas só
  para uso interno da carga. Próximo passo: gravá-lo em `stg.de_para_ome` com
  `sistema = 'organograma'` e criar `marts.efetivo_organograma` (sigla do app,
  CPPA dentro da DGP), que é o que a rota `/dados/efetivo` vai servir.

## 8. Perguntas em aberto

1. **Onde roda a carga diária do DW?** `raw_peculio` e `core` foram recarregados
   hoje às 11:35, mas as demais fontes não desde 2026-08-24. Se for o Windmill,
   a cópia de `carga_core.py` que está lá precisa ser atualizada (agora lê
   `app.organograma_unidade`); se for esta máquina, já está.
2. **Links das planilhas** de `cim_pedidos`/`cim_atendidos`, `inativos_metabase`
   e `escolaridade_militares` (decisão 4).
3. **Quem administra o servidor do DW** e pode criar os papéis da D7
   (`etl_writer`/`app_reader`/`bi_reader`) e as agendas do Windmill? Hoje tudo,
   inclusive o backend, usa o superusuário.
