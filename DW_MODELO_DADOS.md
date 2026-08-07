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

### Pendências explícitas desta fonte (não resolver por suposição)

- **Regra de "efetivo ativo" e tratamento de Adido/Agregado** no cômputo
  por unidade — usuário pediu mais tempo pra pensar. Nenhuma
  view/mart de "efetivo atual" deve ser criada até isso ser decidido.
- Mapeamento exato `tb_qdro` → categorias Oficiais/Praças/Alunos/Cadetes.
- `tb_qdro_x_cargo_x_secao_x_func` (campo `qt_vagas`) é candidata futura
  para modelar efetivo previsto/autorizado vs. realizado — só uma
  observação registrada, não implementar agora.

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
