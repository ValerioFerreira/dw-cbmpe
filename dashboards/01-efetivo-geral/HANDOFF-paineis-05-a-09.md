# Handoff para o Claude Code — Painéis 05 a 09 do "Dashboard Pessoal"

**De:** protótipo de BI (esta sessão) · **Para:** implementação no sistema real (Claude Code)
**Data:** 19/08/2026
**Escopo:** continuação do que já foi inserido no sistema (Efetivo Geral, Distribuição Geográfica, Situações Funcionais, Militares Adidos) — abas 05, 06, 07 (parcial), 08 (parcial) e 09 (não iniciada).

---

## 1. Quais arquivos você precisa

Não é só o `index.html`. O `index.html` do protótipo tem ~1,6 MB porque carrega os ~2.658 registros embutidos em JSON dentro do próprio HTML — é ótimo para o Igor visualizar e validar números, mas ruim para o Code ler (é dado de exemplo congelado, não o formato de consumo real). O que importa para você entender **como os gráficos foram desenhados** é o código-fonte, que é bem mais enxuto:

| Arquivo | O que é | Por quê você precisa |
|---|---|---|
| `template.html` | Fonte de tudo — CSS, estrutura das abas e **todo o JavaScript** (funções de desenho dos gráficos, agregações, filtros). Os blocos de dado aparecem como placeholders (`##CARREIRA_EXTRA_JSON##` etc.), não dados reais. 74 KB. | É o "código" do protótipo. Tudo que está descrito neste documento remete a IDs e funções deste arquivo. |
| `carreira_extra.json` | Dataset auxiliar (2.658 linhas, sem PII) usado pelas abas 07 e 08: posto, categoria, ome, ano de movimentação/promoção/ingresso, tempo de serviço, tempo na OME atual. | É campo novo que não existia nas abas 01-04 — foi extraído do `Militar.json` que o Igor enviou. Mostra exatamente que campos/granularidade cada gráfico novo consome. |
| `adidos_extra.json` | Dataset auxiliar da aba 04 (Militares Adidos), incluído aqui só de referência — já deve estar com você desde a entrega anterior. | Opcional, caso precise conferir. |
| `spec-05-acumulo-cargos.json` | Ficha técnica da aba 05: público, objetivo, cards, validação numérica. | — |
| `spec-06-militares-pcd.json` | Idem, aba 06. | — |
| `spec-07-movimentacao-carreira.json` | Idem, aba 07 — inclui os 2 gaps bloqueados. | — |
| `spec-08-tempo-na-ome.json` | Idem, aba 08 — inclui o bloqueio de PII. | — |

As abas 01-04 (`militares.json`, `previsto.json`, `filtros.json`, `municipios_pe.json`) **não estão neste pacote** porque você já as recebeu e já estão no sistema.

---

## 2. Como o `template.html` está organizado (mapa rápido)

- Navegação das abas: `<div class="tab" data-tab="...">` — linhas 202-210 do arquivo atual.
- Cada aba tem um painel `<div class="tab-panel" id="panel-X" data-panel="X">`.
- Clique na aba dispara `refreshX()`, que lê o(s) dataset(s) relevante(s), agrega e chama uma função de desenho (`drawDonut`, `drawBars`, `drawGroupedBars`, `drawChoropleth`, `drawLine`, `drawHBars`) apontando para um `<div id="chartXxx">`.
- **Duas funções de desenho são novas nesta entrega** (não existiam quando as abas 01-04 foram passadas): `drawLine()` (série temporal — usada em "Movimentações por ano") e `drawHBars()` (barras horizontais rankeadas — usada em "Ingresso de militares"). Procure por essas duas funções no `template.html`, logo depois de `drawGroupedBars()`.
- Todas as cores categóricas usam só `var(--series-1)` (vermelho) e `var(--series-2)` (rosa), ciclando quando há mais de 2 categorias — é a paleta já validada (skill de dataviz) usada desde a aba 01. Se a implementação real usar outra lib de gráficos, o importante é preservar essa regra: nunca inventar uma 3ª cor categórica sem rodar o validador de paleta.

Importante: o protótipo é HTML/CSS/JS puro com SVG desenhado à mão (sem biblioteca de gráficos). Isso é deliberado para o protótipo estático, mas **não precisa ser copiado literalmente** se o sistema real usa outra stack (React + alguma lib de charts, por exemplo) — o que precisa ser preservado é a *lógica* (quais campos, que agregação, que ordenação, que bucket) documentada abaixo, não o SVG em si.

---

## 3. Painel 05 — Militares com Acúmulo de Cargos

**Status: PRONTO — prototipado e validado 100%. Nenhum dado novo necessário.**

- Aba: `data-tab="acumulo"` → painel `#panel-acumulo` (grid `#grid5`), linhas ~438-452 do `template.html`.
- Público: DGP e gestores de efetivo. Pergunta: quantos militares acumulam outro cargo/função externa, quem são (posto) e onde estão lotados.
- Fonte: mesma base das abas 01-03 (`militares.json` / tabela `Militar`). Campo `acumuloCargos` (texto livre com a função externa, ou nulo) já existe desde a aba 01 — não depende de `carreira_extra.json`.

Cards:
1. **Acúmulo de Cargos** (stat) — `count(acumuloCargos não nulo)`. Validado: **24**.
2. **Militares com Acúmulo de Cargos por Posto/Graduação** (donut) — agrupado por `posto_grad`. Validado: 3ºSgt 8 (33,3%), Cb 7 (29,2%), Sd 5 (20,8%), 2ºSgt 3 (12,5%), 2ºTen QOC 1 (4,2%).
3. **Distribuição de Militares com Acúmulo de Cargos** (barras) — agrupado por `ome`, ordenado desc. Validado: 14 OMEs, total 24 (5ºGB 4, 4ºGB 3, CMan/GBS/7ºGB/1ºGB/GBMar 2 cada, demais 1 cada).

Sem gaps. Ver `spec-05-acumulo-cargos.json` para o detalhe completo.

---

## 4. Painel 06 — Militares PCD's

**Status: PRONTO — prototipado e validado 100%. Nenhum dado novo necessário.**

- Aba: `data-tab="pcd"` → painel `#panel-pcd` (grid `#grid6`), linhas ~454-468.
- Público/objetivo: quantos militares com deficiência (PCD) a corporação tem, de que posto e onde estão lotados.
- Fonte: campo `pcd` (booleano), já existente desde a aba 01.

Cards:
1. **PCD's** (stat) — `count(pcd=true)`. Validado: **13**.
2. **Distribuição de Militares PCD's** (barras) — por `ome`, ordenado desc. Validado: 12 OMEs (3ºGB 2, demais 1 cada = 13).
3. **Militares PCD's por Posto/Graduação** (donut) — por `posto_grad`. Validado: Sd 7 (53,8%), Cb 4 (30,8%), 2ºTen QOC 2 (15,4%).

Sem gaps. Ver `spec-06-militares-pcd.json`.

---

## 5. Painel 07 — Movimentação e Carreira

**Status: PARCIAL — 4 de 6 quadrantes prontos e validados; 2 bloqueados por falta de fonte/regra.**

- Aba: `data-tab="carreira"` → painel `#panel-carreira` (grid `#grid7`), linhas ~470-497.
- Público/objetivo: mostrar o ritmo de movimentações, promoções e ingressos ao longo do tempo, e o perfil de tempo de serviço da corporação.
- Fonte nova: `carreira_extra.json` (2.658 linhas, sem PII), extraído do `Militar.json` que o Igor enviou. Campos: `posto`, `categoria`, `ome`, `anoMovimentacao`, `anoPromocao`, `anoIngresso`, `tempoServicoAnos`, `tempoOmeAnos`.

### 5.1 Quadrantes prontos

1. **Movimentações por ano** (linha, `drawLine`) — agrupado por `ano(dataMovimentacaoSp)`, série 1998-2026. Validado contra o print, inclusive o pico de 845 em 2026. 29 registros sem data ficam de fora (não achatam a linha).
2. **Promoções por ano** (barras) — agrupado por `ano(dataUltimaPromocao)`. **Ressalva importante:** bate exatamente com o print em 2018-2021 (29/39/67/273), mas diverge para cima a partir de 2022 (ex.: 2022 mostra 415 no protótipo vs. 227 no print original do Igor). Isso não é erro de cálculo — `Militar.json` é um snapshot vivo (extraído em 18/08/2026), e cada promoção nova empurra a "data da última promoção" daquele militar para o ano em que ela realmente aconteceu. Ou seja, quanto mais perto de hoje, mais o número tende a estar "mais atualizado" que o print antigo do Igor. **Decisão de produto pendente:** perguntar ao Igor se ele quer travar numa data de referência fixa (replicar o corte exato do Metabase) ou aceitar que esse card sempre reflita o dado mais recente disponível.
3. **Ingresso de militares** (barras horizontais, `drawHBars`) — agrupado por `ano(dataIngresso)`. Bate exatamente com o print para 1991-2019 (dado estático). Para 2020-2026, o protótipo optou por mostrar os anos individualmente (15/2/184/15/296/346) em vez de agrupá-los num bucket "Outros (6)" como no Metabase original — a soma bate exata (858), e a decisão foi deliberada (mais detalhe é mais útil). Se preferir replicar exatamente o agrupamento do Metabase, é só reintroduzir o bucket "Outros".
4. **Tempo de serviço em anos** (barras) — `tempoServicoAnos` em buckets de 5 em 5 anos (0-5/6-10/11-15/16-20/21-25/26-30/31-35). Bate exatamente com o print nos 7 buckets (845/259/359/759/108/249/79 = 2.658).

### 5.2 Quadrantes bloqueados (precisam de dado/regra que não temos)

5. **Saída de militares** (barras) — **BLOQUEADO, sem fonte identificada.** Nem `Militar.json` nem a base de Pecúlio (`peculio_metabase_v1`) têm um campo ou tabela com histórico de saída/transferência por OME. O total do print do Igor (somando 2015-2026) é **1.218 eventos** — muito mais que os 45 registros inativos que existem em `Militar.json`, então não é simplesmente "militares que saíram da corporação". Provavelmente é uma tabela de movimentação histórica separada (um log de transferências), que ainda não temos.
   **Necessidade de dados para BI:**
   - Painel: Movimentação e Carreira
   - Necessidade: histórico de saída/transferência por OME e por ano
   - Situação: fonte não identificada — nem em `Militar.json`, nem em `peculio_metabase_v1`
   - Impacto: impede a construção deste quadrante
   - Ação: pedir a Igor o SQL ou nome da tabela usados no Metabase original para este card.

6. **Previsão de saída** (barras agrupadas, Oficiais x Praças) — **BLOQUEADO, regra ambígua.** `Militar.json` traz duas datas de reserva por militar (`reservaRequerimento` e `reservaCompulsoria`), mas nenhuma das duas — isolada ou combinada — reproduz os anos/totais do print (que mostra só 9 anos entre 2027-2040, somando ~1.161, enquanto as datas de reserva cobrem dezenas de anos até 2072 e somam ~2.657 cada).
   **Necessidade de dados para BI:**
   - Painel: Movimentação e Carreira
   - Necessidade: regra de negócio exata para "previsão de saída" (qual campo, qual cálculo, qual corte temporal)
   - Campos candidatos já checados e descartados isoladamente: `reservaRequerimento`, `reservaCompulsoria`
   - Ação: pedir a Igor a SQL/regra usada no Metabase original.

Ver `spec-07-movimentacao-carreira.json` para o detalhe técnico completo de cada card.

---

## 6. Painel 08 — Tempo na OME

**Status: PARCIAL — 3 de 4 quadrantes prontos e validados; 1 bloqueado por decisão de produto (não é falta de dado).**

- Aba: `data-tab="tempoome"` → painel `#panel-tempoome` (grid `#grid8`), linhas ~499-553.
- Público/objetivo: mostrar há quanto tempo cada militar está na OME atual, agregado e (opcionalmente) nominal.
- Fonte: `carreira_extra.json`, campo `tempoOmeAnos` (derivado de `tempoObmAtualDias` do `Militar.json` — dias exatos desde a última movimentação). Este campo é **muito preciso** para esta aba: bate exatamente com o print em todos os buckets do quadrante geral e nas médias por posto — diferente do que aconteceu no painel 04 (Militares Adidos), onde o mesmo campo divergiu do print só para o subconjunto de adidos (ver achado registrado no `spec-04-militares-adidos.json` e no log do projeto — ainda sem explicação, pergunta em aberto para o Igor).
- Filtros replicados: Posto/Graduação (multiseleção) e Anos na OME atual (intervalo min/max) — mesmo padrão de UI usado na aba 02.

### 6.1 Quadrantes prontos

1. **Distribuição por tempo na OME atual** (barras) — `tempoOmeAnos` em buckets 0-1/2/3/4/5/6/7+ anos. Bate exatamente com o print nos 7 buckets (1.076/162/157/131/214/126/792 = 2.658). Nenhum registro sem dado.
2. **Tempo médio de permanência em OMEs — Praças** (barras) — `avg(tempoOmeAnos)` truncado para inteiro, por posto (Subten/1ºSgt/2ºSgt/3ºSgt/Cb/Sd). Bate exatamente (6/18/13/7/5/2).
3. **Tempo médio de permanência em OMEs — Oficiais** (barras) — mesmo cálculo, postos (Cel/Ten Cel/Maj QOC/Maj QOA/Cap QOA/1ºTen QOC/1ºTen QOA/2ºTen QOC/2ºTen QOA). Bate exatamente (3/1/2/5/2/2/2/1/2). **Atenção:** essa lista de postos foi replicada exatamente como aparece no print original — Cap QOC tem 0 militares hoje (mesmo déficit de 100% já registrado no painel 01) e "Aspirante" não aparece neste quadrante específico. Não é a regra genérica de categoria Oficiais/Praças usada no painel 01; é a lista literal do card do Metabase.

### 6.2 Quadrante bloqueado

4. **Informações dos militares** (tabela: Matrícula, Posto/Graduação, Nome de Guerra, OME, Tempo na OME atual) — **BLOQUEADO por decisão de produto, não por falta de dado.** `Militar.json` tem `matricula` e `nomeGuerra`, mas desde a aba 01 este protótipo deliberadamente **não** embute dado pessoal identificável (PII) no HTML por padrão — o arquivo circula com os dados em texto puro, mais fácil de vazar do que o Metabase autenticado.
   **Decisão que falta:** Igor precisa confirmar se quer essa tabela com Matrícula/Nome de Guerra mesmo assim (aceitando o risco de exposição, já que é dado pessoal identificável circulando fora de um ambiente autenticado), ou se prefere manter a tabela só com Posto/Graduação, OME e Tempo na OME atual (sem identificação individual). Essa decisão vale como precedente para qualquer outra tabela nominal que apareça em abas futuras.

Ver `spec-08-tempo-na-ome.json`.

---

## 7. Painel 09 — Intenção de Movimentação

**Status: NÃO INICIADO. Bloqueado por falta do dado bruto (só temos os tópicos das consultas, não os dados nem o SQL literal).**

- No `template.html` esta aba ainda está desabilitada: `<div class="tab disabled" title="Ainda não prototipado — aguardando fonte de dados (ver mensagem)">Intenção de Movimentação</div>` (linha 209). Nenhum painel/HTML foi construído para ela.
- Fonte: duas tabelas Postgres novas, **`cim_pedidos`** e **`cim_atendidos`** — não têm sobreposição com `Militar`/`militares.json`. É uma fonte genuinamente nova.
- Igor enviou, no chat desta sessão, 8 consultas SQL contra essas tabelas, cobrindo os seguintes cards (pelos títulos/tópicos, não tenho mais o texto literal do SQL guardado — ver observação abaixo):
  1. Total de solicitações
  2. Distribuição das OMEs solicitadas como 1ª opção
  3. As 5 OMEs mais solicitadas em todas as opções
  4. Distribuição das solicitações
  5. Origem das solicitações
  6. Total de transferências atendidas
  7. Distribuição de Militares Transferidos por OME
  8. Militares transferidos por Posto e Graduação
- **Card visível no print que NÃO tem SQL correspondente entre as 8 enviadas:** "Solicitações por Posto e Graduação" (valores no print: 167/15/13/4/1/1). Falta o SQL desse card específico, ou ele precisa ser inferido diretamente da tabela bruta assim que ela for exportada.

**Observação importante sobre o SQL:** o texto literal das 8 queries foi enviado pelo Igor no chat, mas esta sessão passou por uma compactação de contexto (resumo automático por limite de tamanho) entre o envio do SQL e este momento — o resumo preservou os tópicos/objetivo de cada query, mas não o texto SQL literal linha a linha. **Recomendo pedir ao Igor para reenviar as 8 consultas junto com o export das tabelas**, para não perder nomes de coluna e regras de negócio exatas (ex.: o que conta como "atendido", como "origem" é definida).

**Necessidade de dados para BI (registro formal):**
- Painel: Intenção de Movimentação (aba nova, ainda sem nenhum card construído)
- Necessidade: export bruto (linhas, não resultado agregado) de `cim_pedidos` e `cim_atendidos`, mais o SQL das 8 queries (reenviado) e o SQL/fonte do card "Solicitações por Posto e Graduação"
- Perguntas em aberto para Igor:
  1. O campo "categoria" dessas tabelas corresponde ao filtro de "Patente" usado nas outras abas do dashboard?
  2. Qual é a fonte do card "Solicitações por Posto e Graduação"?
- Situação: nenhum dado recebido ainda: apenas os tópicos das 8 consultas.
- Impacto: bloqueia a aba inteira (0 de N cards construídos).

---

## 8. Achados/decisões que valem a pena carregar para o sistema real

- **Princípio de PII:** nenhuma aba deste protótipo expõe matrícula/nome/nome de guerra por padrão. Ao implementar de verdade (com autenticação real do sistema), vale decidir explicitamente, aba por aba, se dado nominal é apropriado — não assumir que "porque está disponível no banco, deve aparecer".
- **Divergência do campo de tempo na unidade:** `tempoObmAtualDias` (de `Militar.json`) bate perfeitamente com o print no painel 08 (população inteira) mas diverge bastante só no subconjunto de Adidos do painel 04. Ainda não sabemos por quê — pode ser que "tempo na unidade" para adidos use uma data-base diferente (ex.: data em que virou adido, não a última movimentação de SP genérica). Vale confirmar com Igor/Valério antes de usar esse campo com confiança total em qualquer contexto de Adidos.
- **"Promoções por ano" é sensível à data de extração:** qualquer implementação com dado ao vivo vai sempre mostrar os anos mais recentes "crescendo" à medida que promoções acontecem, porque o campo é "data da última promoção", não um evento histórico imutável. Não é bug.
- **Paleta de cores:** só usar as duas cores categóricas já validadas (vermelho/rosa do design system), ciclando quando houver mais de 2 categorias. Rodar o validador de paleta antes de introduzir qualquer cor nova.

---

## 9. Resumo do status por aba

| Aba | Status | Cards prontos | Cards bloqueados | Bloqueio |
|---|---|---|---|---|
| 05 — Acúmulo de Cargos | ✅ Pronto | 3/3 | 0 | — |
| 06 — PCD's | ✅ Pronto | 3/3 | 0 | — |
| 07 — Movimentação e Carreira | 🟡 Parcial | 4/6 | 2 | Falta fonte de "Saída de militares" e regra de "Previsão de saída" |
| 08 — Tempo na OME | 🟡 Parcial | 3/4 | 1 | Decisão de PII pendente (não é falta de dado) |
| 09 — Intenção de Movimentação | 🔴 Não iniciado | 0/8-9 | todos | Falta export bruto de `cim_pedidos`/`cim_atendidos` + reenvio do SQL |
