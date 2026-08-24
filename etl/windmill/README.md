# Scripts do Windmill

Separação feita em 2026-08-24, a pedido do usuário. Até então os scripts do
Windmill misturavam dois propósitos no mesmo arquivo: alimentar aplicações de
apoio (Metabase, app na Vercel) e servir de fonte de dado analítico. Isso
travava as duas coisas — não dava para mudar o ETL do DW sem risco de quebrar
o Metabase de outra pessoa, nem para arrumar o que o app consome sem mexer no
que vira histórico.

Agora são duas pastas, com regra clara de quem pode mexer em quê.

## `apps/` — mantém funcionando o que já funciona

**Não mexer sem necessidade.** Cada um destes tem consumidor externo ao nosso
projeto. Eles continuam exatamente com o comportamento de hoje, inclusive os
`TRUNCATE`, que aqui são aceitáveis: estas tabelas são *cache de aplicação*,
não histórico.

| Script | Lê | Escreve | Quem consome |
|---|---|---|---|
| `peculio_para_metabase_e_neon.py` | Planilha do Pecúlio (Google Sheets) | `public.peculio_metabase_v1` (Postgres interno) **e** Neon `Militar` | Metabase (Igor) e app dw-cbmpe |
| `financas_planilha_para_postgres.py` | Planilha de Finanças (Google Sheets) | `public.fin_autorizacao`, `fin_carnaval_2026`, `fin_sfi_ordinario` | Metabase e o script abaixo |
| `financas_postgres_para_neon.py` | as 3 tabelas `fin_*` acima | Neon `FinancaLancamento` | app dw-cbmpe |
| `frota_para_neon.py` | Sistema de Frotas (Postgres interno) | Neon `Viatura` | app dw-cbmpe |

Os três que escrevem no Neon existem só porque o app é estático e não fala
com a rede interna. **Quando o app for para o servidor interno e passar a ler
de `dw.marts`, os três podem ser desligados.** O `peculio_para_metabase_e_neon`
sobrevive à virada, porque a parte do Metabase continua.

## `dw/` — o ETL do data warehouse

**Nunca escreve fora do banco `dw`.** Não passa pelo Neon: lê a fonte
original e pousa em `raw_*`, sem transformar nada. A transformação toda vive
em `etl/dw/carga_core.py`, do `stg` para frente.

| Script | Lê | Escreve |
|---|---|---|
| `raw_planilhas.py` | Planilhas do Pecúlio e de Finanças (Google Sheets) | `dw.raw_peculio.planilha`, `dw.raw_financas.*` |
| `../../dw/carga_raw.py` | SGP, escala, mapa de força, Frota | `dw.raw_sgp`, `raw_escala`, `raw_mapa_forca`, `raw_frota` |
| `../../dw/carga_core.py` | `dw.raw_*` | `dw.stg`, `dw.core` |

### Por que o DW não lê o Neon

Três motivos, na ordem em que doem:

1. **O Neon já vem transformado.** O `peculio_para_metabase_e_neon.py` infere
   data de praça pela moda do prefixo da matrícula, normaliza booleano e
   descarta militar sem campo obrigatório. Tudo isso é regra de negócio
   legítima, mas numa camada `raw` ela é ruído: se a regra mudar, não dá para
   reprocessar o passado, porque o dado original nunca foi guardado.
2. **O Neon perde linha.** O script ignora militar sem data de praça, sem
   data de nascimento, sem posto, sem nome ou sem sexo. Para o app tudo bem;
   para o DW é buraco silencioso.
3. **É um salto pela nuvem** para trazer de volta dado que nasceu na rede
   interna.

### Duplicidade proposital

`raw_planilhas.py` baixa as mesmas planilhas que os scripts de `apps/`. Isso é
de propósito: as duas pastas ficam independentes, e mexer no ETL do DW nunca
pode quebrar o Metabase. O custo é baixar a planilha duas vezes por dia.

## Agendamento sugerido

| Job | Frequência |
|---|---|
| `apps/*` | como está hoje |
| `dw/raw_planilhas.py` + `dw/carga_raw.py` | diário, de madrugada |
| `dw/carga_core.py` | logo depois da carga raw |
| `dw/validar.py` | depois do core — falha alto se alguma regra de negócio quebrar |

O `carga_core.py` reconstrói tudo do zero a cada execução, então não há estado
a preservar entre rodadas. A exceção é o `fato_efetivo_diario`, que é snapshot
por dia: rodando diariamente, ele acumula a série temporal que a fonte não
tem — mas hoje a limpeza apaga o histórico junto. **Pendência conhecida**: a
limpeza precisa preservar snapshots de dias anteriores antes de o agendamento
entrar no ar.
