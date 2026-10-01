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
- **QOD publicado pela DPlaG** (Google Sheets, "publicar na web") —
  conecta as duas: quem ocupa qual função. **Substituiu a Repercussão
  Financeira nesse papel em 2026-08-26** (ver abaixo).

### Entidade `lotacao_funcao` (grão: 1 por (militar, função ocupada))

Fonte: **QOD publicado pela DPlaG**, duas abas do mesmo arquivo:

| Aba | Grão | Papel |
|---|---|---|
| `QOD_FUNCOES` | 1 por função prevista (1.823) | Catálogo: `ID_FUNCAO`, tipo (FUNÇÃO/ENCARGO), OME, localidade, **seção**, nome da função, ordem de exibição |
| `QOD_CONSOLIDADA` | 1 por (militar, função ocupada) (2.775) | Ocupação: antiguidade, unidade, matrícula, posto, nome, cursos, posto esperado da função, portaria, BGE, **`CÓDIGO`** |

`QOD_CONSOLIDADA.CÓDIGO` → `QOD_FUNCOES.ID_FUNCAO` é **chave estrangeira
de verdade**: 2.744 das 2.775 linhas trazem `CÓDIGO` e 100% delas
resolvem. O par militar→função não tem nada para adivinhar.

Permite N linhas por matrícula (acúmulo de função): 239 militares hoje.

**Por que substituiu a Repercussão Financeira.** Até 2026-08-26 a função
vinha da aba `DIST_FUNCOES` da Repercussão Financeira (CPPA): uma coluna
de TEXTO LIVRE por militar, casada contra o organograma por três camadas
de heurística. Cobria 716 militares (26,9%) em 14 unidades. O QOD
publicado cobre **2.356 (88,6%) em 43 unidades**, sem heurística nenhuma
no par militar→função, e traz os mesmos campos administrativos
(antiguidade, portaria, BGE, posto da função) mais cursos, seção,
localidade e a distinção FUNÇÃO/ENCARGO. A Repercussão Financeira
continua existindo para o cálculo financeiro — só deixou de ser fonte de
lotação/função.

**FUNÇÃO vs ENCARGO.** O catálogo separa 1.397 funções de 426 encargos.
Encargo é acúmulo, com `ID_FUNCAO_VINCULADA` apontando para a função que
a pessoa já ocupa. 87 militares têm função e encargo; 10 só encargo.
Contar as duas linhas duplicaria os 87 — então a contagem por
divisão/seção usa só FUNÇÃO, mais o encargo de quem não tem função
lançada. A ficha do militar mostra as duas, com o campo `tipo`.

### Seção x divisão — a única coisa que ainda depende de casamento

O QOD é **um nível mais fino** que o organograma do app: ele lista "Seção
de Tesouraria - ST", que em `SUBSETORES` (`src/data/organograma.js`) não
existe — lá ela está dentro de "Divisão Administrativa - DA". Casar seção
contra divisão direto resolve **980 das 1.823 funções**; o resto fica com
`divisao: null` e aparece só em `por_unidade_secao`, com o nome exato que
o QOD dá.

A tentativa de fechar o resto por heurística foi feita e **rejeitada por
medição**. A ideia era usar `ORDEM_EXIBICAO`: o QOD é lido de cima para
baixo, então a seção herdaria a última divisão aberta acima dela. Sobe a
atribuição de 65% para 91% — mas a conferência contra o efetivo previsto
por divisão (`efetivo_previsto_divisoes.json`, que vem da árvore numerada
do QOD original) reprova:

| Regra | Funções atribuídas | Divisões acima do previsto | Pessoas sobrando |
|---|---:|---:|---:|
| Só casamento direto | 1.701 | 4 | 12 |
| + rollup por ordem de exibição | 2.370 | 28 | 115 |

O caso que revela o furo: no 1º GB a ordem põe SICT e SEO (6 funções)
logo depois do bloco da Secretaria e ANTES da linha que abre a Divisão de
Operações — as seis vão parar numa Secretaria de 4 vagas. O documento não
é uma árvore linear confiável. 669 atribuições a mais não pagam 93
pessoas na divisão errada.

As 4 divisões que ainda passam do previsto no casamento direto são fato
da fonte, não erro de casamento — a maior é `GBAPH / Secretaria e Apoio
do Comando - SAC`, com **16 militares lançados para 8 vagas previstas**.

### Pendências explícitas desta fonte (não resolver por suposição)

- **De-para seção → divisão** (ou o QOD original com a numeração
  hierárquica `1.`/`1.1.`/`1.1.1.`, que o `extract_previsto_divisoes.py`
  já sabe ler): é o que falta para atribuir os 843 restantes sem
  adivinhar. Mesma pendência, por outro caminho, do subfiltro de seção do
  painel de Mapa de Força.
- **31 linhas de ocupação sem `CÓDIGO`** — 13 delas na CAT/Zona da Mata.
  Sem código não dá para saber a função; ficam de fora, contadas e
  listadas na saída do extrator.
- **110 divergências de unidade** entre o QOD e o Pecúlio (ex. militar em
  "3º GB (Serra Talhada)" no QOD e em GBI no Pecúlio, num bloco de
  matrículas 725xxx). Vale o Pecúlio, e o extrator lista todas.
- **Cobertura de 88,6%** — "sem função" continua significando "ainda não
  lançada", não "não tem função".
- **1 matrícula fora do Pecúlio**: 950759-0 (Subcomandante Geral). Entra
  pelo de-para de unidade da própria planilha.

---

# O DW existe (construído em 2026-08-24)

> Esta seção descreve o que **está no ar**, não proposta. O que vem depois
> dela é o desenho que gerou isto.

Banco `dw` no Postgres interno (`10.193.1.252:54301`), **427 MB, 1,85 milhão
de linhas**. Construído por `etl/dw/`, em quatro passos idempotentes:

```
etl/dw/criar_banco.py     cria o database (CREATE DATABASE nao roda em transacao)
etl/dw/aplicar_ddl.py     aplica etl/dw/ddl/*.sql em ordem
etl/dw/carga_raw.py       copia fiel das fontes para raw_*
etl/dw/carga_core.py      raw -> stg -> core (e onde a regra de negocio mora)
etl/dw/validar.py         bateria de perguntas de negocio com resposta conhecida
```

## O que está carregado

| Camada | Conteúdo |
|---|---|
| `raw_sgp` | `tb_ome` (82), `tb_secao` (1.100) |
| `raw_escala` | `tb_posto`, `tb_turn_servi`, `tb_tipo_servi`, `tb_func_oper`, `tb_natur_servi` |
| `raw_mapa_forca` | 1.845.200 linhas — lançamentos, militares, viaturas, recursos e cadastros |
| `raw_peculio` | planilha do Pecúlio + telefones (5.017) |
| `raw_reserva` | sistema de reserva remunerada (3.293) |
| `raw_financas` | planilha de Finanças, uma tabela por aba (2.839) |
| `raw_frota` | 11 tabelas de `frotas_production` (59.318) |
| `core` | 15 dimensões + 8 fatos + `contato_militar` |
| `stg` | `de_para_ome` (122), `de_para_viatura` (1.626), controle de carga |
| `marts` | 11 views de consumo |

Fatos: `fato_averbacao` (560), `fato_afastamento_reserva` (8),
`fato_previsao_reserva` (2.658), `fato_efetivo_diario` (2.658),
`fato_frota_diaria` (813),
`fato_lancamento_militar` (902.164), `fato_lancamento_viatura` (204.443),
`fato_lancamento_recurso` (259.998).

**CPF não foi copiado** (`launch_militaries.military_cpf`,
`action_logs.user_cpf`) — bloqueado por lista de negação no `carga_raw.py`.

## As regras de negócio, verificadas

`etl/dw/validar.py` não é teste unitário: é uma bateria de perguntas de
negócio com resposta esperada conhecida. Resultado atual, tudo passando:

| Verificação | Valor |
|---|---|
| Total da corporação | 2.658 |
| CPPA (efetivo próprio) | 11 |
| DGP própria + CPPA (o número que o app mostra) | 39 |
| ADIDOS (OME fantasma) | 187 |
| COMANDO GERAL (rollup) | 2.658 |
| Adido entra no rollup da DGP? | 0 — não entra |
| Soma do efetivo próprio de todas as OMEs | 2.658 |

A última é a que prova que não há dupla contagem nem perda: cada militar tem
exatamente uma linha de fato, e a hierarquia distribui.

## Divergência de hierarquia: resolvida — o organograma é a autoridade

Ao carregar, o DW encontrou 27 unidades cuja hierarquia no SGP não bate com a
do organograma oficial. O caso mais visível: a DGP fechava **77** militares
por rollup no SGP e **39** no organograma, porque o SGP pendura DAS (30) e
CEFD (8) na DGP, enquanto o organograma as trata como unidades irmãs.

**Resolvido pelo usuário em 2026-08-24: "Organograma é a verdade."**

O DW foi reconstruído sobre essa base. Hoje a DGP fecha **39** — 28 próprios
mais os 11 da CPPA — e DAS (30) e CEFD (8) respondem por si.

A divergência não foi apagada, foi tornada visível. `core.dim_ome` carrega:

| Coluna | Serve para |
|---|---|
| `origem_hierarquia` | `organograma` (45), `sgp` (26), `regra` (11) — de onde veio o pai desta unidade |
| `no_organograma` | 46 unidades verdadeiras — a OME é reconhecida pelo organograma oficial |

Uma unidade com `origem_hierarquia = 'sgp'` não é erro: é uma OME que o
organograma simplesmente não lista (situações funcionais, unidades inativas,
extintas). O que a coluna garante é que ninguém confunda "o organograma diz"
com "o SGP diz" ao ler um número de rollup.

### Onde o organograma mora

Em `backend/data/organograma.json` (desde 2026-09-23 — antes vivia na
constante `ARVORE` de `src/data/organograma.js`, que agora é só o fallback
estático). É o arquivo que a tela `/adm` edita (mudar subordinação,
renomear, criar/excluir OME), servido também ao app via `GET /organograma`.
`carga_core.py` > `arvore_do_organograma()` lê esse JSON direto e **falha
alto** se o resultado tiver menos de 5 nós com filho, para que uma edição
no admin (ou o backend fora do ar) não degrade a hierarquia do DW em
silêncio.

É dívida técnica consciente: a autoridade da hierarquia da corporação está
num arquivo `.json` de aplicação, não numa tabela do DW. Quando ela virar
tabela (ou vier do SGP corrigido), só o leitor muda.

### Regras de estado das unidades (2026-08-24)

| Situação | Como o DW trata |
|---|---|
| **DGA** — ainda não criada | `tipo_registro = 'planejada'`, `conta_efetivo = false`, sem filhos. As 9 diretorias que penderiam dela pendem direto do **Subcomando Geral**, que fica com 17 filhos diretos. Ativar a DGA é mudar um status |
| **AJ** | Subordinada ao **GCG** |
| **GBFN → SBFN** | Seção sob o **GBI**; o histórico de lançamentos fica atrelado a ela |
| **CAC, CPA, CPTO, CTA, CEMET II, DFEA** | `status = 'extinta'` — o SGP ainda as marca como ativas |
| **GTA** | Não é OME. Entra como adido, órgão externo `GTA` |

### Por que isso não pediu SCD tipo 2

Vale registrar porque a pergunta é legítima e a resposta não é óbvia.

SCD tipo 2 significa guardar **uma linha por período de validade**: quando o
GBFN vira SBFN sob o GBI, a linha antiga é fechada (`valido_ate = data`) e
uma nova é aberta. O fato aponta para a versão que valia **na data do
evento** — então um lançamento de 2021 continuaria mostrando "GBFN,
independente", e um de 2026 mostraria "SBFN, sob o GBI".

O usuário quer o contrário: os lançamentos históricos do GBFN devem aparecer
sob a estrutura de hoje. Isso é exatamente o que uma dimensão **sem**
versionamento faz — há uma linha só por OME, e todo fato, de qualquer época,
enxerga a hierarquia atual.

SCD2 na `dim_ome` só passa a ser necessário no dia em que alguém precisar
responder *"como era a estrutura em 2021?"*. Fica registrado como opção, não
como pendência.

**`dim_viatura` virou SCD2 em 2026-08-26.** Números de ordem são reciclados:
o mesmo número designa veículos diferentes em épocas diferentes, e sem versão
por período não havia como dizer a qual deles um lançamento antigo se refere
— eram 413 pares ambíguos. Com vigência, sobraram 57. Ver a seção
`dim_viatura` mais abaixo para as duas regras que só apareceram medindo.

## O que já dá para responder e antes não dava

**Série temporal de emprego operacional** — a fonte sozinha não dá, porque
guarda só o estado atual:

| Ano | Lançamentos | Militares escalados |
|---|---|---|
| 2021 | 28.592 | 80.585 |
| 2022 | 47.079 | 138.568 |
| 2023 | 63.518 | 172.524 |
| 2024 | 67.498 | 168.933 |
| 2025 | 68.902 | 173.611 |
| 2026 (parcial) | 58.821 | 167.917 |

**Dias de emprego por viatura** — a pergunta que motivou a reconciliação
Frota × mapa de força, via `marts.emprego_viatura_resumo`. Exemplo real: a
`PCH1493` (ABT-819) foi empregada em **1.864 dias** distintos, de 2021-05-26
a 2026-08-24.

E dois números que caem de graça e valem alerta de gestão: **367 viaturas da
frota nunca apareceram em serviço**, e **116 viaturas com situação "Ativa"
estão há mais de 180 dias sem emprego**. Ambos precisam ser lidos junto com a
cobertura da reconciliação (`marts.qualidade_reconciliacao`), porque parte
pode ser falha de casamento e não ociosidade real.

## Cobertura da reconciliação, publicada de propósito

`marts.qualidade_reconciliacao` existe para que ninguém leia "viaturas
empregadas" como número completo:

| Domínio | Resolvido | Sem casar |
|---|---|---|
| `fato_lancamento_militar` | 819.554 (90,8%) | 82.610 |
| `fato_lancamento_viatura` | **202.429 (99,0%)** | 2.014 |

A viatura estava em 80,4% enquanto a `dim_viatura` tinha só a frota **atual**:
viatura baixada desde 2021 não tinha para onde casar. Com o SCD2 carregado do
histórico da Frota (2026-08-26) foi para 99,0% — acima até dos 98,6% medidos
em 12 meses, porque a vigência resolve também o número reciclado, que a
medição por número sozinho não resolvia.

Os 2.014 restantes são o piso real: número que nunca existiu na Frota
(MTP-1066/1067/1068, MSA-991/992 e outros 151 pares).

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

`dim_ome` precisa guardar o de-para de cinco sistemas que chamam a
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

### 1. `dim_ome` — a espinha dorsal

Grão: 1 OME. **82 linhas, carregada.** Autoridade dividida, e a divisão é
deliberada: o **cadastro** (quais OMEs existem, sigla, nome, tipo,
coordenada) vem de `ovrsgp.tb_ome`; a **hierarquia** (de quem cada uma
depende) vem do organograma oficial. Ver a seção de divergência acima.

É a dimensão mais importante do modelo, porque quase todo fato aponta para
ela e porque é onde as regras de negócio da corporação ficam resolvidas de
forma estrutural, em vez de virarem exceção espalhada pelo código.

Atributos: `sk_ome`, `id_ome` (natural, do SGP), `sigla`, `nome`, `tipo`
(AD/OP), `nivel`, **`sk_ome_pai`**, `municipio`, `latitude`, `longitude`,
`status`, `tipo_registro`, `conta_efetivo`, `no_organograma`,
`origem_hierarquia`.

**Não é SCD tipo 2 hoje** — há uma linha por OME, e todo fato de qualquer
época enxerga a hierarquia atual. É o comportamento que o usuário pediu
(ver "Por que isso não pediu SCD tipo 2", acima).

`tipo_registro` assume cinco valores, e é ele que resolve os casos
especiais — distribuição real da carga:

| Valor | Qtd | Exemplo | Por quê |
|---|---|---|---|
| `ome` | 75 | unidades da `tb_ome` | unidade normal |
| `setor_vinculado` | 1 | **CPPA**, filha da DGP | conta no filtro próprio e no rollup da mãe |
| `fantasma` | 1 | **ADIDOS**, filha do COMANDO GERAL | não é unidade física, mas precisa ser um recorte |
| `planejada` | 1 | **DGA** | existe no organograma, sem dado real até ser criada |
| `situacao` | 4 | **INATIVOS**, `LIC / DGP`, `OUT SIT / DGP`, `CFHP 2017` | situação funcional que o SGP modelou como se fosse OME |

`conta_efetivo` (57 verdadeiras, 25 falsas) é o que impede que uma situação
funcional, uma unidade extinta ou a DGA entrem num total de efetivo.

**Com `sk_ome_pai` preenchido, toda contagem vira rollup pela hierarquia — e
as regras confirmadas pelo usuário caem sozinhas:**

- Militar da CPPA tem `sk_organizacao = CPPA`. Aparece no filtro da CPPA
  **e** no rollup da DGP, sem duplicidade e sem regra especial.
- Adido tem `sk_organizacao = ADIDOS` e `sk_orgao_externo` preenchido.
  Aparece no órgão externo, na OME fantasma, no rollup do Comando Geral e
  no total da corporação — as quatro visões pedidas, com uma linha de fato.

> O bug da CPPA corrigido em 2026-08-24 no app (commit `824b425`) só
> existiu porque o app trabalha com sigla achatada, sem hierarquia. Neste
> modelo ele não teria acontecido.

### `core.dim_ome_ancestral` — a tabela de fechamento

344 linhas, uma para cada par (ancestral, descendente) da árvore, com a
distância entre eles. É o que transforma rollup hierárquico em `JOIN`
simples, em vez de recursão a cada consulta:

```sql
-- efetivo total de uma OME, incluindo tudo o que pende dela
SELECT count(*)
FROM core.fato_efetivo_diario f
JOIN core.dim_ome_ancestral a ON a.sk_descendente = f.sk_ome
WHERE a.sk_ancestral = :sk_ome;
```

É essa tabela que faz a CPPA aparecer no rollup da DGP e os ADIDOS no do
Comando Geral **sem uma linha de código especial em lugar nenhum** — a regra
está na forma da árvore, não em `IF`s espalhados pelas consultas.

O de-para vive em `stg.de_para_ome` (122 linhas), com as colunas
`(sistema, valor_origem, sk_ome, tipo)`, onde `tipo` distingue
`grafia` (`1ºGB` → `1º GB`) de `setor_vinculado` (CPPA → DGP) — a ausência
dessa distinção foi exatamente a causa do bug acima. As duas DGP (ids 8 e
25) entram aqui apontando para o mesmo `sk_ome`.

### 2. `dim_militar`

Grão: 1 militar. **2.658 linhas, carregada.** Chave natural: **matrícula**.

Fonte hoje: planilha do Pecúlio (não mais o Neon). Fonte futura: SGP, quando
regularizado. Para que a virada seja uma troca de precedência e não uma
reescrita, cada atributo carrega a sua **procedência**.

#### O alargamento de 2026-08-24

A dimensão carregava 10 dos 38 campos que a aplicação usa. Os que faltavam
entraram, com três critérios — e os três valem para qualquer campo futuro:

**1. Data entra; duração não.** A planilha traz idade, tempo de serviço e
tempo na OBM já calculados. Nenhum dos três é guardado: número calculado
envelhece, data não. E não é hipótese — medido: a **idade declarada na
planilha já diverge do cálculo em 126 dos 2.658** militares, porque foi
computada quando a planilha foi atualizada pela última vez. O tempo de serviço
declarado bate com `hoje − data de praça` em 2.653 de 2.658. As três durações
são recalculadas a cada consulta em `marts.militar`.

**2. Campo redundante não vira coluna.** "Ano de ingresso" é o ano da data de
praça em 2.657 de 2.658 — não entrou.

**3. Contato sai da dimensão.** Telefone foi para `core.contato_militar`
(2.045 militares), tabela própria, para que consultar contato seja decisão
explícita e não carona num `SELECT *`. As abas de telefone trazem também
e-mail e endereço — não entraram: ninguém pediu, e dado sensível sem uso
concreto não entra no DW.

Colunas novas: `data_ultima_promocao`, `sk_principio_promocao`,
`ome_anterior`, `data_movimentacao_sp`, `sk_suplemento`, `acumulo_cargos`,
`observacao`. Estados que variam no tempo (`horario_especial`,
`sk_tipo_afastamento`) foram para `fato_efetivo_diario`, não para a dimensão.

##### O defeito que isso revelou

`data_nascimento` e `data_ingresso` estavam **100% nulas** na `dim_militar`.
O cast só aceitava `AAAA-MM-DD`; a planilha escreve `DD/MM/AAAA`. O `CASE`
devolvia `NULL` em silêncio para as 2.658 linhas, e nenhuma validação
percebeu — a `dim_militar` tinha 2.658 linhas, o efetivo fechava, tudo
"passava". Corrigido, e o `validar.py` passou a exigir preenchimento das datas
que nunca deveriam faltar. É o tipo de erro que uma contagem de linhas nunca
pega.

##### Três dimensões novas

| Dimensão | Linhas | Por quê |
|---|---|---|
| `dim_principio_promocao` | 5 | ANTIGUIDADE (2.140), MERECIMENTO (353), ANTIGUIDADE DECENAL (160), PROMOÇÃO REQUERIDA (2), RESSARCIMENTO DE PRETERIÇÃO (2) |
| `dim_suplemento_pessoal` | 103 | O ato que publicou a movimentação. Vira dimensão porque número e data andam juntos e se repetem: o SP nº 013/2026 sozinho move 548 pessoas |
| `dim_tipo_afastamento` | 14 | LE, LTS, LTIP, LM — **e 10 valores que não são tipo nenhum** |

Os 10 valores estranhos da última são texto digitado na coluna errada da
planilha: siglas de OME (`1ºGB`, `GBI`, `GBAPH`…) e nomes de função
(`Monitor INC Florestal`). Entram como estão e o `validar.py` os reporta —
corrigir na origem não é nosso.

##### O que a coluna OBS revelou

A coluna OBS da planilha, que ninguém tinha lido, carrega dois marcadores que
respondem perguntas abertas do projeto:

| Valor | Militares | O que significa |
|---|---|---|
| `Titular` | 45 | **É o titular da OME.** O Pecúlio já sabe quem comanda cada unidade — ver o perfil Titular em `DW_GOVERNANCA.md` |
| `Ag`, `Ag - READAP`, `CARGO ELETIVO - Ag` | 18 | **Agregado** — a regra estava em aberto desde 2026-08-21 |

Nenhum dos dois foi transformado em regra ainda: estão carregados como texto
em `dim_militar.observacao` e contados pelo `validar.py`. Viram regra quando
o usuário confirmar a leitura.

#### Antiguidade — lida do índice da planilha, não calculada

A planilha do Pecúlio já vem ordenada por precedência: blocos por posto, do
Cel ao Sd, e dentro de cada bloco a coluna `Nº` reinicia em 1. **O índice da
planilha é a antiguidade** — não há nada a calcular, só a ler. Duas colunas:

| Coluna | O que é |
|---|---|
| `antiguidade` | O `Nº` declarado na planilha, dentro do posto. É o número que o militar cita — "sou o 269º 3º Sgt" |
| `antiguidade_geral` | Posição na planilha inteira, 1..2.658. Ordena a corporação de ponta a ponta, o que a coluna acima não faz: o nº 1 dos Cel e o nº 1 dos Sd são pessoas muito diferentes |

`antiguidade_geral` bate **100% com a `ordemHierarquica` do Neon** nas 2.658
matrículas — validação cruzada com o campo que a aplicação já usava. A
`antiguidade` por posto é informação nova: o Neon não a tinha.

Como a planilha é a fonte da ordem, o `validar.py` checa que **cada posto
ocupa um bloco contíguo**. Se a planilha deixar de vir ordenada, as duas
colunas passariam a mentir em silêncio — essa é a checagem que pega isso.

**Três `Nº` repetidos** dentro do posto (um em 3ºSgt, um em Cb, um em
Subten) — erro de digitação na origem, reportado pelo `validar.py` sem
derrubar a carga. O número é da corporação, não nosso: renumerar por conta
própria seria pior do que exibir o conflito. A ordem da planilha desempata.

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

Grão: **1 versão de viatura** (SCD tipo 2, implementado em 2026-08-26). São
813 viaturas em 2.827 versões — 3,5 cada. Uma versão nova nasce a cada
mudança de OME (`transfers`) ou de situação (`vehicle_statuses`); são os dois
únicos atributos que mudam ao longo da vida do veículo. Fonte: sistema de
Frotas.

Atributos: `sk_viatura`, `id_frota`, `valido_de`, `valido_ate`,
`versao_atual`, `placa`, `chassi`, `renavam`, `patrimonio`, `tipo`,
`tipo_acronym`, `numero_ordem`, `numero_ordem_norm`, `marca`, `modelo`,
`ano`, `posse`, `destinacao`, `combustivel`, `categoria_habilitacao`,
`rastreado`, `caracterizado`, `sk_ome`, `situacao`, `em_servico`.

`sk_viatura = id_frota * 100 + sequência da versão`. É determinístico, e por
isso a `dim_viatura` deixou de fazer parte da pendência de chaves substitutas
instáveis — cabe folgado, já que o maior `id` da Frota é 859 e a viatura com
mais versões tem 27.

`numero_ordem_norm` é a coluna que liga esta dimensão ao mapa de força:
número sem zeros à esquerda e sem o sufixo `L`. A regra vive em
`stg.normalizar_numero_ordem()`, criada porque a mesma normalização é
aplicada em três lugares e já divergiu uma vez.

**Duas regras que só apareceram medindo**, e que valem mais que o desenho:

1. **Só uma viatura por número de ordem herda o passado.** A primeira versão
   precisa valer para trás (`valido_de = 1900-01-01`), porque o histórico da
   Frota começa em 2023-12-06 e o mapa de força em 2021-05-07 — sem isso, dois
   anos e meio de lançamento ficam sem casar. Mas abrir *todas* as primeiras
   versões devolve a ambiguidade inteira: as duas donas do mesmo número ficam
   vigentes no mesmo dia. Dentro de um número, só a que chegou primeiro herda
   o passado. Ambíguos: 413 → 231 pares.

2. **Vigência sozinha não basta.** Uma viatura `Devolvida` mantém a última
   versão aberta (`valido_ate` nulo) e concorre com a sucessora. Daí a coluna
   `em_servico` (o `still_usable` do próprio catálogo da Frota: falso para
   `Descarregada` e `Devolvida`) e a resolução em dois estágios — candidata em
   serviço manda; na falta de qualquer uma, vale a fora de serviço. Ambíguos:
   231 → 57 pares.

Medido sobre os 204.443 lançamentos de viatura:

| Regra | Lançamentos resolvidos |
|---|---|
| só vigência | 91,9% |
| vigência + em serviço | 97,5% (mas 367 perdiam a única candidata) |
| **os dois, com queda para a fora de serviço** | **97,7%** |

No fato carregado, com o desempate por acrônimo somado, dá **99,0%**.

As quatro invariantes do SCD2 são conferidas por `etl/dw/validar.py`: versão
atual única por viatura, vigência não invertida, versões sem sobreposição, e
um só dono do passado por número. Todas em zero.

Ver `stg.de_para_viatura` na seção de fatos operacionais — que deixou de ser
a chave de resolução e passou a ser relatório de qualidade.

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

**A coordenada que o painel usa não é lida direto da dimensão.** Ela passa por
`etl/mapa_forca/conferir_coordenadas.py`, que resolve e confere, porque a
coordenada gravada erra em silêncio — a varredura de 2026-08-26 achou uma no
Rio de Janeiro, duas com sinal invertido e uma apontando para a cidade vizinha.
Ordem das regras: coordenada própria conferida (com correção de sinal) → o
nome do posto é a sigla de uma unidade com coordenada → cidade citada no nome →
campo `municipio` (nunca para posto de evento) → coordenada da OME. Toda
coordenada é comparada com o polígono do município declarado pelo posto,
usando a malha oficial do IBGE, com 2 km de tolerância.

O campo `origemCoord` do índice do painel registra qual regra respondeu —
`posto`, `unidade`, `municipio` ou `ome` —, e o mapa desenha tracejado tudo
que não é `posto`. Distribuição em 2026-08-26: 103 / 7 / 32 / 43.

O campo `municipio` da dimensão **não serve para localizar o posto**: ele
guarda o município da OME. Os 20 postos municipais da CAT/ZM estão todos
gravados como CARPINA, e todo posto de `OPERAÇÃO *` está gravado como RECIFE.
Quem carrega a cidade de verdade é o NOME do posto.

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
| `dim_ome` | x | x | x | | x | x | x | | x |
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

`dim_ome`, `dim_tempo` e `dim_militar` aparecem em quase tudo — são
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

1. **Feito em 2026-08-26**: o fato casa direto contra a `dim_viatura` SCD2,
   pelo número de ordem normalizado (sem zeros à esquerda, sem sufixo `L`) e
   pela data dentro da vigência da versão — o desempate temporal que os
   números reciclados pediam. A `stg.de_para_viatura` deixou de ser a chave
   de resolução e virou relatório de qualidade.
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

## Reserva remunerada — o único domínio em que o Neon é a origem

Modelado e carregado em 2026-08-24. Três tabelas no `core`:

| Tabela | Grão | Estratégia |
|---|---|---|
| `fato_averbacao` | 1 averbação (560) | Transacional — a origem guarda histórico com id estável |
| `fato_afastamento_reserva` | 1 afastamento (8) | Transacional |
| `fato_previsao_reserva` | 1 militar por dia (2.658) | **Snapshot** |

### Por que dois fatos e não um

Averbação **soma** tempo (INSS, FFAA, PMPE, PM/BM de outros estados);
afastamento **subtrai** (LTIP, férias não gozadas). Seria tentador unir os
dois numa tabela genérica de ajuste, com um sinal. Não uni, por duas razões:
são eventos diferentes com atributos diferentes — a averbação tem processo do
INSS, o afastamento não — e o projeto já decidiu, na sessão do SGP, que evento
de pessoal vira fato próprio em vez de tabela genérica.

Quem quer o líquido usa `marts.tempo_reserva_por_militar`, que une os dois
com sinal. É a camada certa para isso: o `core` guarda o que aconteceu, a
`marts` responde a pergunta.

### Por que a previsão é snapshot

`reservaRequerimento` e `reservaCompulsoria` não são fato consumado: são
**previsão**, e mudam quando uma averbação nova entra. A origem só guarda a
previsão vigente — o histórico de como ela mudou só existe se nós guardarmos.
Mesma lógica de `fato_efetivo_diario`, e mesma limitação: depende de chave
substituta estável antes de a carga diária ser agendada.

> **Cuidado com o nome.** `fato_efetivo_diario.afastado` é outra coisa:
> "afastamento superior a 90 dias publicado em SP", que vem da planilha do
> Pecúlio. O `fato_afastamento_reserva` é o tempo que o sistema de reserva
> desconta da contagem. Daí o sufixo.

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

## Atualização 2026-10-01 — objetos novos ou alterados

- `core.fato_financeiro`: `oficio`, `item`, `empenho`, `ficha_financ_original`, `mes_original`,
  `mes_rotulo` (JAN..DEZ, ou NOV/2025) e `mes_ordem` (aaaamm). `ficha_financ` e `mes_rotulo`
  são os valores **tratados** (só grafia).
- `core.qod_quadro_unidade` (`15_qod_quadros.sql`): um quadro por unidade do GERAL 001, com as
  16 colunas de posto/graduação e o total. `sigla_organograma` liga ao organograma (Comando
  Geral soma no GCG, Subcomando Geral no GSG, CPPA na DGP).
- `core.qod_funcao` passa a vir de `raw_qod.id_atualizado`.
- Views `marts`: `previsto_quadro`, `painel_df_lancamento` (`14_financas_detalhe.sql`),
  `chefe_organograma` (Pecúlio; dono passou a `etl_writer`) e `efetivo_nominal` com
  `agregado` e `indisponivel`.
- **Regra de indisponível:** adido, ou afastado (LTS/LM), ou LTIP, ou LE, ou agregado (marca
  `Ag` na coluna OBS do Pecúlio). Readaptado sozinho continua disponível. Fica em
  `marts.efetivo_nominal.indisponivel` e em `ehIndisponivel()` (`src/lib/efetivoDashboard.js`).
- **Titular da unidade:** o mais antigo da OME pela ordem do Pecúlio (`stg.peculio.ordem`).
  Conferido contra a marca `Titular` da OBS: 45 de 45. Unidade sem OME no Pecúlio (DGA) sai
  vaga; a CPP repete o titular da CPO.
