# Painel: Dashboard Pessoal — aba "Efetivo Geral"

Status: **prototipado e validado** (números conferem 100% com o Metabase atual)
Fonte usada no protótipo: `peculio_metabase_v1` (Base do pecúlio ativos) + aba `EFETIVO` do QOD (agosto/2026)
Fonte real de produção (padrão do DW): tabela `"Militar"` (Postgres/Neon), alimentada pelo Windmill a partir da mesma origem (cópia em Google Sheets do extrato de Pecúlio) — ver seção "Alinhamento com o padrão do DW" abaixo.

## Público

DGP (Diretoria de Gestão de Pessoal) e gestores que acompanham o efetivo geral da corporação.

## Objetivo

Dar uma visão consolidada de quantos militares a corporação tem hoje, como estão distribuídos
(região, posto, sexo, faixa etária, disponibilidade) e qual o tamanho do déficit em relação ao
quadro fixado em lei.

## Pergunta principal

Quantos militares temos, onde estão lotados, e o quanto estamos abaixo do efetivo previsto por posto?

## KPIs

| Nome | Fórmula | Fonte | Granularidade |
|---|---|---|---|
| Efetivo Total | `COUNT(*)` sobre militares com matrícula válida | peculio_metabase_v1 | 1 linha = 1 militar |
| Efetivo Disponível / Indisponível | Indisponível quando `afastamentos_sup_90_dias IN ('LM','LTS')` OU `ome = 'ADIDO'` OU `ltip = true` OU `le = true`; senão Disponível | peculio_metabase_v1 | idem |
| Efetivo por Região (QCG/DIM/DINTER 1/DINTER 2) | `ome` classificado por tabela de-para fixa (ver `filtros.json` / lista abaixo) | peculio_metabase_v1 | idem |
| Distribuição Oficiais x Praças | `posto_grad` classificado em duas listas fixas (oficiais vs. praças) | peculio_metabase_v1 | idem |
| Distribuição por sexo | `sexo` (M/F) | peculio_metabase_v1 | idem |
| Faixa etária | `idade` em 9 faixas fixas (18-22 ... 58-59, sem casos de 60+ hoje) | peculio_metabase_v1 | idem |
| Efetivo previsto x existente x déficit (por posto) | Previsto = quadro fixado em lei (aba `EFETIVO` do QOD); Existente = `COUNT(*) GROUP BY posto_grad`; Déficit = previsto − existente | QOD (EFETIVO) + peculio_metabase_v1 | 1 linha = 1 posto/graduação (24 linhas) |

## Visualizações

1. Cartões numéricos (stat tiles) — Efetivo Total, Disponível, Indisponível, QCG, DIM, DINTER 1, DINTER 2 — objetivo: leitura rápida do tamanho da força.
2. Donut — Oficiais x Praças — objetivo: composição do efetivo por categoria.
3. Donut — Sexo — objetivo: composição do efetivo por sexo.
4. Tabela — Efetivo previsto x existente x déficit por posto, com destaque de cor proporcional ao déficit percentual — objetivo: identificar os postos mais deficitários.
5. Barras — Faixa etária — objetivo: perfil etário da força.
6. Barras — Distribuição por OME dentro de cada região (QCG/DIM/DINTER 1/DINTER 2) — objetivo: identificar concentração de efetivo por unidade.

## Filtros

- **OME** (multi-seleção, com busca) — filtra todos os cartões, gráficos e a coluna "Efetivo existente" da tabela.
- **Patente/Posto** (multi-seleção) — idem, e filtra as linhas exibidas na tabela de déficit.
- Os dois filtros combinam com E (um militar precisa satisfazer ambos, quando os dois estão ativos) e com OU dentro do mesmo filtro (ex.: selecionar 2 OMEs traz militares de qualquer uma das duas).

## Interações

- Hover em barras e fatias do donut mostra tooltip com valor e percentual.
- Alternância de tema claro/escuro (paleta validada com o script de acessibilidade do skill de dataviz — ver nota de paleta abaixo).
- Painel de filtro com busca (OME) e atalhos "selecionar todas" / "limpar".

## Dados necessários (já disponíveis, validados nesta rodada)

- `peculio_metabase_v1`: `posto_grad`, `ome`, `afastamentos_sup_90_dias`, `le`, `ltip`, `idade`, `sexo`, `matricula` (usada só para excluir linhas inválidas).
- QOD agosto/2026, aba `EFETIVO`: efetivo fixado por posto/graduação (oficiais QOC, QOA e praças).

## Alinhamento com o padrão do DW

A tabela real de produção não é a `peculio_metabase_v1` usada para prototipar — é `"Militar"` (Postgres/Neon),
alimentada pelo Windmill a partir da mesma planilha de Pecúlio (ver `etl/efetivo/extract_efetivo.py`). Nomes de
campo confirmados até agora:

| Campo no protótipo | Campo canônico em `"Militar"` | Status |
|---|---|---|
| `posto_grad` | `"postoGrad"` | confirmado |
| `ome` | `ome` | confirmado — mas precisa do de-para `mapeamento_unidades.json` para virar sigla oficial |
| `matricula` | `matricula` | confirmado |
| `sexo` | `sexo` | confirmado |
| `idade` | `dataNascimento` (idade precisa ser calculada) | confirmado, com ressalva de LGPD — nunca expor a data de nascimento, só a idade calculada |
| `afastamentos_sup_90_dias` / `le` / `ltip` | desconhecido | **não confirmado** — não aparecem na query nominal básica do script; dependem de uma query "completos" ainda pendente de atualização no Windmill |

O de-para regional QCG/DIM/DINTER 1/DINTER 2 usado neste painel é uma convenção do Igor/Metabase, ainda não
conciliada com a árvore organizacional canônica do DW (`mapeamento_unidades.json` / `ARVORE` em
`extract_previsto_divisoes.py`). Duas divergências conhecidas: CAT/RMR (e demais CATs) ficam canonicamente
dentro de DIM, não em QCG; e ADIDO não é uma unidade própria — é dobrada em "COMANDO GERAL".

## Lacunas / pendências para o Valério

1. **Quadro fixado por unidade (OME).** Hoje só temos o efetivo fixado da corporação inteira (aba `EFETIVO` do QOD). Quando o filtro de OME está ativo no protótipo, as colunas "Efetivo previsto" e "Déficit" ficam ocultas (mostramos "—") porque não temos o quadro fixado quebrado por unidade — teríamos que extrair isso das ~90 abas individuais do QOD (uma por OME). Se for útil ter déficit por unidade (não só por posto), essa extração precisa ser feita e disponibilizada no DW.
2. **`acumulo_cargos`** existe na tabela mas não é usado nesta aba (fica para a aba "Militares com Acúmulo de Cargos").
3. **Sem script de extração para previsto por posto/graduação.** Só existem `extract_previsto.py` (por unidade) e `extract_previsto_divisoes.py` (por divisão). Se o card de déficit por posto virar oficial, precisa de um script equivalente.
4. **Campos de disponibilidade não confirmados em `"Militar"`.** `afastamentos_sup_90_dias`, `LE` e `LTIP` não aparecem na query nominal básica de `extract_efetivo.py` — dependem da query "completos" (pendente atualização do Windmill). Sem isso, os cards de Disponível/Indisponível podem ficar sem dado na integração real até essa atualização ser concluída.
5. **Regra de Adido/Agregado ainda não ratificada.** A contagem de Adidos como "Indisponível" é uma decisão de governança do DW registrada como EM ABERTO (`DW_MODELO_DADOS.md`) — não é regra oficial ainda, é convenção de trabalho do Igor. Acompanhar com Valério quando a decisão for tomada.
6. **Agrupamento regional (QCG/DIM/DINTER1/DINTER2) não conciliado com a árvore canônica.** Ver divergências na seção acima ("Alinhamento com o padrão do DW"). Decisão conjunta Igor + Valério antes de virar padrão oficial de BI.

## Recomendação

Esta aba tem alto valor gerencial (visão geral do efetivo, é a pergunta mais básica de qualquer gestor de pessoal) e os dados já suportam 100% dela sem depender de nada do Valério. Prioridade **alta** para seguir para as próximas abas do mesmo dashboard.

## Nota de paleta (dataviz)

Paleta categórica customizada (marca CBMPE, tons de vermelho): claro `#c0392b` / `#e8899c`, escuro `#e2574a` / `#ad3a7a`.
Validada com `scripts/validate_palette.js` do skill de dataviz — todos os testes de separação CVD, piso de leitura normal e contraste passaram (a rosa clara em modo claro tem contraste abaixo de 3:1 contra o fundo, por isso sempre acompanha legenda com texto, nunca só a cor).
