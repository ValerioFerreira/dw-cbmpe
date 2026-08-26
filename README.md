# CBMPE BI — Painel do Comandante

Painel de Business Intelligence do Corpo de Bombeiros Militar de Pernambuco:
organograma interativo, indicadores por unidade, dashboards de Efetivo,
Viaturas, Finanças e o Mapa de Força.

Aplicação **React + Vite, estática** — sem backend próprio. Os números vêm de
arquivos JSON gerados por scripts Python (`etl/`) que leem o data warehouse
interno e as demais fontes da corporação.

---

## Retomar o trabalho em outra máquina

Esta seção é o roteiro completo. Seguindo-a, a máquina nova fica idêntica à de
origem — inclusive para reexecutar as extrações.

### 1. Pré-requisitos

| Ferramenta | Versão usada | Para quê |
|---|---|---|
| Node.js | 24.x (funciona de 20 em diante) | app e build |
| npm | 11.x | idem |
| Python | 3.14 (3.11+ serve) | scripts de `etl/` |
| Git | qualquer | — |
| VPN da corporação | — | **obrigatória** para qualquer script de `etl/` |

Bibliotecas Python usadas pelos scripts (cada arquivo declara as suas no topo,
em `# requirements:`): `psycopg2-binary`, `pandas`, `openpyxl`, `Pillow`.
Só isso — o resto é biblioteca padrão.

```bash
git clone <url-do-repo> dw-cbmpe
cd dw-cbmpe
npm install
pip install psycopg2-binary pandas openpyxl Pillow
npm run dev
```

O app sobe sem nenhuma variável de ambiente e sem VPN: todos os dados que ele
lê já estão commitados (`src/data/real/` e `public/dados/`). VPN e `.env.local`
só são necessários para **regerar** esses dados.

### 2. `.env.local` — o que precisa existir

O arquivo é git-ignorado e **não vem no clone**. Copie de `.env.example` e
preencha. Os valores estão no cofre `cofre-sistemas.kdbx` (ver
`DW_GOVERNANCA.md`) — nunca em arquivo commitado, nunca em mensagem de chat.

| Variável | Quem usa | Sem ela |
|---|---|---|
| `VITE_ADMIN_USUARIO`, `VITE_ADMIN_SENHA` | login do app | cai no padrão `adm`/`adm` |
| `DATABASE_URL_DW` | `etl/dw/`, `etl/mapa_forca/` | não dá para regerar o Mapa de Força |
| `DATABASE_URL_SGP`, `DATABASE_URL_OPS`, `DATABASE_URL_FROTA` | camada `raw` do DW | não dá para recarregar o DW |
| `DATABASE_URL_EFETIVO`, `DATABASE_URL_VIATURAS`, `DATABASE_URL_FINANCAS`, `DATABASE_URL_RESERVA` | extratores dos Neon | não dá para regerar Efetivo/Viaturas/Finanças |

### 3. O que NÃO está no repositório

Três coisas ficam de fora de propósito. Nenhuma delas impede o app de rodar,
mas todas impedem **reexecutar** alguma coisa:

| O que | Por quê fica fora | O que trava sem ela |
|---|---|---|
| `.env.local` | credenciais | qualquer script de `etl/` |
| `CBMPE - Repositório de Insígnias*/` | 280 arquivos (.cdr, .pdf, brevês) enviados pela corporação; só os 39 PNG usados entram, já reduzidos, em `public/insignias/` | reexecutar `etl/_geo/copiar_insignias.py`. O app **não** trava: os PNG usados estão commitados |
| `08 - QOD - AGOSTO - 2026.xlsx` | nunca chegou ao repositório | reexecutar `etl/efetivo/extract_previsto_divisoes.py`. O JSON gerado está commitado |

### 4. Onde está o raciocínio

O histórico de decisões é a parte mais difícil de reconstruir e está todo
escrito. Leia nesta ordem:

| Documento | O que responde |
|---|---|
| [`AGENTS.md`](AGENTS.md) | regras de trabalho do projeto |
| [`DW_PLANEJAMENTO.md`](DW_PLANEJAMENTO.md) | **log de decisões por sessão, em ordem cronológica** — é o fio da meada |
| [`DW_ARQUITETURA.md`](DW_ARQUITETURA.md) | camadas do Postgres, Windmill, CapRover |
| [`DW_MODELO_DADOS.md`](DW_MODELO_DADOS.md) | dimensões, fatos, grão, regras de negócio |
| [`DW_CATALOGO_FONTES.md`](DW_CATALOGO_FONTES.md) | cada fonte: acesso, dono, frequência, sensibilidade |
| [`DW_ETL.md`](DW_ETL.md) | desenho do pipeline |
| [`DW_GOVERNANCA.md`](DW_GOVERNANCA.md) | LGPD, perfis de acesso, credenciais a rotacionar |
| [`DW_PROCESSO_INTEGRACAO.md`](DW_PROCESSO_INTEGRACAO.md) | como integrar uma fonte nova |
| [`docs/deploy-solicitacao-ti.md`](docs/deploy-solicitacao-ti.md) | documento para a Seção de TI |

Além disso, **cada script de `etl/` tem uma docstring longa** explicando por que
existe, que problema resolve e o que já foi tentado e descartado. Quando algo
parecer arbitrário, a resposta costuma estar lá.

---

## Comandos

```bash
npm run dev        # servidor de desenvolvimento
npm run build      # build de produção em ./dist
npm run preview    # serve o build de produção localmente
npm run lint       # eslint (precisa passar limpo antes de commitar)
npm run typecheck  # checagem de tipos via jsconfig.json
```

## Regerar os dados

Todos exigem VPN e `.env.local`. Cada script imprime um relatório do que fez e
o que não conseguiu casar — **leia a saída**, ela é a verificação.

```bash
# Data warehouse (raw -> stg -> core -> marts), na ordem
python etl/dw/criar_banco.py      # só na primeira vez (precisa de CREATE DATABASE)
python etl/dw/aplicar_ddl.py
python etl/dw/carga_raw.py
python etl/dw/carga_core.py
python etl/dw/validar.py          # a verificação de regra de negócio

# Mapa de Força — 90 dias, um arquivo por dia em public/dados/mapa-forca/
python etl/mapa_forca/extract_mapa_forca.py
python etl/mapa_forca/conferir_coordenadas.py    # varredura das coordenadas

# Efetivo, viaturas, finanças, lotação/função
python etl/efetivo/extract_efetivo.py
python etl/efetivo/extract_lotacao_funcao.py
python etl/viaturas/extract_viaturas.py
python etl/financas/extract_financas.py

# Geometria do mapa (só quando o IBGE revisar a malha)
python etl/_geo/baixar_malha_ibge.py --gravar
python etl/_geo/projetar_municipios.py --gravar

# Insígnias (precisa da pasta enviada pela corporação, fora do commit)
python etl/_geo/copiar_insignias.py --copiar
```

Outros extratores, menos frequentes: `extract_previsto.py`,
`extract_previsto_divisoes.py`, `extract_intencao_movimentacao.py`,
`extract_saida_previsao.py` (Efetivo); `reconciliar_viaturas.py` e
`coordenadas_postos.py` (Mapa de Força); `casar_coordenadas_ome.py` (SGP).

### Ordem quando tudo estiver vazio

`criar_banco` → `aplicar_ddl` → `carga_raw` → `carga_core` → `validar` →
extratores de domínio. O Mapa de Força depende do DW carregado; os demais leem
os Neon direto.

## Dados

| Onde | Como chega ao navegador | Contém |
|---|---|---|
| `src/data/real/*.json` | **importado** — vai dentro do pacote JS | efetivo, viaturas, finanças, lotação, geometria |
| `public/dados/mapa-forca/*.json` | **buscado em execução** (`fetch`) | 90 dias de escala, um arquivo por dia |
| `public/insignias/*.png` | arquivo estático | 39 brasões, reduzidos para 256px |
| `src/data/organograma.js` | código | hierarquia, siglas, cargos — a espinha dorsal |

> ⚠️ Os dois primeiros contêm **dado nominal** e hoje são servidos sem
> autenticação real. Ver `docs/deploy-solicitacao-ti.md`, seção 1, antes de
> publicar em qualquer endereço acessível de fora da rede interna.

## Autenticação

`src/lib/authClient.js` é um **stub local**: valida contra
`VITE_ADMIN_USUARIO`/`VITE_ADMIN_SENHA` (embutidas no pacote em texto claro) e
contra as siglas de nível de acesso de `src/lib/accessControl.js`. Não é
autenticação de verdade — é controle de acesso casual.

O caminho definitivo é o **SGU** da corporação, desenhado e medido (98,4% do
efetivo já tem conta), mas ainda não implementado: depende de uma camada de
servidor que não existe. Ver `DW_GOVERNANCA.md` e
`docs/deploy-solicitacao-ti.md`.

A tela de login já aceita CPF com máscara; o valor enviado ao autenticador vai
sem máscara, para o dia em que o SGU entrar.

## Deploy

| Destino | Estado |
|---|---|
| Vercel (hoje) | funcionando — projeto Vite padrão, `vercel.json` cuida do fallback de rotas |
| CapRover interno (`10.193.1.252`) | `Dockerfile`, `nginx.conf` e `captain-definition` prontos; **imagem nunca construída** |

Passo a passo, decisões pendentes do TI e a ressalva de segurança:
[`docs/deploy-solicitacao-ti.md`](docs/deploy-solicitacao-ti.md).
