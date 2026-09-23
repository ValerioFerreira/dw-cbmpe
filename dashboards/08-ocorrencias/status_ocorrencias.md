# status_ocorrencias.md — Dashboard de Ocorrências (CBMPE)

Última atualização: 2026-09-16. Projeto: suite "Planilhas corporativas integradas" (Painéis
BI - DW, projeto guarda-chuva). Escopo independente de PLAN DLOG, DF e Vacinações — nenhum
dado ou suposição cruzada entre eles.

Entregáveis atuais:
- `dashboard-ocorrencias.html` — card embutido (8 abas), padrão de integração completo.
- `geojs-26-mun.json` — geometria dos municípios de PE usada no mapa da aba Geolocalização.

---

## 1. O que foi validado (com fonte)

Legenda de status (também presente como comentário e campo `status` no `DASHBOARD_DATA` do
HTML, e como indicador visual — bolinha verde/vinho/âmbar ao lado do título de cada card):
- 🟢 **confirmed** — validado via SQL executado ou CSV/tabela exportada do Metabase.
- 🔴 **print** — validado só por print, com reconciliação de total (soma das partes bate com
  o card de total) como método de checagem.
- 🟠 **pending** — achado de qualidade de dado sinalizado, não confirmado ainda.

### Visão Geral (status geral: 🟢 confirmed em tudo, exceto "Natureza")
Diretoria, Motivos dos não-atendimentos, Grupos mais frequentes, Ocorrências por OME, Status
dos relatórios, Aguardando finalização, Evolução semanal de ocorrências, **Finalizadas**
(SQL confirmado em 2026-09-16, ver seção 3 — era erro de exportação, não bug no card) — todos
🟢 confirmed. Donut "Natureza" segue 🔴 print (SQL recebido, mas sem CSV/resultado com os
valores absolutos ainda).

### APH (status geral: 🟢 confirmed em tudo — 2 com ressalva documentada)
Todos os 10 quadrantes têm SQL confirmado (recebido em 2026-09-16). Duas ressalvas, não
bloqueantes, documentadas na seção 3: "Vítimas entregues com vida" (falta filtro `protocolo
IS NOT NULL`, explica diferença de 2 unidades no total) e "Situação das vítimas" (bug de
`WHERE` no `UNION ALL` da query original do Metabase — não corrigido, só documentado).

### Incêndio (status geral: 🟢 confirmed, SQL completo)
Todos os 6 quadrantes validados com SQL, incluindo "Duração média" (tabela completa, 9 OMEs,
Combate/Rescaldo/Total).

### Salvamento (status geral: 🟢 confirmed, SQL completo)
Todos os 7 quadrantes validados, incluindo CSV de "Ocorrências diárias" (236 dias, soma exata
= Finalizadas + Aguardando finalização) e tabela de "Tipo Predominante" (19 categorias, soma
exata = total do donut).

### Prevenção (status geral: 🟢 confirmed, SQL completo — exceto "Área média dos eventos")
Tabela-fonte diferente: `public.roe_prevencao_ocorrencias` (não `roe_basico_ocorrencias`).
"Área média dos eventos" — 🔴 print (valores lidos do gráfico, sem tabela). Demais 3
quadrantes (Duração média, Público estimado x presente, Situação dos AVCBs) — 🟢 confirmed.

### Produtos Perigosos (status geral: parcial — ver pendência #1)
Finalizadas, Aguardando finalização, Total de vítimas, Perfil dos Botijões de GLP, Evolução
histórica — 🟢 confirmed. "Total por produto" — 🟠 pending (ver seção 3).

### Geolocalização (status geral: 🟢 confirmed)
Stat + mapa coroplético (CSV de 189 cidades reconciliado com geoJSON de 185 municípios de PE
+ Fernando de Noronha em mapa separado).

### Perfil de vítimas (status geral: 🟢 confirmed, SQL completo)
Todos os 5 quadrantes validados.

---

---

## 1b. SQL completo — Visão Geral e APH (recebido 2026-09-16)

**Visão Geral — Aguardando finalização:**
```sql
SELECT COUNT(*) AS "count"
FROM "public"."roe_basico_ocorrencias"
WHERE ("public"."roe_basico_ocorrencias"."status_relatorio" <> 'Finalizado')
   OR ("public"."roe_basico_ocorrencias"."status_relatorio" IS NULL)
```
Nota: sem filtro de `protocolo`/`data_recebimento`/`natureza` — mais simples que as queries
irmãs de outras abas. Não é necessariamente erro (pode ser intencional para esse card
específico), só uma diferença de padrão a observar.

**Visão Geral — Diretoria:**
```sql
SELECT "public"."roe_basico_ocorrencias"."diretoria" AS "diretoria", COUNT(*) AS "count"
FROM "public"."roe_basico_ocorrencias"
WHERE "public"."roe_basico_ocorrencias"."status_relatorio" = 'Finalizado'
GROUP BY "public"."roe_basico_ocorrencias"."diretoria"
ORDER BY "count" DESC, "public"."roe_basico_ocorrencias"."diretoria" ASC
```

**Visão Geral — Motivos dos não-atendimentos:**
```sql
SELECT "public"."roe_basico_ocorrencias"."motivo_naoatendimento" AS "motivo_naoatendimento", COUNT(*) AS "count"
FROM "public"."roe_basico_ocorrencias"
WHERE ("public"."roe_basico_ocorrencias"."motivo_naoatendimento" IS NOT NULL)
  AND (("public"."roe_basico_ocorrencias"."motivo_naoatendimento" <> '') OR ("public"."roe_basico_ocorrencias"."motivo_naoatendimento" IS NULL))
  AND ("public"."roe_basico_ocorrencias"."status_relatorio" = 'Finalizado')
GROUP BY "public"."roe_basico_ocorrencias"."motivo_naoatendimento"
ORDER BY "count" DESC, "public"."roe_basico_ocorrencias"."motivo_naoatendimento" ASC
```

**Visão Geral — Natureza (retorna valores absolutos, não percentuais):**
```sql
SELECT "public"."roe_basico_ocorrencias"."natureza" AS "natureza", COUNT(*) AS "count"
FROM "public"."roe_basico_ocorrencias"
WHERE ("public"."roe_basico_ocorrencias"."natureza" IS NOT NULL)
  AND (("public"."roe_basico_ocorrencias"."natureza" <> '') OR ("public"."roe_basico_ocorrencias"."natureza" IS NULL))
  AND ("public"."roe_basico_ocorrencias"."status_relatorio" = 'Finalizado')
GROUP BY "public"."roe_basico_ocorrencias"."natureza"
ORDER BY "count" DESC, "public"."roe_basico_ocorrencias"."natureza" ASC
```
Nota: essa query devolve uma linha por natureza (Atendimento Pré-Hospitalar, Salvamento,
Prevenção, Incêndio, Produtos Perigosos, Atividade Comunitária), sem agrupar em "Outros" — a
fatia "Outros" (3%) do donut é um agrupamento visual do próprio Metabase (top N + resto), não
algo que vem pronto do banco. **Sem resultado/CSV recebido ainda** — dashboard segue com os
percentuais do print até receber os valores absolutos.

**Visão Geral — Grupos mais frequentes (LIMIT 5):**
```sql
SELECT "public"."roe_basico_ocorrencias"."grupo" AS "grupo", COUNT(*) AS "count"
FROM "public"."roe_basico_ocorrencias"
WHERE "public"."roe_basico_ocorrencias"."status_relatorio" = 'Finalizado'
GROUP BY "public"."roe_basico_ocorrencias"."grupo"
ORDER BY "count" DESC, "public"."roe_basico_ocorrencias"."grupo" ASC
LIMIT 5
```

**Visão Geral — Ocorrências por OME:**
```sql
SELECT "public"."roe_basico_ocorrencias"."ome" AS "ome", COUNT(*) AS "count"
FROM "public"."roe_basico_ocorrencias"
WHERE "public"."roe_basico_ocorrencias"."status_relatorio" = 'Finalizado'
GROUP BY "public"."roe_basico_ocorrencias"."ome"
ORDER BY "count" DESC, "public"."roe_basico_ocorrencias"."ome" ASC
```

**Visão Geral — Status dos relatórios:**
```sql
SELECT "source"."status_relatorio" AS "status_relatorio", COUNT(*) AS "count"
FROM (
  SELECT basico.*,
    CASE WHEN basico.ocorrencia_atendida = true THEN 'Sim'
         WHEN basico.ocorrencia_atendida = false THEN 'Não'
         ELSE NULL END AS ocorrencia_atendida_txt
  FROM roe_basico_ocorrencias basico
  WHERE 1=1  -- placeholders de filtro do Metabase, nenhum filtro real ativo aqui
) AS "source"
GROUP BY "source"."status_relatorio"
ORDER BY "source"."status_relatorio" ASC
```
Nota: sem filtro nenhum de fato aplicado — conta a tabela inteira, o que é consistente com o
total do donut (31.437) bater exatamente com Finalizadas (30.794) + Aguardando finalização
(643): o card cataloga todo status possível, não só os finalizados.

**APH — Finalizadas:**
```sql
SELECT COUNT(*) AS "count"
FROM "public"."roe_basico_ocorrencias"
WHERE ("public"."roe_basico_ocorrencias"."data_recebimento" >= timestamp '2025-11-01 00:00:00.000')
  AND ("public"."roe_basico_ocorrencias"."protocolo" IS NOT NULL)
  AND (("public"."roe_basico_ocorrencias"."protocolo" <> '') OR ("public"."roe_basico_ocorrencias"."protocolo" IS NULL))
  AND ("public"."roe_basico_ocorrencias"."status_relatorio" = 'Finalizado')
  AND ("public"."roe_basico_ocorrencias"."natureza" = 'Atendimento Pré-Hospitalar')
```

**APH — Aguardando finalização:**
```sql
SELECT COUNT(*) AS "count"
FROM "public"."roe_basico_ocorrencias"
WHERE ("public"."roe_basico_ocorrencias"."data_recebimento" >= timestamp '2025-11-01 00:00:00.000')
  AND ("public"."roe_basico_ocorrencias"."protocolo" IS NOT NULL)
  AND (("public"."roe_basico_ocorrencias"."protocolo" <> '') OR ("public"."roe_basico_ocorrencias"."protocolo" IS NULL))
  AND (("public"."roe_basico_ocorrencias"."status_relatorio" <> 'Finalizado') OR ("public"."roe_basico_ocorrencias"."status_relatorio" IS NULL))
  AND ("public"."roe_basico_ocorrencias"."natureza" = 'Atendimento Pré-Hospitalar')
```

**APH — Atendimentos a CVI:** usa o modelo salvo "Dados para estatística - APH" (CTE que junta
`roe_basico_ocorrencias` + `roe_aph_ocorrencias`, já filtrando `natureza = 'Atendimento
Pré-Hospitalar'` internamente), filtrando `status_relatorio = 'Finalizado'` e `cvi IS NOT
NULL`, agrupando por `cvi`. Mesmo modelo reutilizado em "Vítimas entregues com vida" (Perfil
de vítimas) e "Vítimas com deficiência".

**APH — Cidade (LIMIT 5):**
```sql
SELECT "public"."roe_basico_ocorrencias"."cidade" AS "cidade", COUNT(*) AS "count"
FROM "public"."roe_basico_ocorrencias"
WHERE ("public"."roe_basico_ocorrencias"."natureza" = 'Atendimento Pré-Hospitalar')
  AND ("public"."roe_basico_ocorrencias"."status_relatorio" = 'Finalizado')
GROUP BY "public"."roe_basico_ocorrencias"."cidade"
ORDER BY "count" DESC, "public"."roe_basico_ocorrencias"."cidade" ASC
LIMIT 5
```

**APH — Subgrupo (LIMIT 5, exclui Outro/Diversos):**
```sql
SELECT "public"."roe_basico_ocorrencias"."subgrupo" AS "subgrupo", COUNT(*) AS "count"
FROM "public"."roe_basico_ocorrencias"
WHERE (("public"."roe_basico_ocorrencias"."subgrupo" <> 'Outro') OR ("public"."roe_basico_ocorrencias"."subgrupo" IS NULL))
  AND (("public"."roe_basico_ocorrencias"."subgrupo" <> 'Diversos') OR ("public"."roe_basico_ocorrencias"."subgrupo" IS NULL))
  AND ("public"."roe_basico_ocorrencias"."natureza" = 'Atendimento Pré-Hospitalar')
  AND ("public"."roe_basico_ocorrencias"."status_relatorio" = 'Finalizado')
GROUP BY "public"."roe_basico_ocorrencias"."subgrupo"
ORDER BY "count" DESC, "public"."roe_basico_ocorrencias"."subgrupo" ASC
LIMIT 5
```

**APH — Vítimas entregues com vida:** usa o mesmo modelo "Dados para estatística - APH",
filtrando `data_recebimento >= 2025-11-01` e `status_relatorio = 'Finalizado'` (sem
`protocolo IS NOT NULL` — ver ressalva na seção 3), agrupando por `entregue_vivo_texto`.

**APH — Situação das vítimas:** ver query completa e o bug identificado na seção 3.

---

## 2. Decisões tomadas (com data e motivo)

- **2026-08-25** — Manter a semana partida no gráfico "Ocorrências semanais" da aba APH (44
  pontos, não consolidar em 42), porque a query original do Metabase agrupa por semana **e**
  por mês. Motivo: usuário decidiu manter fiel ao Metabase em vez de normalizar.
- **2026-08-25** — Reconciliação de cidades no mapa da aba Geolocalização:
  1. Unificar grafia entre CSV e geoJSON (Belém do/de São Francisco, São Vicente Férrer/Ferrer,
     Lagoa de/do Itaenga, Iguaracy/Iguaraci) — tratadas como a mesma cidade, usando o nome do
     geoJSON como padrão.
  2. Cidades fora de Pernambuco no CSV (10 cidades, ex.: Curitiba, João Pessoa) → categoria
     "Não classificado", fora do mapa. Usuário vai investigar a causa depois.
  3. Linha com `cidade` nulo no banco (3.812 ocorrências) → categoria "Não informado".
  4. 7 municípios do geoJSON sem ocorrências no CSV → zero real, cor "sem dado" no mapa.
- **2026-09-09** — Card "Divisão por gênero - Duplicar" (Perfil de vítimas) renomeado para
  "Divisão por gênero" no dashboard final — nome original parecia resíduo de card duplicado
  não renomeado no Metabase.
- **2026-09-09** — Dashboard gerado com os dados validados embutidos (não nasceu "vazio" como
  planejado inicialmente) — usuário pediu para carregar com os dados já validados, a pedido
  explícito, mantendo a documentação como registro para caso precise recarregar depois.
- **2026-09-16** — Produtos Perigosos → "Evolução histórica" (5.253 registros sem data): Igor
  decidiu **não investigar a causa nem decidir o tratamento visual agora**, para não correr o
  risco de rodar um comando de diagnóstico que não reflita a estrutura real do banco. Fica
  para o Valério: (1) rodar a query de diagnóstico abaixo para separar as duas causas
  possíveis — registro órfão (`roe_basico_id` sem correspondência) vs. registro válido com
  `data_recebimento` nula — e (2) decidir/validar com Igor como exibir o resultado.
  ```sql
  SELECT
    COUNT(*) FILTER (WHERE b.roe_id IS NULL) AS sem_match_na_basico,
    COUNT(*) FILTER (WHERE b.roe_id IS NOT NULL AND b.data_recebimento IS NULL) AS match_mas_data_nula,
    COUNT(*) FILTER (WHERE b.data_recebimento IS NOT NULL) AS com_data
  FROM "public"."roe_prod_perigosos_ocorrencias" p
  LEFT JOIN "public"."roe_basico_ocorrencias" b ON p.roe_basico_id = b.roe_id
  ```
- **2026-09-16** — Produtos Perigosos → filtros da aba: Igor confirmou (via novo print) que
  essa aba **não tem filtro nenhum** no Metabase original — diferente de todas as outras abas.
  Os 4 filtros que estavam no dashboard por suposição foram removidos; a barra de filtros
  agora fica oculta só nessa aba.
- **2026-09-16** — Igor mandou um novo print da aba Produtos Perigosos com números diferentes
  dos validados anteriormente (ex.: Finalizadas 9.789 vs. 7.736 validado; Total por produto
  14.983 vs. 13.593 validado; linha "Evolução histórica" com pontos novos até 13/9/2026).
  Decisão: **não atualizar os valores embutidos** — são snapshots de momentos diferentes (base
  viva), e o objetivo é deixar a estrutura pronta para integração, não manter o HTML
  sincronizado manualmente a cada novo print.
- **2026-09-16** — Correção de padrão: o dashboard havia sido construído com paleta navy
  inventada e como página standalone (com topbar/brand/breadcrumb). Corrigido para o padrão
  real "Planilhas corporativas integradas" (paleta `#970706`/`#C51132`/etc., confirmada por
  amostragem de pixel em sessão anterior do Dashboard DF, já salva em memória) e para o
  formato "card embutido" (sem chrome de página), alinhado ao padrão usado em PLAN DLOG, DF e
  Vacinações. Também adicionado: filtros reais (`<select>`) com listas centralizadas, spinner
  simulado em troca de filtro, estado vazio, `reloadDashboardData(tabId, filtros)` como ponto
  único de integração (`// TODO (integração)`), Chart.js 4.4.0 e fonte Inter embutidos via npm
  (sem CDN), flags de status (`confirmed`/`print`/`pending`) por quadrante no `DASHBOARD_DATA`.

---

## 3. Divergências encontradas (mesmo sem solução)

- **✅ RESOLVIDO (2026-09-16) — Visão Geral → "Finalizadas": era erro de exportação, não bug
  no card.** Igor mandou a query real salva no card, e ela confirma: sem filtro de natureza,
  só `status_relatorio = 'Finalizado'` + `diretoria IS NOT NULL` (e não vazia) — consistente
  com a query de "Diretoria" (soma 30.794). A query anterior (com filtro de APH) tinha sido
  colada errada na hora de exportar do Metabase, não refletia o card de verdade.
  ```sql
  SELECT COUNT(*) AS "count"
  FROM "public"."roe_basico_ocorrencias"
  WHERE ("public"."roe_basico_ocorrencias"."status_relatorio" = 'Finalizado')
    AND ("public"."roe_basico_ocorrencias"."diretoria" IS NOT NULL)
    AND (("public"."roe_basico_ocorrencias"."diretoria" <> '') OR ("public"."roe_basico_ocorrencias"."diretoria" IS NULL))
  ```
- **🔴 CRÍTICO — APH → "Situação das vítimas": bug de `WHERE` na query original do Metabase.**
  ```sql
  SELECT 'Feridas' AS situacao, SUM(qtde_vitimas_feridas) AS total FROM roe_basico_ocorrencias
  UNION ALL
  SELECT 'Fatais', SUM(qtde_vitimas_fatais) FROM roe_basico_ocorrencias
  UNION ALL
  SELECT 'Ilesas', SUM(qtde_vitimas_ilesas) FROM roe_basico_ocorrencias
  UNION ALL
  SELECT 'Desaparecidas', SUM(qtde_vitimas_desaparecidas) FROM roe_basico_ocorrencias
  WHERE roe_basico_ocorrencias.status_relatorio = 'Finalizado'
  ```
  O `WHERE` está posicionado depois do último `FROM`, então em SQL padrão ele só se aplica à
  **última** parte do `UNION ALL` ("Desaparecidas"). "Feridas", "Fatais" e "Ilesas" somam sobre
  a tabela inteira, sem filtrar por `status_relatorio` — só "Desaparecidas" respeita o filtro.
  Bug real da query original, não corrigido aqui (os valores embutidos no dashboard — Feridas
  64%/Ilesas 31%/Fatais 4%/Desaparecidas 0%, total 17.725 — refletem exatamente esse
  comportamento). Documentado para quando o Valério for plugar o banco real: a query correta
  precisa repetir o `WHERE status_relatorio = 'Finalizado'` nas 4 partes do `UNION ALL`.
- **APH → "Vítimas entregues com vida": diferença de total explicada.** A query não tem o
  filtro `protocolo IS NOT NULL` que "Finalizadas" tem — isso explica de forma concreta (não
  só "base viva") por que o total desse donut (17.233) fica 2 acima de "Finalizadas" (17.231).
  têm contagem exatamente igual a 20 cada, com nomes majoritariamente do tipo "X (ver Y)" —
  parece lista de referência/sinônimos químicos (nomenclatura de produtos perigosos), não
  ocorrências reais atendidas. A soma total bate com o donut original (13.593), então o SQL
  está correto — a suspeita é na qualidade do dado da tabela `roe_prod_perigosos_ocorrencias`.
  **Não confirmado ainda.** Dashboard atual usa só a visão agregada seguraura (Gás Liquefeito
  de Petróleo vs. Outros), que é o que o próprio Metabase mostrava.
- **Produtos Perigosos → "Evolução histórica"**: 5.253 de 13.658 registros (~38%) não têm
  `data_recebimento` correspondente após o LEFT JOIN com `roe_basico_ocorrencias`. Mostrado
  como nota separada no dashboard, não plotado na linha do tempo — sem decisão final sobre
  como exibir.
- **Pequenas diferenças entre snapshots** (ex.: 5°GB 2.246 → 2.247 em prints tirados em
  momentos diferentes; total de "OMEs/Diretorias" na aba Geolocalização com 6 unidades a mais
  que "Finalizadas"; Produtos Perigosos com um print de 16/09 trazendo números bem maiores que
  o validado) — atribuídas a base viva (dado mudando entre capturas), não a erro de leitura.
  Critério confirmado várias vezes ao longo da validação; valores embutidos no dashboard
  seguem fixos no snapshot originalmente validado, por decisão do usuário.

---

## 4. Pendências claras

| Pendência | O que falta | De quem depende |
|---|---|---|
| Produtos Perigosos — "Total por produto" | Confirmar se os 656 produtos com contagem 20 são erro de dado na tabela `roe_prod_perigosos_ocorrencias` | Igor (verificar com quem administra a base) |
| Produtos Perigosos — "Evolução histórica" | Rodar query de diagnóstico (ver seção 2) para separar registro órfão de data nula; depois decidir como exibir | **Valério** (Igor decidiu não rodar diagnóstico sem confirmar estrutura real do banco) |
| Visão Geral — "Natureza" | Mandar CSV/tabela com o resultado da query (valores absolutos por natureza) se quiser trocar o donut de % para valor absoluto | Igor, se desejar |
| APH — "Situação das vítimas" (bug de WHERE) | Reportar/corrigir a query original no Metabase (repetir o WHERE nas 4 partes do UNION ALL) — não bloqueia a integração, mas afeta a precisão do dado real | Igor/quem mantém o Metabase |
| DF "Suprimento Individual"/"Despesas Diversas" (outro dashboard, referência cruzada) | Igor só tem acesso read-only no Metabase — não é possível extrair SQL | Valério, na hora da integração |
| Todos os quadrantes | Conectar `reloadDashboardData(tabId, filtros)` à API/consulta real | Valério |
| Mecanismo de conexão com o banco real (API/endpoint, outro método) | Ainda não definido | Igor/Valério, decisão futura |

---

## Notas de ambiente

O ambiente de trabalho (sandbox) usado para gerar o HTML reseta a cada nova sessão — arquivos
em `/home/claude` não persistem entre sessões diferentes. Este arquivo e o dashboard ficam
salvos como entregáveis reais (fora do sandbox), e os fatos duráveis relevantes (paleta
confirmada, decisões, pendências) estão salvos na memória do projeto, não só neste arquivo.
