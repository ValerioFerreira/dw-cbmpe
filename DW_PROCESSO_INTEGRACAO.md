# DW CBMPE — Processo de Integração de Novas Fontes de Dados

> **Isto é uma regra permanente de trabalho para o projeto `dw-cbmpe`**,
> válida em qualquer sessão futura — inclusive após `/compact` ou
> `/clear`. Está referenciada em [`AGENTS.md`](AGENTS.md) (carregado
> automaticamente em toda sessão) e existe também como skill de projeto em
> `.claude/skills/integrar-fonte-dw/SKILL.md`. Decisão registrada em
> [`DW_PLANEJAMENTO.md`](DW_PLANEJAMENTO.md) (2026-08-07).

## O fluxo

Toda vez que o usuário compartilhar uma nova fonte de dados a ser
integrada ao data warehouse, seguir estritamente esta ordem — **nunca
pular direto para o passo 3**:

### Passo 1 — Receber a fonte

O usuário envia a fonte: pode ser um arquivo (planilha, export, print),
uma descrição de sistema, uma amostra de dados, um link, etc. Não presumir
nada sobre o conteúdo antes de examiná-lo.

### Passo 2 — Esclarecer todas as dúvidas possíveis

Antes de propor qualquer integração, entender completamente a fonte.
Perguntar (usando `AskUserQuestion` quando fizer sentido) o que não estiver
claro, cobrindo pelo menos:

- **Significado dos campos**: o que cada coluna/campo representa de fato,
  não só o nome.
- **Grão**: cada linha representa o quê — um evento, um snapshot, uma
  pessoa, uma unidade, um período?
- **Relações**: como essa fonte se conecta ao que já existe no DW —
  especialmente com `dim_unidade` (ver [`DW_MODELO_DADOS.md`](DW_MODELO_DADOS.md)).
  Os identificadores de unidade batem com o organograma já modelado?
- **Qualidade conhecida**: campos vazios, inconsistências, duplicidade,
  unidades com nomes divergentes do organograma oficial, etc.
- **Frequência real de atualização**: de quanto em quanto tempo essa fonte
  muda de fato (não confundir com a frequência desejada no DW).
- **Responsável/dono da fonte**: quem mantém, quem pode esclarecer dúvidas
  futuras.
- **Sensibilidade**: contém PII? Dado agregado? Misto? (ver
  [`DW_GOVERNANCA.md`](DW_GOVERNANCA.md)).
- **Casos especiais**: unidades planejadas (ex. DGA — ver
  `DW_MODELO_DADOS.md`), unidades extintas, dados históricos vs. correntes.

Só avançar para o passo 3 quando não houver mais dúvida relevante em
aberto. Se algo permanecer incerto, registrar explicitamente como pendência
em vez de assumir.

### Passo 3 — Desenhar a integração

Com a fonte totalmente compreendida, desenhar como ela se conecta à
estrutura atual do DW:

1. Mapear os campos da fonte para dimensões/fatos existentes, ou propor
   novas dimensões/fatos/atributos quando necessário.
2. Identificar chaves e relações — como essa fonte se junta a
   `dim_unidade` e às demais dimensões já modeladas.
3. Atualizar [`DW_MODELO_DADOS.md`](DW_MODELO_DADOS.md) com o resultado.
4. Atualizar a linha correspondente em
   [`DW_CATALOGO_FONTES.md`](DW_CATALOGO_FONTES.md) (sai de "A LEVANTAR"
   para preenchido/confirmado).
5. Registrar a decisão no log de
   [`DW_PLANEJAMENTO.md`](DW_PLANEJAMENTO.md) — data, decisão, motivo.

## Por que este processo existe

Decisão explícita do usuário: integrar uma fonte sem entendê-la por
completo primeiro gera modelo de dados errado, retrabalho, e decisões
tomadas em cima de suposições — exatamente o que este projeto está
evitando desde a fundação (ver premissa em `DW_PLANEJAMENTO.md`: "não ache
que sabe qual é a fonte de algum dado"). Separar clareza (passo 2) de
design (passo 3) em etapas explícitas garante que a integração é sempre
consequência do entendimento, nunca o contrário.
