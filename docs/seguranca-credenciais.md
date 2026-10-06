# Auditoria de credenciais — 2026-10-06

Levantamento feito só com consultas de leitura (catálogo dos bancos, API de leitura do
Windmill e `git`). **Nenhuma senha, chave ou URL aparece neste documento.** Nada foi
alterado nas origens, no Windmill nem nas credenciais.

## 1. O que está aberto, em ordem de gravidade

### 1.1 Credenciais de SUPERUSUÁRIO nas bases de produção de origem (alta)
O ETL e o backend leem as origens com um usuário que é **superusuário do Postgres**:

| Origem | Papel usado | Superusuário | Pode escrever/apagar |
|---|---|---|---|
| SGP (`db_portal_sistemas_prod`) — também usado pelo **backend do app** | `ctic` | sim | 365 tabelas |
| Vacinação / Mapa de Força (`10.193.0.20`) | `ctic` | sim | todas |
| Frota (`frotas_production`) | `frotas` | sim | 34 tabelas |
| ROE (`roe_api_production`) | `roe_api` | sim | 136 tabelas |

O DW já está certo: `etl_writer` (não é superusuário, não cria banco/papel), `app_backend`
(escreve só no schema `app`, 3 tabelas) e `metabase_bi` (somente leitura). O backend do
app conecta ao DW como `app_backend`.

**O que fazer:** o DBA de cada sistema cria um papel de leitura restrito e troca a
credencial. O SQL pronto, tabela a tabela e coluna a coluna (sem CPF e demais colunas que o
DW nega), está em [`docs/seguranca-origens-grants.sql`](seguranca-origens-grants.sql),
gerado por `etl/dw/gerar_grants_leitura.py`. Para o backend há um papel ainda mais
estreito: só `ovrsgp.tb_pess (nr_matr_pess, nm_pess, nr_cpf_pess)`. Depois da troca,
atualizar `DATABASE_URL_*` (`.env.local`, App Configs do CapRover e a variável secreta
`f/dw/…` do Windmill, se houver) e **rodar o flow**; se a carga continuar verde, o papel
antigo pode ser rebaixado/rotacionado. Os bancos Neon (efetivo, viaturas, finanças,
reserva) usam o dono do banco, mas são bases próprias do projeto.

### 1.2 Segredos colados em scripts e variáveis do Windmill (alta)
Detectados por padrão (valores não foram lidos nem copiados):

* `u/valerioeducfin/DGP-ReqComp` e `u/valerioeducfin/materialoperacional` — **chave
  privada** de service account Google no código (a do Material Operacional ainda tem
  agenda diária ativa, `MatOp`, mesmo com o painel descontinuado).
* `peculio_metabase_v1`, `smiling_script`, `robust_script`, `redeeming_script`,
  `resolute_script`, `warmhearted_script`, `cleared_script` — **senha de banco literal**
  no código (ex.: `password="…"`).
* **`u/valerioeducfin/VIABILIDADE_CONFIG`** — variável **não secreta** (visível a qualquer
  usuário do workspace) que contém `google_private_key`, `ssh_pass` e `db_pass`.

**O que fazer (é do dono dos scripts; não foi alterado porque os scripts rodam toda hora e
alimentam o Metabase):**
1. Rotacionar essas chaves/senhas (colar em outro lugar não resolve o que já vazou).
2. Marcar `VIABILIDADE_CONFIG` como **secreta** (Variables → editar → “Secret”).
3. Trocar o literal por `wmill.get_variable("u/…/NOME")` com variável secreta.
4. Desativar o schedule `MatOp` (Material Operacional descontinuado) e o
   `large_capacity_script` já desativado pode ser apagado.

### 1.3 Credenciais que já passaram pelo chat (média)
As listadas em `DW_PLANEJAMENTO.md` (DW, Neon e demais). Rotacionar junto com 1.1.

### 1.4 Login local AGGD no pacote da Vercel (baixa, já controlada)
`src/lib/authClient.js` guarda a senha do login local em texto claro. Existe **só no build
da Vercel**; o build interno (`VITE_APP_INTERNO=1`) não o inclui. Sai de vez com a
desativação da Vercel.

## 2. O que está bem
* Repositório e histórico do git **sem segredos**: nenhum `.env`, chave privada, URL com
  senha ou token foi encontrado (só os `.env.example`, com placeholders).
* Papéis do DW separados e sem superusuário no ETL, no app e no BI.
* Dado pessoal (CPF, nome de cidadão etc.) é negado na cópia para o DW (`NEGADAS`).
* Todas as rotas nominais do backend exigem login e recortam pelo perfil no servidor.

## 3. Pendências que são só do dono
* `DROP DATABASE dw_dim_aposentado_20260929` (aposentado em 29/09; o Claude não apaga dado).
* `dw_diesp`: **mantido** — é o job diário do SGAT (snapshot da tramitação dos projetos).
  Vira `raw_sgat` no `dw` quando Atividades Específicas/DIESP entrar; até lá não mexer.
