# DW CBMPE — Desenho do ETL

> Documento de desenho, sem código ainda — a implementação real é uma fase
> futura (ver roadmap em [`DW_PLANEJAMENTO.md`](DW_PLANEJAMENTO.md)).
> Stack decidida: **Python**, executado pelo **Windmill** (self-hosted, já
> conectado à rede interna da corporação — decisão de 2026-08-07, ver
> [`DW_ARQUITETURA.md`](DW_ARQUITETURA.md#execução-do-etl-windmill)). O
> Windmill substitui qualquer agendador/orquestrador que teríamos que
> montar do zero — nosso trabalho é identificar os dados (catálogo de
> fontes) e escrever os scripts que ele executa.

## Estratégia de camadas

O pipeline espelha as camadas do Postgres definidas em
[`DW_ARQUITETURA.md`](DW_ARQUITETURA.md):

1. **Extração → `raw`**: um job por fonte, grava o dado o mais próximo
   possível do formato original (sem transformar), com metadados de
   extração (quando, de onde). Facilita reprocessar se uma transformação
   mudar, sem precisar reconsultar a fonte.
2. **`raw` → `staging`**: limpeza, tipagem, deduplicação, padronização de
   nomes/códigos entre fontes diferentes do mesmo domínio.
3. **`staging` → `core`**: aplica as regras de negócio do esquema estrela
   (ver [`DW_MODELO_DADOS.md`](DW_MODELO_DADOS.md)) — resolve dimensões
   (incluindo SCD tipo 2 de `dim_unidade`), popula fatos.
4. **`core` → `marts`**: views/materialized views por domínio/consumidor.

## Estrutura de projeto proposta

Os scripts vivem neste mesmo repositório e são publicados no Windmill via
git sync (`wmill sync push`) — a estrutura exata de pastas segue o padrão
que o Windmill espera para sync (definido em `wmill.yaml`, a configurar
quando o workspace existir), mas a organização lógica por domínio se
mantém:

```
etl/                 # scripts Python, organizados por domínio, sincronizados com o Windmill
  common/             # helpers compartilhados: conexão Postgres, logging
  organograma/         # extract/transform/load do domínio
  efetivo/
  frota/
  financeiro/
  atividades/
  requirements.txt
wmill.yaml            # configuração de git sync do Windmill (a criar quando o workspace existir)
scripts/
  sync-windmill.ps1    # wrapper pra `wmill sync push` — publicação manual (ver Agendamento/Publicação)
```

Cada domínio é isolado (extract/transform/load próprios), para permitir
frequências de atualização diferentes por domínio sem acoplamento.

## Segredos e configuração

- Credenciais de banco e de fontes externas ficam nos **resources**/
  **variables** nativos do Windmill (decisão de 2026-08-07, ver
  `DW_PLANEJAMENTO.md`) — os scripts as consomem em tempo de execução via
  a API interna do Windmill, não por `.env` local. Isso vale tanto para a
  conexão com o Postgres de destino quanto para credenciais de fontes
  externas (sistemas, planilhas protegidas, etc.).
- Nenhum segredo é commitado neste repositório — nem em `.env`, nem em
  código.

## Carga incremental vs. full refresh

A definir por domínio, quando o catálogo de fontes
(`DW_CATALOGO_FONTES.md`) estiver preenchido — depende de cada fonte expor
(ou não) uma forma de identificar apenas o que mudou (ex. coluna de
atualização, changelog, ou só full export). Registrar a decisão por domínio
no catálogo de fontes quando confirmada.

## Agendamento

- Frequência varia por domínio (decisão registrada em
  `DW_PLANEJAMENTO.md`) — cada script/flow de domínio tem seu próprio
  agendamento.
- O agendamento usa o mecanismo **nativo do Windmill** por script/flow —
  não precisamos montar (nem manter) um agendador próprio como
  Task Scheduler/cron ou um orquestrador dedicado (Airflow, Dagster). Essa
  parte deixou de ser uma decisão nossa de arquitetura: é configuração
  dentro do Windmill, feita quando o workspace existir.

## Publicação dos scripts no Windmill

- Os scripts são escritos aqui no repositório e publicados no Windmill via
  **sincronização manual** com o CLI oficial (`wmill sync push`) — decisão
  de 2026-08-07, ver `DW_PLANEJAMENTO.md`. Não há CI automático: o
  Windmill só é alcançável de dentro da rede interna/VPN, e os runners
  padrão do GitHub Actions não chegam nele.
- Um script wrapper no repositório (`scripts/sync-windmill.ps1`, a criar
  na fase de implementação) reduz a publicação a um único comando, em vez
  de exigir lembrar dos parâmetros do `wmill` CLI toda vez.
- Pré-requisitos ainda pendentes (ver `DW_PLANEJAMENTO.md`): workspace do
  Windmill criado, `wmill.yaml` configurado no repositório, token de API
  gerado.

## Logging e tratamento de erro

- Log mínimo por execução de job: início/fim, linhas processadas,
  erros — o suficiente para diagnosticar uma falha sem instrumentação
  pesada.
- Falha em um job de um domínio não deve derrubar os demais (jobs
  independentes por domínio, conforme a estrutura de projeto acima).

## Dependências

- O que cada job de extração precisa saber sobre a fonte vem do catálogo
  de fontes ([`DW_CATALOGO_FONTES.md`](DW_CATALOGO_FONTES.md)) — este
  documento não deve ser implementado antes daquele estar preenchido para
  o domínio em questão.
- O schema de destino (`core`) depende do modelo de dados
  ([`DW_MODELO_DADOS.md`](DW_MODELO_DADOS.md)) estar fechado.
