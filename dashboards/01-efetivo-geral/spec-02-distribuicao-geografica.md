# Painel: Dashboard Pessoal — aba "Distribuição Geográfica"

Status: **prototipado e validado**
Vive no mesmo `index.html` do painel 01 (agora um protótipo único com abas reais — ver nota abaixo).

## Nota sobre a estrutura do protótipo

A partir desta aba, decidimos consolidar tudo num único arquivo HTML com navegação por abas de verdade
(clique alterna o conteúdo), em vez de um arquivo por aba. Fica mais fiel à experiência real do Metabase
(um dashboard, várias abas) e evita duplicar o carregamento dos ~2.658 registros a cada aba nova. A pasta
`01-efetivo-geral/` passa a hospedar o protótipo completo do "Dashboard Pessoal".

## Público

DGP e gestores de efetivo — mesmo público do painel 01.

## Objetivo

Mostrar onde a corporação está territorialmente concentrada (por cidade-sede da OME) e como Oficiais e
Praças se distribuem entre as unidades.

## Pergunta principal

Onde o efetivo está lotado geograficamente, e qual a composição Oficiais x Praças por OME?

## Fontes de dados

1. **`peculio_metabase_v1`** — mesma base do painel 01 (posto, ome, matrícula).
2. **De-para OME → cidade** — fornecido por Igor via SQL do Metabase (`CASE ome WHEN... THEN 'cidade'`).
   Cobre as 47 unidades presentes na base. **Este de-para não existe em nenhum artefato do repositório do
   DW** (nem `mapeamento_unidades.json`, nem a documentação) — hoje só existe no SQL do Igor. Hardcoded no
   protótipo por enquanto.
3. **Geometria dos municípios** — `geojs26mun.json`, enviado por Igor (185 municípios de PE, padrão IBGE).
   Fernando de Noronha foi excluído do desenho do mapa (nenhuma OME está lá e a ilha distorcia a escala do
   mapa continental). Coordenadas convertidas para paths SVG estáticos em pré-processamento — sem custo de
   projeção no navegador.

## Dimensão derivada: `tempoObmAnos`

A coluna "Tempo na OBM atual" da planilha vem como texto (`"9anos6meses16dias"`). Fizemos o parse via regex
e uma aproximação (`anos×365 + meses×30 + dias`, dividido por 365) para chegar num número de anos — **não é
o cálculo exato** que o Windmill usa para popular `tempo_obm_atual` (dias) no `peculio_metabase_v1`. Para o
filtro (granularidade em anos) o risco é baixo, mas não deve virar fonte de verdade para nada que exija
precisão de dias. 108 de 2.658 registros (4,1%) têm erro `#NUM!` na fonte (provavelmente "Data da
Movimentação em SP" em branco) e ficam sem esse dado.

## KPIs / Visualizações

| Visualização | O que mostra | Validação |
|---|---|---|
| Mapa coroplético (Distribuição Geográfica - Lotação) | Militares por cidade-sede da OME, escala sequencial (cor única, do cinza ao vermelho da marca, em raiz quadrada para não esconder cidades menores atrás de Recife) | Contagens batem exatamente com os 5 grupos da legenda do print original (32-97 / 121-152 / 189-225 / 343 / 881+) |
| Barras agrupadas (Distribuição de Oficiais e Praças por OME) | Praças x Oficiais por unidade, ordenado por total decrescente | Conferido 1:1 com o print para GBI (279/17), ADIDO (128/59), 3ºGB (135/11), 1ºGB (116/10) |

## Filtros

- **Posto/Graduação** (multi-seleção) — filtro próprio desta aba, independente do filtro de Patente da aba
  Efetivo Geral (cada aba do Metabase original tem seus próprios widgets de filtro).
- **Anos na OME atual** (intervalo numérico, min/máx) — usa `tempoObmAnos`.

## Interações

- Hover em qualquer município mostra tooltip com nome + quantidade de militares lotados ali (ou "sem OME
  do CBMPE" para os demais).
- Painel lateral do mapa lista o ranking dos 8 municípios com mais militares, atualizado ao vivo com os
  filtros.
- Hover nas barras mostra OME + categoria + valor.

## Lacunas / pendências para o Valério

1. **De-para OME→cidade não está no DW.** Precisa ser formalizado (tabela ou arquivo versionado) se for
   virar produção — hoje só existe no SQL avulso do Igor.
2. **`tempoObmAnos` é aproximado**, não o cálculo exato de dias do pipeline real. Se o campo for exposto
   oficialmente, usar o valor de produção (`tempo_obm_atual`), não a aproximação do protótipo.
3. **Geometria dos municípios sem repositório de origem.** É um arquivo estático (não muda), mas precisa
   ser versionado em algum lugar quando isso for para produção.

## Recomendação

Alto valor gerencial — responde "onde estamos fisicamente" e complementa a visão de "quanto temos" do
painel 01. Os dados já suportam 100% da aba sem depender de nada novo do Valério, exceto formalizar o
de-para geográfico se isso virar produção.
