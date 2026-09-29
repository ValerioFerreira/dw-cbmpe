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
| `raw_fdw.py` | SGP, escala, mapa de força, Frota — **o próprio DW lê a origem via `postgres_fdw`**; o script só chama `CALL stg.carregar_raw(fonte)` | `dw.raw_sgp`, `raw_escala`, `raw_mapa_forca`, `raw_frota` |
| `../../dw/carga_raw.py reserva` | Sistema de reserva remunerada (Neon — a única fonte em que o Neon é a origem) | `dw.raw_reserva` |
| `../../dw/carga_core.py` | `dw.raw_*` | `dw.stg`, `dw.core` |
| `../../dw/validar.py` | `dw.core`, `dw.marts` | — (sai com erro se uma regra de negócio quebrar) |

| `../../sgp/casar_coordenadas_ome.py --gravar-dw` | `dw.raw_ref.dw_dim_ome` + `dw.raw_sgp.tb_ome` | `dw.stg.coordenada_ome` (lido pelo `carga_core.py`) |

**Flow diário `f/dw/dw_diario`** (workspace `dgp`, agenda 05:30
America/Recife):
1. **Em paralelo**, cada ramo com `skip_failure` para uma fonte fora do ar não
   derrubar as outras: `raw_fdw.py`, `raw_planilhas.py` e
   `carga_raw.py` com `fontes=["reserva"]`.
2. `casar_coordenadas_ome.py` com `gravar_dw=true`.
3. `carga_core.py`.
4. `validar.py`. Falha o job se uma regra de negócio quebrar **ou** se a carga
   mais recente de alguma tabela nas últimas 24h não terminou `ok`. É aqui
   que a falha de um ramo do passo 1 aparece.

**Como publicar:** `python etl/windmill/publicar_dw.py` (ou `--rodar` para
também disparar uma vez). Ele cria a pasta `f/dw`, as variáveis **secretas**
`f/dw/database_url_dw` e `f/dw/database_url_reserva`, os seis scripts a partir
dos arquivos do repositório, o flow e a agenda. Lê tudo de variáveis de
ambiente (`WINDMILL_URL/EMAIL/PASSWORD`, `DATABASE_URL_DW`,
`DATABASE_URL_RESERVA`). **Não edite os scripts no Windmill**: edite aqui e
publique de novo.

As foreign tables do `raw_fdw.py` são criadas uma vez por
`etl/dw/configurar_fdw.py`, que precisa rodar com o **mesmo usuário de banco**
do flow, porque o user mapping é por usuário.

**Planilhas pausadas** (`"pausada"` em `raw_planilhas.py`): ficam fora da
rodada padrão, mas carregam se pedidas pelo nome. Hoje são **todas as do
Material Operacional**, em standby por decisão do usuário (2026-09-29).
`raw_materiais` guarda a carga desse dia (smo, vt, uso). CP (carga padrão
por tipo de viatura) e natureza (natureza de cada material) estão
despublicadas na origem (HTTP 410).

`publicar_dw.py` lê o `.env.local` da raiz sozinho: basta
`python etl/windmill/publicar_dw.py --rodar`.

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
