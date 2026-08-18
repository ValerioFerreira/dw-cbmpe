# DW CBMPE — Modelo de Dados

> **Este documento descreve uma hipótese em construção, não um modelo
> definitivo.** Partes já confirmadas pelo usuário estão marcadas como
> tal; o resto é proposta sujeita a validação. Nada aqui deve ser tratado
> como especificação para implementação de DDL ainda.
>
> O contrato de dados do app atual (`src/data/organograma.js`,
> `src/lib/cbmpe.js`) **não** é usado como base para este modelo — serve
> só de contexto histórico de que domínios de negócio existem, não de
> como modelá-los.

## Abordagem: `core` normalizado + `marts` dimensional

> Revisado em 2026-08-07 — ver decisão "`core` deixa de ser esquema
> estrela e vira modelo normalizado" em
> [`DW_PLANEJAMENTO.md`](DW_PLANEJAMENTO.md).

Duas camadas de modelo, com papéis diferentes (ver
[`DW_ARQUITETURA.md`](DW_ARQUITETURA.md)):

- **`core` — modelo relacional normalizado (3FN-like)**: uma tabela por
  entidade de negócio (unidade, militar, viatura...), com chaves
  estrangeiras reais entre si. É o banco centralizado do objetivo 2 do
  usuário — integra dado de todas as fontes (internas e externas),
  permitindo cruzá-las livremente. Só entram aqui os **principais dados**
  de cada fonte — ver [Critério de inclusão de dados](#critério-de-inclusão-de-dados-no-core)
  abaixo. O resto do dado de cada fonte continua só na origem, acessível
  por conexão direta (ver `DW_ARQUITETURA.md`).
- **`marts` — modelo dimensional (fato/dimensão, estilo Kimball)**:
  construído a partir do `core`, para consumo do app React e de consultas
  estatísticas/comuns via Power BI/Metabase. É aqui que reaparecem
  conceitos como `dim_unidade`, `dim_tempo`, `fact_movimentacao` etc. —
  como *views* sobre o `core`, não como tabelas base.

`dim_tempo` (calendário) é uma dimensão de conveniência para BI — vive só
em `marts`; no `core` normalizado, datas são colunas normais nas tabelas
de evento.

## Critério de inclusão de dados no `core`

Decisão registrada em `DW_PLANEJAMENTO.md` (2026-08-07), válida para toda
fonte — três perguntas por campo/tabela:

1. Aparece em algum indicador/relatório/cruzamento entre sistemas?
2. Precisamos do histórico dele, e a fonte original só guarda o estado
   atual (sobrescreve)?
3. É dado sensível cujo valor analítico é só hipotético, sem uso
   concreto hoje?

"Sim" em (1) ou (2) → entra no `core`. "Sim" isolado em (3) → fica na
fonte original até um uso concreto aparecer (entra depois, pelo mesmo
processo de [`DW_PROCESSO_INTEGRACAO.md`](DW_PROCESSO_INTEGRACAO.md)).

## Entidade central: `unidade` (organograma)

Espinha dorsal do `core` — todas as demais entidades se relacionam com
ela, direta ou indiretamente.

- Hierarquia (parent/child), candidata a versionamento por data de
  vigência — a corporação reestrutura unidades ao longo do tempo, e
  histórico importa para análise (critério 2 do inclusão).
- Atributos: sigla, nome, tipo, cargo do responsável, nível hierárquico.
- **Atributo `status`** (`ativa` \| `planejada`) — confirmado, ver seção
  [Unidades planejadas](#unidades-planejadas-status-de-unidade) abaixo.
- **Candidata a fonte real**: `tb_ome`/`tb_secao` do SGP (`ovrsgp`) —
  **pendente de reconciliação** com o organograma já documentado (só
  temos o schema/DDL, não uma amostra de dados real, para comparar).
  Até essa reconciliação acontecer, a definição de `unidade` usada no
  modelo continua sendo a já documentada aqui, não a do SGP.

## Unidades planejadas (`status` de `unidade`)

Confirmado pelo usuário em 2026-08-07: nem toda unidade existe
operacionalmente hoje. `status` tem pelo menos dois valores:

- `ativa` — unidade em operação, pode ter linhas relacionadas no `core`.
- `planejada` — unidade reservada na estrutura organizacional, mas ainda
  não criada de fato. Existe em `unidade` (com hierarquia e posição
  corretas), mas **não deve ter nenhum dado relacionado** até virar
  `ativa`.

**Exemplo concreto confirmado — DGA (Diretoria de Gestão Administrativa)**:
ainda não existe de fato, mas sua posição no organograma já está definida
e deve ser preservada:
- Pai: `SUBCOMANDO GERAL` (irmãs: DGO, GSG, AJG, CPP).
- Tipo: `diretoria`.
- Subordinadas diretas: DGP, DVP, DJD, DF, DAS, DTIC, DLOG, DEIP, DPLAG.
- Status: `planejada`, até a corporação confirmar sua criação oficial.

Qualquer view/mart que agregue por unidade deve decidir explicitamente se
inclui unidades `planejada` (tipicamente não, já que não geram dado
real).

## Efetivo/RH — fonte SGP (schema `ovrsgp`)

Primeira fonte real analisada (ver `DW_PLANEJAMENTO.md`, decisão "Primeira
fonte real: SGP"). Aplicando o critério de inclusão acima — **isto é uma
proposta derivada do critério, ainda não confirmada campo a campo pelo
usuário**:

### Entidade `militar` (grão: 1 por pessoa)

**Campos com uso analítico claro (confirmados como necessários pelo
usuário em rodadas anteriores)**: matrícula, nome, nome de guerra, sexo,
data de nascimento, posto/graduação atual, quadro (Oficial/Praça),
situação (Orgânico/Adido/Agregado), unidade atual, data de ingresso
(`tb_pess.dt_ingrs`, fonte confirmada como confiável).

**Campos demográficos agregáveis — propostos por atenderem ao critério
1 (perfil demográfico já foi pedido como relatório)**: raça/cor,
escolaridade, estado civil. *(Religião fica de fora desta lista — dado
sensível sem indicador solicitado até agora; a confirmar.)*

**Campos propostos para ficarem SÓ no SGP (critério 3 — sensível, sem uso
analítico concreto hoje), acessíveis via conexão direta quando
necessário**: saúde (tipo sanguíneo, alergias, doenças crônicas, doador),
dados bancários, dependentes, características físicas (altura, peso,
tamanhos de farda), endereço completo (exceto talvez cidade/UF, se
distribuição geográfica virar indicador), documentos de identidade
(CPF/RG/CNH/título eleitor/passaporte — ficam no SGP; o `core` referencia
a pessoa pela matrícula, não pelo CPF), foto e demais arquivos.

**Nota**: essa tabela de "dentro vs. fora" é uma proposta minha aplicando
o critério — a rodada anterior desta conversa havia pedido "o máximo de
dado possível"; a decisão de recalcular a rota supera isso, mas os campos
específicos listados acima ainda não foram revalidados um a um com o
usuário. Tratar como proposta até confirmação explícita.

### Eventos de pessoal (grão: 1 linha por evento) — confirmados como entidades separadas

- **`movimentacao`** (de `tb_movim`): militar, unidade origem/destino,
  data, documento, efetivado (S/N), observação.
- **`promocao`** (de `tb_prom`): militar, cargo/posto novo, quadro, tipo
  de promoção, data, documento, efetivado.
- **`afastamento`** (de `tb_afast`): militar, tipo de afastamento, data
  início/término, documento, observação.
- **`inativacao`** (de `tb_inatv`): militar, motivo, data, documento.

### Satélites propostos (critério 1/2 — desenvolvimento de carreira tem uso analítico)

- **`formacao`** (de `tb_curso`/`tb_pess_x_curso`): militar, curso, tipo,
  classificação, instituição, datas, status.

*(Carteira funcional, contatos, dependentes, dados bancários e documentos
— ver acima, propostos para ficarem só na fonte por ora.)*

### Ficha do militar no app — mapa de blocos por tabela (Caminho A × B)

Feature `/militar/:matricula` (2026-08-19). A junção com o SGP é pela
matrícula (`tb_pess.nr_matr_pess`), a mesma chave que já usamos na base
Neon `Militar`. Cada bloco dos prints do SGP mapeia assim:

| Bloco (print SGP) | Tabelas SGP | Caminho |
|---|---|---|
| Dados Funcionais (posto, unidade, ingresso, promoção, movimentação) | `tb_pess`, `tb_cargo`, `tb_ome`, `tb_movim`, `tb_prom` | **A (público)** — subconjunto administrativo |
| Dados Pessoais (filiação, naturalidade, religião, estado civil, endereço, escolaridade) | `tb_pess` (`nm_gntr`/`nm_gntra`, `en_*`, `id_tipo_relig_fk`…) | B (interno) |
| Dados Físicos (cor, altura, peso, tipo sanguíneo, saúde, medidas) | `tb_pess` (`nr_altu_pess`, `ds_doen_cron`, `ds_alerg`…) | B (interno) |
| Registros Pessoais / Documentos (CPF, RG, CNH, título, anexos) | `tb_pess`, `tb_docm` | B (interno) |
| Dependentes | `tb_depen` | B (interno) |
| Cursos | `tb_pess_x_curso`, `tb_curso` | B (interno na 1ª versão; candidato a A se confirmado não sensível) |
| Históricos (afastamentos, inativação, agregação) | `tb_afast`, `tb_inatv`, `tb_agreg` | B (interno) |

O Caminho A não depende de nova sincronização: lê o subconjunto já presente
em `efetivo_lista.json`. O Caminho B (blocos acima) só passa a existir com o
`windmill-sgp.py` (a escrever — ver `DW_ETL.md`) carregando pra schema/role
restrito no Neon, servido só atrás de autenticação real. A allowlist/
denylist exata de campos está em `DW_GOVERNANCA.md`.

### Pendências explícitas desta fonte (não resolver por suposição)

- **Regra de "efetivo ativo" e tratamento de Adido/Agregado** no cômputo
  por unidade — usuário pediu mais tempo pra pensar. Nenhuma
  view/mart de "efetivo atual" deve ser criada até isso ser decidido.
- Mapeamento exato `tb_qdro` → categorias Oficiais/Praças/Alunos/Cadetes.
- `tb_qdro_x_cargo_x_secao_x_func` (campo `qt_vagas`) é candidata futura
  para modelar efetivo previsto/autorizado vs. realizado — só uma
  observação registrada, não implementar agora.

## Efetivo/RH — Lotação e Função (Pecúlio, QOD, CPPA)

Segunda fonte real analisada para este domínio (ver `DW_PLANEJAMENTO.md`,
2026-08-17) — complementar à fonte SGP acima, focada num problema
específico: hoje só sabemos a **OME** de um militar (via Pecúlio/Neon),
não a seção/divisão interna nem a função que exerce. Três planilhas juntas
resolvem isso — **confirmado com o usuário, não presumido**:

- **Pecúlio.xlsx** (DGP) — mesma fonte que já alimenta o Neon/
  `efetivo_lista.json` (confirmado pelo usuário) — não é uma nova
  superfície de integração, só o "quem" e "em que OME".
- **QOD.xlsx** (DPlaG) — já documentado acima nas extrações de Efetivo
  Previsto (`etl/efetivo/extract_previsto.py`/`extract_previsto_divisoes.py`)
  — define quantas vagas de função existem por unidade/seção e que posto
  cada uma espera.
- **Repercussão Financeira.xlsx** (CPPA) — conecta as duas: quem ocupa
  qual função.

### Entidade `lotacao_funcao` (grão: 1 por (militar, função ocupada))

Fonte: aba `DIST_FUNCOES` da Repercussão Financeira.xlsx. Campos: matrícula
(FK `militar`), unidade (texto bruto — de-para pro organograma a
construir), posto do militar, **nome completo da função e seção** (texto
livre, ex. "Chefe da Divisão de Operações", "Comandante do(a) 5º Grupo de
Salvamento da 1ª SBS"), posto esperado pela função, portaria, BGE,
antiguidade. Permite N linhas por matrícula (acúmulo de função —
confirmado pelo usuário e observado nos dados: mesma matrícula em 2 linhas
com funções diferentes).

**Cobertura parcial, não 100%**: hoje 846 linhas de ~2.659 militares
ativos (~32%). Confirmado pelo usuário: "DIST_FUNCOES está sendo
atualizada, e irá conter todos os militares do pecúlio" — é uma planilha
viva, em expansão pela CPPA, não um snapshot completo. Cobre todos os
postos (verificado: 223 Sd, 169 3º Sgt, 111 Cb nas amostras, com funções
como "Combatente do Grupo de Salvamento", não só chefias — não é só
função de chefia/comando). Pro efetivo ainda fora de `DIST_FUNCOES`, a
granularidade continua só OME (via Pecúlio/Neon) até a cobertura
aumentar.

**Aba `REPERC_FINANC` (mesmo arquivo) — catalogada, não integrada agora**:
~2.531 linhas, grão 1 por militar, mas só com o posto-tier da função (ex.
"CAP QOC"), sem nome de seção — parece servir pra reconciliar vagas
disponíveis x ocupadas por posto (repercussão financeira/gratificação de
função). Redundante com `DIST_FUNCOES` pro nosso propósito (função+seção)
e o usuário não confirmou sincronismo garantido entre as duas abas — fica
de fora do modelo até haver motivo concreto pra usá-la (ex. validação
cruzada de contagem por posto).

### Pendências explícitas desta fonte (não resolver por suposição)

- **De-para de unidades da Repercussão Financeira → organograma**: nomes
  divergem em vários casos (ex. "DIInter/1"/"DIInter/2" → "DINTER I"/
  "DINTER II", "CAT/Zona da Mata (Carpina)" → "CAT/ZM"). Usuário autorizou
  construir por inferência de nome (mesmo padrão do
  `etl/efetivo/mapeamento_previsto.json` do QOD), com revisão dele depois
  — ainda não construído.
- **Granularidade de `SUBSETORES`**: o texto de função de `DIST_FUNCOES` é
  mais fino em vários casos (ex. "grupo de salvamento" dentro de uma SBS)
  do que as divisões que o app já exibe hoje (`SUBSETORES` em
  `organograma.js`). Não forçar casamento automático até decidir se o app
  deve descer a esse nível ou se essa granularidade fica só no `core`.
- **Cobertura parcial de `DIST_FUNCOES`** (~32% hoje) — qualquer extração
  precisa deixar claro que "sem função" não significa "não tem função",
  só que ainda não foi lançada na planilha.
- Sem extração/script escrito ainda — isto é só o desenho (passo 3 do
  `DW_PROCESSO_INTEGRACAO.md`), aguardando revisão do usuário.

## Demais domínios (Frota, Financeiro, Atividades Operacionais)

Ainda sem fonte real analisada — candidatos hipotéticos, grão a confirmar
quando as fontes chegarem (mesmo processo do SGP):

| Entidade candidata | Domínio | Observação |
|---|---|---|
| `viatura` / `tipo_viatura` | Frota | Grão por viatura individual (confirmado anteriormente), sem histórico de manutenção disponível hoje — foco inicial é "quantas e quais viaturas por unidade". |
| `categoria_despesa` | Financeiro | Estrutura a confirmar com a fonte real (pode já vir de um plano de contas institucional). Fonte ainda não enviada. |
| `tipo_atividade` / `ocorrencia` | Atividades Operacionais | Grão por ocorrência individual (confirmado anteriormente), com endereço/coordenadas e timestamps de chamado/chegada. Fonte ainda não enviada. |

## Explicitamente fora deste modelo (por ora)

- **Materiais/Patrimônio** — domínio adiado para uma fase posterior (ver
  roadmap em `DW_PLANEJAMENTO.md`).
- **Qualquer campo específico de UI** (ex. `icone`, `cor`, `serie` JSON) do
  mock atual — são detalhes de apresentação do app antigo, não dado de
  negócio a persistir no DW.

## Próximos passos para fechar este modelo

1. Confirmar campo a campo a proposta de escopo de `militar` (seção
   acima) com o usuário.
2. Levantar fontes externas (objetivo 1, prioridade atual — ver
   `DW_PLANEJAMENTO.md`) e aplicar o mesmo critério de inclusão.
3. Reconciliar `tb_ome`/`tb_secao` do SGP com o organograma já
   documentado, com uma amostra real de dados.
4. Sessão com o gestor principal da corporação para definir visualizações
   e KPIs — confirma ou refuta o grão hipotético de cada entidade acima.
5. Só então escrever o DDL definitivo do schema `core`.
