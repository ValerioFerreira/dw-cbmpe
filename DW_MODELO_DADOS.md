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

---

# Dimensões conformadas (proposta de 2026-08-24)

> Esta seção é a primeira proposta concreta de dimensões, feita **depois**
> de levantar as fontes reais (ver "Mapa de conexões" em
> [`DW_CATALOGO_FONTES.md`](DW_CATALOGO_FONTES.md)), não antes. Cada
> dimensão abaixo tem fonte identificada e chave de casamento testada,
> exceto onde marcado.

## Ajuste na decisão de 2026-08-07

A decisão original era `core` normalizado com as dimensões aparecendo só
como *views* em `marts`. Isso continua valendo para as **entidades** de
negócio, mas as **dimensões conformadas passam a ser tabelas materializadas
no `core`**, por um motivo concreto que só ficou visível com as fontes na
mão: a dimensão não é uma projeção do dado — ela **carrega a reconciliação**.

`dim_organizacao` precisa guardar o de-para de cinco sistemas que chamam a
mesma unidade de nomes diferentes, mais a chave substituta que sobrevive à
troca de fonte, mais o histórico SCD2. Nada disso cabe numa view: é dado
novo, produzido por nós, que não existe em nenhuma origem. O mesmo vale para
`dim_militar` e `dim_viatura`.

`marts` continua sendo a camada de consumo, agora expondo essas tabelas em
vez de derivá-las.

## O que faz uma dimensão ser "conformada" aqui

Uma dimensão é conformada quando **mais de um fato, vindo de mais de um
sistema, aponta para ela**. É onde está todo o valor do DW: hoje cada
sistema tem a sua lista de OMEs e ninguém consegue cruzar nada. Dimensões
usadas por um único fato não precisam desse tratamento.

## Dimensões propostas

### 1. `dim_organizacao` — a espinha dorsal

Grão: 1 OME. SCD tipo 2. **Autoridade: `ovrsgp.tb_ome`.**

É a dimensão mais importante do modelo, porque quase todo fato aponta para
ela e porque é onde as regras de negócio da corporação ficam resolvidas de
forma estrutural, em vez de virarem exceção espalhada pelo código.

Atributos: `sk_organizacao`, `id_ome` (natural, do SGP), `sigla`, `nome`,
`tipo` (AD/OP), `nivel`, **`sk_organizacao_pai`**, `municipio`, `latitude`,
`longitude`, `status`, `tipo_registro`, `data_inicio_validade`,
`data_fim_validade`.

`tipo_registro` assume quatro valores, e é ele que resolve os casos
especiais:

| Valor | Exemplo | Por quê |
|---|---|---|
| `ome` | as 82 linhas da `tb_ome` | unidade normal |
| `setor_vinculado` | **CPPA**, filha da DGP | conta no filtro próprio e no rollup da mãe |
| `fantasma` | **ADIDOS**, filha do COMANDO GERAL | não é unidade física, mas precisa ser um recorte |
| `planejada` | **DGA** | existe no organograma, sem dado real até ser criada |

**Com `sk_organizacao_pai` preenchido, toda contagem vira rollup pela
hierarquia — e as regras confirmadas pelo usuário caem sozinhas:**

- Militar da CPPA tem `sk_organizacao = CPPA`. Aparece no filtro da CPPA
  **e** no rollup da DGP, sem duplicidade e sem regra especial.
- Adido tem `sk_organizacao = ADIDOS` e `sk_orgao_externo` preenchido.
  Aparece no órgão externo, na OME fantasma, no rollup do Comando Geral e
  no total da corporação — as quatro visões pedidas, com uma linha de fato.

> O bug da CPPA corrigido em 2026-08-24 no app (commit `824b425`) só
> existiu porque o app trabalha com sigla achatada, sem hierarquia. Neste
> modelo ele não teria acontecido.

O de-para vive em `stg.de_para_ome`, com as colunas
`(sistema, valor_origem, sk_organizacao, tipo)`, onde `tipo` distingue
`grafia` (`1ºGB` → `1º GB`) de `setor_vinculado` (CPPA → DGP) — a ausência
dessa distinção foi exatamente a causa do bug acima. As duas DGP (ids 8 e
25) entram aqui apontando para o mesmo `sk_organizacao`.

### 2. `dim_militar`

Grão: 1 militar. SCD tipo 2. Chave natural: **matrícula**.

Fonte hoje: Pecúlio/Neon (efetivo ativo). Fonte futura: SGP, quando
regularizado. Para que a virada seja uma troca de precedência e não uma
reescrita, cada atributo carrega a sua **procedência**.

Formatos de matrícula por sistema, medidos em 2026-08-24 — a normalização
canônica é **sem hífen, com dígito verificador**:

| Sistema | Formato | Casamento |
|---|---|---|
| Pecúlio / Neon | `704028-8` | — (referência) |
| Mapa de força | `7040288` | 94,1% do efetivo ativo |
| SGP `tb_pess` | `704028-8` | a medir |
| Vacinação | a levantar | a levantar |

### 3. `dim_posto_graduacao`

Grão: 1 posto/graduação. Fonte: `ovrsgp.tb_cargo` + `tb_qdro`.
Atributos: sigla, nome, quadro, classe (oficial/praça), ordem hierárquica.

Aparece em `fato_efetivo_diario`, `fato_promocao` e
`fato_lancamento_militar` — conformada.

### 4. `dim_orgao_externo`

Grão: 1 órgão externo onde há adido. Existe para dar o recorte "onde está
cada adido", pedido pelo usuário.

Fonte confirmada: **`Militar.orgao` do Pecúlio** (decisão de 2026-08-24).
O SGP tem a lista tabelada (`tb_unid_extrn`), mas hoje está pior: dos 427
adidos, 162 estão como `INDEFINIDO` e 92 sem unidade nenhuma — **254 de 427
sem órgão utilizável**. Reavaliar quando o SGP for a fonte.

### 5. `dim_tempo`

Grão: 1 dia. Gerada, não extraída. Atributos: data, ano, mês, dia,
trimestre, nome do mês, dia da semana, feriado, expediente.

### 6. `dim_viatura`

Grão: 1 viatura. SCD tipo 2 — a OME muda por transferência, e o número de
ordem é reciclado entre viaturas (ver abaixo). Fonte: sistema de Frotas.

Atributos: `sk_viatura`, `id_frota`, `placa`, `chassi`, `renavam`,
`patrimonio`, `tipo`, `tipo_acronym`, `numero_ordem`, `numero_ordem_norm`,
`marca`, `modelo`, `ano`, `posse`, `destinacao`, `combustivel`,
`categoria_habilitacao`, `rastreado`, `caracterizado`.

`numero_ordem_norm` é a coluna que liga esta dimensão ao mapa de força:
número sem zeros à esquerda e sem o sufixo `L`. Ver
`stg.de_para_viatura` na seção de fatos operacionais.

### 7. `dim_posto_servico`

Grão: 1 posto de serviço. **Autoridade: `ovresc.tb_posto`** (141 ids usados
pelo mapa de força casam 100%), complementada pela `stations` do mapa de
força, que traz endereço, município, AIS e coordenadas.

É **mais granular que a OME** — é o ponto físico de onde a guarnição sai — e
traz a **AIS (Área Integrada de Segurança)**, recorte geográfico usado pela
segurança pública do estado que não existe em nenhuma outra fonte nossa.

Ressalva: 140 das 142 `stations` estão com `latitude = 0.0, longitude = 0.0`,
e a de Fernando de Noronha tem coordenada do Recife. Mesma classe de
problema da `tb_ome`, e corrigível pelo mesmo caminho.

### 8. `dim_turno`

Grão: 1 turno de serviço. Fonte: `ovresc.tb_turn_servi` (44 ids em uso,
100% de casamento). Atributos: nome, hora início, hora fim, duração.

### 9. `dim_tipo_servico`

Grão: 1 tipo de serviço. Fonte: `ovresc.tb_tipo_servi` (149 ids em uso,
100%). Relaciona-se com `tb_natur_servi` (natureza), que pode virar
atributo em vez de dimensão separada — a confirmar.

### 10. `dim_funcao_servico`

Grão: 1 função operacional. Fonte: `ovresc.tb_func_oper` (150 ids em uso,
100%). É a função que o militar exerce **naquele** serviço (motorista,
chefe de guarnição, socorrista...) — não confundir com a função
administrativa da `lotacao_funcao`, que vem da Repercussão Financeira.

### 11. `dim_tipo_recurso_operacional`

Grão: 1 tipo de recurso. Fonte: `mapa_forca.operational_resource_types`
(13 linhas: EPR completo, EPR sem cilindro, cilindro para EPR, DEA,
desencarcerador, conjunto de oxigenoterapia, líquido gerador de espuma...).

É o que traz **Materiais de volta ao escopo pela porta dos fundos**: não é
o inventário patrimonial (que segue adiado), mas responde "quantos EPR
foram para a rua este mês", que é provavelmente a primeira pergunta que o
gestor faria.

### 12. `dim_vacina` e `dim_campanha`

Grão: 1 vacina / 1 campanha. Fonte: `vaccine_control_production`
(20 vacinas, 8 marcas, 12 campanhas). Ainda não levantadas em detalhe.

### 13. `dim_categoria_despesa`

Grão a definir com a DF. Única dimensão desta lista **sem fonte analisada**.

## Resumo: quais fatos usam quais dimensões

| Dimensão | efetivo diário | frota diária | movimentação | promoção | lançamento militar | lançamento viatura | lançamento recurso | abastecimento | vacinação |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `dim_organizacao` | x | x | x | | x | x | x | | x |
| `dim_tempo` | x | x | x | x | x | x | x | x | x |
| `dim_militar` | x | | x | x | x | | | | x |
| `dim_posto_graduacao` | x | | | x | x | | | | |
| `dim_orgao_externo` | x | | | | | | | | |
| `dim_viatura` | | x | | | | x | | x | |
| `dim_posto_servico` | | | | | x | x | x | | |
| `dim_turno` | | | | | x | x | x | | |
| `dim_tipo_servico` | | | | | x | x | x | | |
| `dim_funcao_servico` | | | | | x | | | | |
| `dim_tipo_recurso_operacional` | | | | | | | x | | |
| `dim_vacina` / `dim_campanha` | | | | | | | | | x |

`dim_organizacao`, `dim_tempo` e `dim_militar` aparecem em quase tudo — são
as três que precisam estar certas antes de qualquer outra coisa.

# Fatos propostos

## Snapshot diário — é o que compra o histórico que não temos

- **`fato_efetivo_diario`** — grão: 1 militar × 1 dia. `sk_militar`,
  `sk_organizacao`, `sk_posto_graduacao`, `sk_orgao_externo` (nulo se não
  adido), `sk_tempo`, e flags (`adido`, `afastado`, `le`, `ltip`,
  `readaptado`, `pcd`). Daqui sai todo KPI de efetivo, inclusive série
  temporal — que hoje não existe.
- **`fato_frota_diaria`** — grão: 1 viatura × 1 dia. Situação, OME,
  odômetro, dias desde o último abastecimento. Substitui o `TRUNCATE` do
  `etl/viaturas/windmill-viaturas.py`, que hoje apaga o histórico da frota
  a cada execução.

## Transacionais — pessoal

`fato_movimentacao` (`tb_movim`), `fato_promocao` (`tb_prom`),
`fato_inatividade` (`tb_inatv`), `fato_afastamento` (`tb_afast`),
`fato_agregacao` (`tb_agreg` — regra ainda em aberto).

## Transacionais — operacional (mapa de força)

O lançamento tem três coisas penduradas com grãos diferentes, então são
três fatos, não um:

- **`fato_lancamento_militar`** — grão: 1 militar em 1 lançamento.
  `sk_militar`, `sk_organizacao`, `sk_posto_servico`, `sk_tempo`,
  `sk_turno`, `sk_tipo_servico`, `sk_funcao_servico`, `status`. É o único
  fato que liga militar, viatura, OME e tempo — o que permite sair de
  "quantos a unidade tem" para "quantos a unidade empregou".
- **`fato_lancamento_viatura`** — grão: 1 viatura em 1 lançamento.
- **`fato_lancamento_recurso`** — grão: 1 tipo de recurso em 1 lançamento,
  **com quantidade** (é aditivo; os outros dois são contagem).
- **`fato_alteracao_lancamento`** — de `action_logs`, 1,2 milhão de linhas
  com valor antigo, valor novo e **motivo textual**. Dá o que nenhuma outra
  fonte dá: baixa de viatura em serviço, troca de militar em cima da hora,
  e o porquê.

## Como ligar viatura entre Frota e mapa de força

Os dois sistemas **não** estão ligados: o mapa de força tem catálogo próprio
de tipos e um `order_number` digitado à mão. Mas a reconciliação por número
normalizado cobre **98,6%** (ver medição em `DW_CATALOGO_FONTES.md`).

**Decisão de 2026-08-24 — não somar as duas fontes, e sim cruzá-las.** São
grãos diferentes: a Frota diz o que a corporação *possui*, o mapa de força
diz o que foi *empregado*. Somar produz número sem significado; o que se
quer é "das N viaturas da frota, quantas rodaram no último mês".

Caminho em duas etapas:

1. **Agora, dentro do DW**: `stg.de_para_viatura` reconcilia pelo número de
   ordem normalizado (sem zeros à esquerda, sem sufixo `L`), com desempate
   temporal pela `dim_viatura` SCD2 nos 150 casos de número reciclado.
   `fato_lancamento_viatura` ganha `sk_viatura` resolvido, e nulo quando
   não resolvido, com cobertura publicada como métrica. Isso já entrega
   "clicar numa viatura e ver os dias em que foi empregada", com histórico
   desde novembro de 2019.
2. **Depois, corrigindo na origem**: o mapa de força passa a gravar a
   identidade da Frota (placa ou id), e o `order_number` vira só rótulo.
   É mudança de aplicação, precisa da DTIC — e a tabela de reconciliação do
   DW vira o dado de carga inicial dessa correção, não se joga fora.

Enquanto a etapa 1 não existir, **"viatura em serviço" e "viatura na frota"
são grandezas que não se cruzam** e não devem ser apresentadas juntas.

## Transacionais — outros domínios

`fato_abastecimento` (29.158 linhas já disponíveis, grão de 1
abastecimento), `fato_vacinacao` (3.030 aplicações), `fato_financeiro`
(grão a definir com a DF).

# A regra de efetivo ativo — o que o SGP diz hoje

Regra definida pelo usuário: **efetivo é todo militar da ativa do CBMPE**.
Não existe divisão entre "administrativo" e "disponível" — militar afastado
(LE, LTIP, licença médica, férias) continua contando na sua OME. Inativo
(aposentado, reformado) é tratado por outra diretoria e está fora de escopo.
Adido conta para o órgão externo, para a OME fantasma ADIDOS, para o rollup
do Comando Geral e para o total — e **pode** ser escalado, porque adido tira
serviço extra.

No SGP a regra seria: sem registro em `tb_inatv`, o militar está ativo.
**Medido em 2026-08-24, essa regra não é aplicável hoje:**

```
tb_pess (total)                                    4.597
  sem registro em tb_inatv                         4.571   <- classifica quase todos como ativos
  lotados na pseudo-OME INATIVOS (id 3)            1.430
    destes, COM registro em tb_inatv                  15   <- 1%
  sem tb_inatv E fora de INATIVOS/LICENCIADOS      3.080
efetivo ativo do Pecúlio (fonte atual)             2.658
```

A `tb_inatv` tem **26 registros no total**. A marcação de fato usada hoje é
a movimentação para a pseudo-OME `INATIVOS`, e os dois mecanismos quase não
se cruzam.

Isso não invalida a regra — ela é a correta, e é para onde o SGP deve ir.
Mas reforça duas coisas:

1. **O Pecúlio continua sendo a fonte do efetivo ativo** até o SGP ser
   regularizado.
2. **Quando o SGP for regularizado, a inativação precisa passar a ser
   lançada em `tb_inatv`**, não por movimentação para uma OME-situação. Se
   os dois mecanismos coexistirem, o DW nunca terá um número confiável.

Evidência colateral: dos 73 militares escalados nos últimos 12 meses que não
estão no efetivo ativo do Pecúlio, 67 estão "orgânicos e ativos" no SGP — e
a maioria lotada na pseudo-OME `INATIVOS`, com 100+ lançamentos no ano. São
inativos tirando serviço extra. Só 4 são adidos.

# Dado sensível novo, a conter na entrada

O mapa de força trouxe **CPF**, que não existia em nenhuma fonte nossa:
`launch_militaries.military_cpf` e `action_logs.user_cpf`. A matrícula já
serve de chave — **o CPF deve ser descartado na transição `raw` → `stg`**,
não subir para o `core`. Ver `DW_GOVERNANCA.md`.

---

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
