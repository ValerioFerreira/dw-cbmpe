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
| Matrícula → OME | `dw.marts.ome_atual_militar` (desde 2026-09-29; antes lia `core` direto) | **Único ponto em que o sistema já lê o DW ao vivo** |
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
- **`dw_dim`** e **`dw_diesp`** — achados em 2026-09-29, **de origem
  desconhecida** (criados com o mesmo `datawarehouse-user`). **Não mexer**
  até descobrir o dono.
  - `dw_dim`: **aposentado em 2026-09-29** (decisão do dono). Foi renomeado
    para `dw_dim_aposentado_20260929`, com `CONNECT` revogado e o motivo no
    comentário do banco. **Não foi apagado**: o `DROP` fica para o dono.
    Antes disso, o que só existia lá foi copiado para `dw.raw_ref.dw_dim_*`
    (`etl/dw/preservar_dw_dim.py`): OMEs com coordenadas, classe por patente e
    catálogo de materiais. **O `carga_core.py` dependia dele** para as
    coordenadas das OMEs. Agora a cadeia é `raw_ref.dw_dim_ome` →
    `casar_coordenadas_ome.py --gravar-dw` → `stg.coordenada_ome` →
    `carga_core.py`, com resultado idêntico (62 OMEs com coordenada,
    conferido linha a linha). Descrição original: modelagem anterior e parada.
    Schemas `efetivo` (2.387 militares, derivado do Pecúlio), `frotas` (cópia
    da Frota **com `cpf_condutor`**, contra a D5) e `materiais` (catálogo de
    309 itens, só código/nome, sem estoque). Proposta: aposentar quando o dono
    concordar.
  - `dw_diesp`: **job ativo**. Todo dia às 02:59 UTC grava um snapshot da
    tramitação atual dos projetos do SGAT (protocolo, DAE, laudo, seção,
    analista) em `projetos.tramitacao_atual_projeto_historico`, em JSON. Tem
    27 execuções entre 2026-08-22 e 2026-09-29. Quando "Atividades Específicas
    / DIESP" entrar, isso vira `raw_sgat` no `dw`, lendo o `ovrsgat` direto.

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

0. **Carga `raw` das fontes Postgres internas via `postgres_fdw`** — **feito
   em 2026-09-29** (seção 9).
1. **Papéis de banco** (D7) — **papéis-grupo criados em 2026-09-29**
   (`etl/dw/ddl/07_papeis.sql`, sem login). Falta criar os usuários de login
   (senha no cofre) e trocar a credencial do backend para um usuário com
   `app_reader`. O backend já só lê `marts` + `app`: a consulta
   matrícula → OME passou para `marts.ome_atual_militar`.
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

1. ~~Onde roda a carga diária do DW?~~ **Respondida em 2026-09-29: no
   Windmill, que já roda.** Falta a URL e o acesso para publicar o flow
   `dw_diario` (seção 9).
2. ~~Links das planilhas de CIM, inativos e escolaridade~~ **Resolvida em
   2026-09-29**: estavam nos scripts do Windmill do usuário e já foram
   carregadas em `raw_*` (seção 9). Nova pendência: republicar as planilhas
   **CP** e **natureza** do Material Operacional (HTTP 410).
3. **Usuários de login dos papéis da D7.** Os papéis-grupo existem desde
   2026-09-29. Falta decidir quem guarda as senhas (cofre `cofre-sistemas.kdbx`
   da Seção?) para criar `windmill_etl` (etl_writer), `app_backend`
   (app_reader) e `metabase` (bi_reader). Hoje tudo, inclusive o backend, usa
   o superusuário.
4. **Credenciais de leitura nas origens.** O user mapping do fdw usa as
   mesmas credenciais de `.env.local`. É preciso confirmar se são só leitura
   na origem ou pedir um usuário read-only para cada sistema (SGP, OPS,
   Frota, ROE).
5. ~~Dono do `dw_dim` e do `dw_diesp`~~ **Respondida em 2026-09-29: o
   próprio usuário.** Falta decidir o destino (seção 3).

## 9. Estrutura v1 do DW e plano fonte a fonte (2026-09-29)

Pedido do usuário: "organizar para que todos os dados estejam no banco do DW,
e o sistema se conecte ao banco". Decisões dele nesta data:
- **Windmill** para o que é externo (planilhas, Neon da reserva).
- **`postgres_fdw`** para os sistemas Postgres da rede interna. O DW puxa por
  SQL e o Windmill só agenda e monitora.
- **Um banco só**, o `dw`. Nada de novos `dw_*`.

### Por que fdw, e não replicação ou script
- **Replicação lógica** está descartada. O SGP roda PG 9.5, que não tem
  replicação lógica nativa, e ela exigiria mudar a configuração (`wal_level`,
  publicações) de sistemas de outras equipes.
- **Script Python copiando linha a linha** (`carga_raw.py`) funciona, mas o dado
  trafega pelo worker. Com o fdw, ele vai de banco a banco: 1,9 milhão de
  linhas do mapa de força em **19 s**, medido em 2026-09-29. O filtro de uma
  carga incremental (`updated_at`) roda na origem, e a carga vira SQL
  versionado.
- **Custo**: as credenciais das origens ficam no catálogo do DW
  (`pg_user_mapping`, legível só pelo dono ou superusuário). O servidor do DW
  precisa alcançar as origens, o que foi **confirmado para as quatro**
  (10.193.0.16, 10.193.0.20 e 10.193.1.252:54329).

### Como funciona
- `etl/dw/ddl/08_fdw.sql` cria a extensão e o procedimento
  `stg.carregar_raw(fonte)`. O procedimento copia cada foreign table de
  `fdw_<fonte>` para `raw_<fonte>`, com uma transação por tabela e uma linha
  em `stg.carga` por tabela (`observacao = 'postgres_fdw'`). Se uma tabela
  falha, a raw anterior dela fica intacta e as outras seguem. No fim, o
  procedimento sai com erro.
- `etl/dw/configurar_fdw.py` cria o servidor `srv_<fonte>`, o user mapping e
  as foreign tables. As colunas são lidas do catálogo da origem: `citext` e
  enum viram `text`, e **as colunas negadas (CPF) nem existem na foreign
  table**. Ele roda uma vez, e de novo quando mudar credencial ou coluna.
- `etl/windmill/dw/raw_fdw.py` é o gatilho no Windmill.
- Diferença para o `carga_raw.py`: datas com ano impossível (62025) chegam
  como `date`, que o Postgres aceita, e não mais como texto. O `carga_core.py`
  passou a aplicar o regex em `reference_date::text`, e o descarte das 3
  datas inválidas da Frota continua igual.

### Estrutura v1

```
fdw_<fonte>  foreign tables (só o ETL lê; sem grant para ninguém)
             fdw_sgp, fdw_escala (10.193.0.16) · fdw_mapa_forca (10.193.0.20)
             fdw_frota (10.193.1.252:54329) · a seguir: fdw_vacina, fdw_roe
raw_<fonte>  cópia fiel + carga_id/extraido_em
             hoje: sgp, escala, mapa_forca, frota, reserva, peculio, financas
             a seguir: vacina, roe (fdw) · qod (planilha publicada)
                       cim, inativos, escolaridade (planilhas do Igor)
                       ref (malha IBGE, KMZ/coordenadas das OMEs)
                       depois: sgat (projetos/DIESP), materiais
stg          carga, de_para_ome, de_para_viatura, carregar_raw()
             a seguir: de_para_ome com sistema 'organograma', 'qod',
                       'financas', 'vacina', 'roe'
core         dimensões e fatos atuais
             a seguir: dim_municipio, fato_previsto_ome, fato_lotacao_funcao,
                       fato_financeiro, fato_vacinacao, fato_ocorrencia,
                       fato_intencao_movimentacao, fato_inativo
marts        views atuais + ome_atual_militar (2026-09-29)
             a seguir: uma view por tela do app (efetivo_organograma,
                       efetivo_previsto, lotacao_funcao, financas_*,
                       vacinacao_*, ocorrencias_*, intencao_movimentacao,
                       saida_previsao) + carga_status (frescor por domínio)
app          organograma_unidade, atribuicao, atribuicao_adicional
papéis       etl_writer · app_reader (marts + app) · bi_reader (marts)
```

### Fonte a fonte

| Fonte | Onde | Método | `raw` | Freq. | Estado em 2026-09-29 |
|---|---|---|---|---|---|
| SGP (OME, seção) | 10.193.0.16 | fdw | raw_sgp | diária | **via fdw, em dia** |
| Escala | 10.193.0.16 | fdw | raw_escala | diária | **via fdw, em dia** |
| Mapa de força | 10.193.0.20 | fdw (incremental depois) | raw_mapa_forca | diária | **via fdw, em dia** |
| Frota | 10.193.1.252:54329 | fdw | raw_frota | diária | **via fdw, em dia** |
| Vacinação | 10.193.0.20 | fdw | raw_vacina | diária | **via fdw desde 2026-09-29**: tudo, sem CPF, sem `users`/`versions` (DW_GOVERNANCA.md) |
| Ocorrências (ROE) | 10.193.1.252:15432 | fdw | raw_roe | diária | **via fdw desde 2026-09-29**: as 8 views `roe_*`, sem dado pessoal de cidadão |
| Reserva remunerada | Neon (origem) | Python (`carga_raw.py reserva`) | raw_reserva | diária | no DW, parado em 08-24 |
| Pecúlio | Google Sheets | Python (`raw_planilhas.py`) | raw_peculio | diária | em dia |
| Finanças | Google Sheets | Python (`raw_planilhas.py`) | raw_financas | diária | **`core.fato_financeiro` + `marts.financas_organograma`** desde 2026-09-29 (bate com `public.fin_*`) |
| QOD (previsto + lotação) | Google Sheets publicada (xlsx) | Python (`raw_planilhas.py`) | raw_qod | diária | **no DW desde 2026-09-29** (8 abas); ainda sem core/marts |
| Inativos, escolaridade | Abas da **mesma pasta do Pecúlio** | Python (`raw_planilhas.py`) | raw_inativos, raw_escolaridade | diária | **no DW desde 2026-09-29** (1.981 e 2.654 linhas) |
| CIM (pedidos, atendidos) | Planilha própria | Python (`raw_planilhas.py`) | raw_cim | diária | **no DW desde 2026-09-29** (2.667 e 388) |
| Material operacional | 5 planilhas (SMO, VT, CP, natureza, uso) | Python (`raw_planilhas.py`) | raw_materiais | — | **Descontinuada** (usuário, 2026-10-01): outro sistema, do Igor, vai substituir estas planilhas; a nova fonte será integrada quando chegar. Hoje em pausa no `raw_planilhas.py` (CP e natureza despublicadas, HTTP 410) |
| IBGE, KMZ | arquivo / API | carga pontual | raw_ref | pontual | fora (JSON) |

### Os scripts do Windmill do usuário (lidos em 2026-09-29, só leitura)

Workspace `dgp` em `windmill-server.captain.cbmpe.intranet` (CE v1.378).
**Nenhum script do DW está publicado lá ainda**: `carga_core.py`,
`carga_raw.py` e `raw_planilhas.py` só rodaram manualmente. As cargas antigas
(08-24, 09-25) foram feitas de uma máquina local.

| Script (resumo) | Agenda | O que faz | Serve ao DW? |
|---|---|---|---|
| Pecúlio Metabase V1 | de hora em hora | Planilha do Pecúlio → Neon `Militar` + `postgres.public.peculio_metabase_v1` | **Não mexer.** O DW lê a mesma planilha direto em `raw_peculio`. Com a mesma agenda, a atualização é a mesma do Neon |
| Metabase - Inativos e Escolaridade | diária | Duas abas da pasta do Pecúlio → `public.inativos_metabase`, `public.escolaridade_militares` | URLs reaproveitadas → `raw_inativos`, `raw_escolaridade` |
| CIM_pedidos_e_atendidos | de hora em hora | Planilha → `public.cim_pedidos`, `cim_atendidos` | URLs reaproveitadas → `raw_cim` |
| DF Metabase | a cada 2h | Planilha de Finanças (xlsx) → `public.fin_*` | Já coberto: é a mesma planilha de `raw_financas` |
| ETL - Finanças | — | `public.fin_*` → Neon `FinancaLancamento` | Não: é cópia derivada, sai quando o app ler o DW |
| ETL - Frotas | — | Frota → Neon `Viatura` | Não: o DW lê a Frota via fdw |
| Material Operacional | diária | 5 planilhas → planilha "Material Operacional - Tratado" | URLs das originais → `raw_materiais`. **Falhando** nas últimas 5 execuções (conflito do pacote `cryptography` no worker) |
| Controle do tempo de serviço | a cada 6h | Calcula datas de reserva e escreve de volta numa planilha | Não (dado derivado; o DW tem a reserva da origem). **Falhando** nas últimas 5 (HTTPError ao ler a URL do Pecúlio) |

**Segurança:** "Material Operacional" e "Controle do tempo de serviço" têm a
**chave privada de uma service account do Google colada no código**. Ela
deveria virar *resource* secreto do Windmill, e a chave deveria ser rotacionada.

### Ordem de execução
1. ~~Fundação: fdw + `carregar_raw` + papéis-grupo~~ (**feito**, 2026-09-29).
2. **Windmill**: flow `f/dw/dw_diario` e agenda **prontos em
   `etl/windmill/publicar_dw.py`**. Para rodar no Windmill, o `carga_core.py`
   deixou de ler arquivos locais e outros bancos (coordenadas via
   `stg.coordenada_ome`; siglas do Pecúlio lidas de `raw_peculio`, conjunto
   idêntico ao do antigo `mapeamento_unidades.json`). A publicação ainda
   **precisa ser executada pelo usuário**: o comando foi bloqueado pelo
   controle de permissões da sessão de 2026-09-29.
3. **Fontes que faltam**: vacinação e ROE via fdw, QOD via planilha, e as
   planilhas do Igor quando vierem os links. Para cada uma: raw → de-para de
   OME → fato no core, com a regra que hoje está nos extratores do app
   movida para SQL (D1).
4. **`marts` por tela**, cada view reconciliada contra o JSON que ela
   substitui (seção 7).
5. **Rotas `/dados/*` no backend + `src/lib/cbmpe.js`**, domínio a domínio,
   removendo o JSON correspondente do bundle.
6. **Limpeza**: desligar os scripts `*_para_neon.py`, os fictícios viram "Em
   construção", e resolver o `dw_dim`/`dw_diesp` com o dono.

## 10. O app lendo o DW (2026-09-29)

**Caminho:** `GET /dados/metricas` no backend lê as views
`marts.efetivo_organograma`, `marts.frota_organograma` e
`marts.financas_organograma`, com o valor **próprio** de cada unidade na sigla
do organograma e o frescor em `marts.carga_status`. No front,
`carregarOrganograma()` (`src/lib/cbmpe.js`) chama a rota junto com o
organograma e aplica os números por domínio (`aplicarMetricasDw` em
`src/data/organograma.js`). O rollup continua no front, igual a antes.

**Fallback (decisão do usuário: a Vercel continua até a transição):** sem
backend alcançável, sem sessão SGU (inclusive o login local AGGD) ou com erro,
o app segue com os JSON embutidos. No CapRover, com login SGU, os cards passam
a ler do DW sem mudar código. Testado localmente: com sessão, o Comando Geral
mostrou 2.654 militares, 771 viaturas e R$ 2.596.953,65 (DW); sem sessão,
os valores dos JSON.

**Regra de pertencimento** (`stg.ome_dono_organograma`): cada OME conta para o
ancestral mais próximo que existe no organograma. Isso reproduz, sem regra
especial, CPPA na DGP, adidos no Comando Geral e as CAT numeradas na base.

**Reconciliação** (DW de hoje × JSON do app):
- **Finanças:** idêntico a `public.fin_*` (R$ 2.596.953,65). O JSON do app era
  de 07/08.
- **Efetivo:** 2.654 × 2.658 (JSON de 21/08), com diferenças de ±1 a 4 por
  unidade.
- **Viaturas:** 771 × 771, com transferências de ±1 a 3 por unidade.
- Nenhuma diferença é de regra; todas são o tempo entre as duas extrações.

**O que ainda sai de JSON do bundle:** efetivo previsto (QOD ainda sem
core/marts), divisões internas, lotação por função, as tabelas nominais
(`efetivo_lista.json`, `viaturas_*`) e os painéis de Efetivo, Viaturas, DF,
Vacinação e Ocorrências. É a próxima leva (seção 9, etapa 5). As rotas
nominais **têm de filtrar as OMEs pelo perfil no servidor**.

## 11. QOD, dado nominal, painéis e build interno (2026-09-29, continuação)

### O que o app passa a ler do DW (quando o backend está ao alcance)
| Rota | View(s) em `marts` | Recorte por perfil (no servidor) | Substitui |
|---|---|---|---|
| `GET /dados/metricas` | `efetivo_organograma`, `frota_organograma`, `financas_organograma`, `previsto_organograma`, `chefe_organograma`, `carga_status` | nenhum: são os agregados e titulares que o organograma mostra a qualquer usuário logado | `efetivo.json`, `viaturas_lista.json` (contagem), `financas.json`, `efetivo_previsto.json`, `OFICIAIS` fixo |
| `GET /dados/efetivo` | `efetivo_nominal` | indicador Efetivo | `efetivo_lista.json` |
| `GET /dados/lotacao` | `lotacao_militar` | indicador Efetivo | `lotacao_funcao.json` (por matrícula) |
| `GET /dados/painel/df` | `painel_df_*` | indicador Finanças; diárias e funeral só com Finanças de todas as unidades | `financas_dashboard.json` |
| `GET /dados/painel/vacinacao` | `painel_vacinacao_*` | só quem enxerga a DAS (senão 403) | `vacinacao_dashboard.json` |
| `GET /dados/painel/ocorrencias` | `painel_roe_*` | só linhas das unidades liberadas | `ocorrencias_dashboard.json` |

- **Regra de acesso:** `backend/services/acessoService.js` é o espelho no
  servidor de `src/lib/accessControl.js`. Vale a **união** dos perfis do
  usuário. Testado com os perfis reais: Administrador, Comandante e
  Subcomandante veem tudo; DGP vê o Efetivo de todos; DF e DLOG só a própria
  unidade; matrícula sem perfil não vê nada.
- **Cache:** os nominais saem com `Cache-Control: no-store`.
- **Decisões do usuário nesta rodada:**
  - O previsto passa a ser o número de vagas `FUNCIONAL` da aba FUNCOES_DPLAG
    do QOD publicado, e não mais a aba "GERAL 001" de um xlsx local. Com isso,
    o 2º GB foi de 485 para 671 e o 6º GB de 232 para 201.
  - O chefe de cada unidade é quem ocupa a função de menor ordem de exibição.
    Comando Geral e Subcomando Geral mostram o Comandante e o Subcomandante
    Geral; GCG e GSG mostram o chefe de gabinete; função sem ocupante aparece
    como "Vago".
- **Reconciliação:**
  - DF: idêntico a `public.fin_*`.
  - Vacinação: os 3.030 eventos são idênticos ao JSON.
  - Efetivo e ROE: as diferenças são o tempo entre as extrações (promoções,
    transferências, ocorrências novas), nunca regra.

### Build interno (CapRover)
`VITE_APP_INTERNO=1` é o padrão do `Dockerfile`, que só o CapRover usa:
- não existe login local AGGD;
- `vite.config.js` esvazia no bundle `efetivo_lista`, a lotação por matrícula
  e os painéis de Vacinação, Ocorrências e DF.

O bundle cai de 27 MB para 3,9 MB. Na Vercel nada muda.

**Ainda no bundle interno:**
- `por_unidade_divisao` e `por_unidade_secao` da lotação (só matrículas, sem
  nome). O casamento seção do QOD → divisão do organograma ainda é feito pelo
  extrator Python.
- Os painéis do Dashboard Pessoal de Efetivo (`efetivo_dashboard/*`) e de
  Viaturas.
- O Mapa de Força (`public/dados/`).

São a próxima leva.

### Checklist da transição para o CapRover
1. **Backend:**
   - `DATABASE_URL_DW` = usuário `app_backend` (valor de
     `DATABASE_URL_DW_APP` no `.env.local`, a levar ao cofre);
   - `DATABASE_URL_SGP`, `SGU_URL`, `JWT_SECRET`, `CORS_ORIGIN` = domínio do
     front.
2. **Front:** `VITE_AUTH_API_URL` = URL pública do backend. `VITE_APP_INTERNO`
   já vem 1 do `Dockerfile`.
3. **Proxy reverso:** vhost no `srv-nginx01` e Port Mapping manual
   (`DW_ARQUITETURA.md`, "Deploy no CapRover").
4. **Depois de validado:**
   - desligar a Vercel;
   - aposentar os extratores `etl/efetivo/extract_efetivo.py`,
     `etl/viaturas/extract_viaturas.py`, `etl/financas/extract_financas.py`,
     `extract_dashboard_df.py`, `etl/das/…` e `etl/ocorrencias/…`;
   - apagar os JSON correspondentes de `src/data/real/`.

   Os scripts do Windmill "ETL - Frotas" e "ETL - Finanças", que alimentam o
   Neon, **já não estão agendados**. O "Pecúlio Metabase V1" continua, porque
   alimenta o sistema de Reserva e o Metabase.

## 12. Finanças, QOD e LOB (2026-10-01)

### Finanças: inteira no DW
- **Caminho:** planilha de Finanças (aba "Banco de Dados - NÃO MEXER", a consolidação das
  outras abas; `Plan1` ignorada) → `raw_financas` → `core.fato_financeiro` (950 lançamentos)
  → `stg.financas_destino` → `marts.painel_df_*` e `marts.painel_df_lancamento` → backend
  `GET /dados/painel/df` → front (`usePainelDw`).
- **Removidos:** `financas.json`, `financas_dashboard.json`, `extract_financas.py` e
  `extract_dashboard_df.py`, mais o stub do Vite. O card de Finanças do organograma mostra 0
  até o DW responder (nunca um número fictício).
- **Tratamento só de grafia** (`tratar_grafia_financas()` em `etl/dw/carga_core.py`; o
  auditor `etl/financas/auditar_planilha.py` usa as mesmas funções): tipo de gasto (caixa,
  espaço, hífen; "Globa", "Miliar") e mês (palavras extras; MAIO = MAI; data do Carnaval
  gravada como número de série do Excel). O original fica em `ficha_financ_original` e
  `mes_original`. Nada de valor, situação, OME ou enquadramento é corrigido.
- **Dashboard DF:** SFI, Suprimento Individual, **Diárias** (ex-Despesas Diversas, sem o
  gráfico de Auxílio Funeral) e **Despesas Gerais** (todos os lançamentos, filtros por OME,
  Enquadramento, Situação e Mês, e os alertas de pago > liquidado, liquidado > empenhado e
  pago > empenhado). Linhas sem OME (folha, contratos, "Aos mesmos") só vão a quem vê Finanças
  de todas as unidades. A view não traz SEI, descrição nem observação (nome de falecido).

### QOD: quem alimenta o quê
| Informação | Fonte |
|---|---|
| Funções (catálogo, ID fixo) | aba `ID_ATUALIZADO` da QOD CONFERÊNCIA (DPlaG) |
| Ocupantes de cada função | aba `QOD_CONSOLIDADA` (CPPA) |
| Previsto por unidade | quadro **GERAL 001** do QOD de setembro (`raw_qod_quadros` → `core.qod_quadro_unidade` → `marts.previsto_quadro`); total 5.249 |
| Titular da unidade e matrícula | **Pecúlio** (mais antigo da OME) → `marts.chefe_organograma`; CPP repete a CPO |
| Vagas da DPlaG (`FUNÇÕES DPLAG`) | só conferência (`marts.previsto_organograma`) |

O QOD de setembro é lido pelo **link de compartilhamento** (`.../export?format=xlsx`), não
por "publicar na web". Fonte `qod_quadros` em `raw_planilhas.py`.

### Rotas e views novas ou alteradas
`marts.efetivo_nominal` ganhou `agregado` e `indisponivel`; `marts.chefe_organograma` lê o
Pecúlio; `GET /dados/metricas` lê `marts.previsto_quadro` (com fallback às vagas da DPlaG
se a tabela estiver vazia); `GET /dados/painel/df` devolve também `lancamentos`.

### Transição para o CapRover: continua em standby
O checklist da seção 11 vale, com duas mudanças: **não há mais JSON de Finanças** a apagar, e o
deploy aguarda a **VM** que o TI pediu à ATI. A lista de pendências está em
`DW_PLANEJAMENTO.md`, seção "Em aberto e próximos passos (2026-10-01)".
