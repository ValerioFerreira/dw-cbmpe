# DW CBMPE — Governança e Segurança

> Ver [`DW_PLANEJAMENTO.md`](DW_PLANEJAMENTO.md) para o log de decisões.
> Este documento cobre classificação de dados, controle de acesso e os
> pontos de autenticação/autorização que ficam como dependência de fases
> futuras.

## Classificação de sensibilidade

Decisão registrada em 2026-08-07: os dados são **mistos** — alguns
relatórios precisam de dado identificável (PII: nome completo, CPF, dados
de saúde, endereço), outros só precisam de dado agregado (contagens,
indicadores por unidade, sem identificação individual).

| Classificação | Definição | Exemplo hipotético |
|---|---|---|
| PII | Identifica uma pessoa física | Nome, CPF, dados de saúde, endereço de um militar |
| Agregado | Não identifica indivíduos | Contagem de efetivo por unidade, % de execução orçamentária |
| Misto | Relatório combina os dois níveis | A definir caso a caso conforme o catálogo de fontes é preenchido |

A classificação exata por domínio/fonte é preenchida em
[`DW_CATALOGO_FONTES.md`](DW_CATALOGO_FONTES.md) conforme o levantamento
avança — este documento define o **critério**, o catálogo registra o
**dado real** classificado.

## Por que isso importa para o modelo de dados

Dado PII e dado agregado não devem estar misturados de forma que um
consumidor com permissão só para agregado consiga, por junção,
reconstruir o dado identificável. Isso vale principalmente para as views
dimensionais em `marts` (ver [`DW_MODELO_DADOS.md`](DW_MODELO_DADOS.md) e
[`DW_ARQUITETURA.md`](DW_ARQUITETURA.md)) — é ali que a maioria dos
consumidores (app, BI comum) realmente lê os dados. O `core` normalizado
em si já é mais restrito por natureza: só recebe os "principais dados"
de cada fonte (ver critério de inclusão em `DW_PLANEJAMENTO.md`), não o
dado sensível completo — que fica na fonte original.

## Estratégia de controle de acesso (proposta)

- **Roles/schemas no Postgres**: separar, dentro do schema `marts`, views
  que expõem PII das que expõem só agregado — com roles Postgres
  diferentes para cada conjunto.
- **App React (via API)**: acessa conforme o papel do usuário logado —
  depende do RBAC real da aplicação, ainda não implementado (ver abaixo).
- **Power BI/Metabase — acesso comum**: usuário Postgres somente-leitura,
  escopado só às views de `marts` que a ferramenta/usuário de BI
  realmente precisa — evitar dar acesso amplo por padrão.
- **Power BI/Metabase — acesso granular** (ver
  [`DW_ARQUITETURA.md`](DW_ARQUITETURA.md#acesso-granular-às-fontes-originais)):
  conexões adicionais, diretas às fontes originais (bancos de sistemas
  internos como o SGP, e às camadas `raw`/`staging` para fontes
  externas coletadas) — fora do controle de role/schema do `core`/`marts`
  descrito acima, porque acessa a fonte diretamente.

Esta é uma proposta de estratégia, não uma implementação — o desenho fino
(quais roles exatas, quais views) só faz sentido depois que
`DW_MODELO_DADOS.md` e `DW_CATALOGO_FONTES.md` estiverem mais avançados.

## Acesso do Comandante Geral

Decisão registrada em 2026-08-07 (ver `DW_PLANEJAMENTO.md`): o Comandante
Geral tem acesso **irrestrito** a todos os dados da corporação —
incluindo dado sensível (saúde, dados bancários, dependentes do SGP) —
**sem** camada extra de log/auditoria. Isso é uma exceção explícita,
decidida pelo usuário por definição do cargo máximo da corporação, às
regras de separação PII/agregado que valem para os demais perfis nesta
seção. Tecnicamente, esse acesso passa pelas conexões diretas às fontes
originais descritas acima (via Power BI/Metabase), não pelo `core`/`marts`
regulares.

## Autenticação/autorização do app (dependência futura)

`src/lib/authClient.js` continua um stub local (`localStorage`, sem
backend real), mas deixou de aceitar "qualquer email/senha não vazios".
**Atualização de 2026-08-12**: por pedido do usuário, passou a exigir um
usuário administrador fixo (`adm`/`adm`, hardcoded no módulo) — login
social ("Continue with Google") e autocadastro foram desativados (eram
formas de contornar esse controle). Continua sem modelo de permissões
granular (só o campo `role`, sempre `"admin"` para esse usuário único) e
sem sessão de servidor — a "chave" de storage mudou de `cbmpe_auth_user`
para `cbmpe_auth_user_v2` justamente para isso: como não existe sessão
central pra invalidar, mudar a chave é a forma de forçar logout de
qualquer navegador que já tivesse uma sessão salva sob a chave antiga (na
próxima vez que carregar essa versão do app, deixa de ser reconhecido
como autenticado). Isso é uma medida de acesso mínima, não autenticação
real — uma senha fixa e pública no código-fonte não protege contra
alguém com acesso ao repositório; para uso real da corporação (fora de
teste/demonstração), a dependência de RBAC/backend abaixo continua de
pé. Para o DW real:

- O RBAC precisa diferenciar, no mínimo, quem pode ver dado PII de quem só
  vê agregado — mapeando para as roles/views definidas na seção anterior.
- Esta é uma dependência da fase de implementação da API (ver roadmap em
  `DW_PLANEJAMENTO.md`), não algo a resolver nesta etapa de planejamento
  puro.

**Atualização de 2026-08-17 — protótipo de níveis de acesso, ainda sem
RBAC real**: `src/lib/accessControl.js` define 5 usuários de demonstração
(`4GB`, `DINTER2`, `DGO`, `DGP`, `AGGD`), com senha = usuário em maiúsculo
+ `@GSG`, hardcoded no módulo de propósito — é protótipo de UI para
validar com stakeholders o *conceito* de acesso por unidade, não uma
implementação de segurança com a robustez de um backend real. Efeito
real: no organograma (`src/pages/Organograma.jsx`), cards fora do escopo
do usuário ficam visualmente esmaecidos e não navegam a partir dali.

**Atualização de 2026-08-17 (mesma sessão) — guarda de rota client-side**:
o usuário reportou que a restrição valia só visualmente — navegando direto
(URL, breadcrumb, ou qualquer link para uma unidade fora do escopo) ainda
dava pra ver os dados de qualquer unidade. Corrigido com
`src/lib/useAcessoUsuario.js`, aplicado no topo de todas as páginas que
resolvem dado por unidade (`Diretoria`, `Indicador`, `EfetivoDetalhe`,
`DashboardDetalhe`, `Submodulo`, `Detalhamento`): se o usuário de nível
não tem permissão pra unidade (ou, no caso da DGP, pro atalho de KPI
"Efetivo" do topo do organograma), a página renderiza "Acesso restrito"
em vez do conteúdo, qualquer que seja o caminho de navegação. **Ainda é
proteção client-side** — os JSONs estáticos (`efetivo.json`,
`efetivo_lista.json` etc.) continuam sendo baixados inteiros pelo
navegador (são arquivos públicos servidos pela Vercel); alguém inspecionando
o bundle/rede consegue ler o dado de qualquer unidade mesmo estando
"bloqueado" na UI. Pra virar controle de acesso real, precisaria de RBAC
no backend (API filtrando por permissão antes de responder) — a mesma
dependência já registrada acima, não resolvida por este protótipo.

**Atualização de 2026-08-19 — guarda de rota não bastava: o CONTEÚDO dos
Dashboards Pessoais não era filtrado por unidade**: o usuário reportou que,
acessando como nível "4GB" e abrindo os Dashboards Pessoais de Efetivo/
Viaturas (`/efetivo/:id/dashboard/:modulo`, `/viaturas/:id/dashboard/:modulo`
— criados em 2026-08-19), os números mostrados eram os da corporação
inteira, não só do 4º GB. Causa: `useAcessoUsuario`/`permiteIndicador`
(guarda de rota, ver acima) só decide **se a página abre**; uma vez aberta,
os módulos recebiam o dataset bruto do dashboard (`militares.json`,
`LINHAS_VIATURAS` etc.) sem filtrar por unidade — diferente das tabelas
reais (`EfetivoDetalhe.jsx`/`ViaturaDetalhe.jsx`), que já restringiam por
unidade+subordinadas desde a criação. Corrigido com `siglasPermitidas()`
(`src/lib/dashboardHelpers.js`), aplicado em `EfetivoDashboard.jsx` e
`ViaturasDashboard.jsx` antes de repassar dado pros módulos — vale pra
qualquer unidade sendo visualizada, não só nível restrito (um admin abrindo
o dashboard do 4º GB também só deve ver o 4º GB). Dois painéis (Movimentação
e Carreira → quadrantes "Saída"/"Previsão de saída"; Intenção de
Movimentação inteiro) usam fonte agregada só no nível da corporação, sem
quebra por unidade — ficam ocultos (com aviso) fora da visão do Comando
Geral, porque não há como restringi-los sem mudar a extração. Mesma
ressalva client-side do parágrafo acima continua valendo (dado ainda
trafega inteiro no bundle/rede).

## Exceção confirmada: tabela nominal de Efetivo/Viaturas no app (MVP, sem autenticação)

Decisão registrada em 2026-08-07 (ver `DW_PLANEJAMENTO.md`): ao contrário
do restante do app (que só expõe contagem agregada por unidade), a página
de Indicador de Efetivo e Viaturas mostra uma tabela — publicada no mesmo
JSON estático, público e sem autenticação usado pelo resto do app. Isso é
dado identificável (Efetivo) indo para um site público, e informação de
frota por quartel que também é sensível do ponto de vista de segurança
operacional (não só LGPD) para um órgão de segurança pública. Apresentei
esse risco explicitamente ao usuário antes de implementar; a decisão foi
seguir mesmo assim, como MVP, ciente de que `authClient.js` ainda é um
stub sem autenticação real (ver seção acima).

**Atualização de 2026-08-11 — escopo de campos ampliado, com decisão
consciente a cada etapa** (a nota original desta seção, que dizia "nome
completo, data de nascimento, sexo, saúde, endereço/telefone continuam de
fora", ficou desatualizada e é substituída por esta):

- Tabela principal de Efetivo: Posto/Graduação, Matrícula, **Nome
  completo** (com nome de guerra em destaque), Sexo, **Idade** (calculada
  a partir da data de nascimento — só a idade sai no JSON, nunca a data
  bruta) e OME. Antes dessa expansão, apresentei ao usuário o catálogo
  completo de campos disponíveis com a classificação de sensibilidade de
  cada um; a decisão de incluir nome completo/sexo/idade no conjunto
  "principal" (visível sem clique extra) foi explícita.
- Painel "Verificar dados completos" (atrás de um clique extra, não
  visível por padrão): 21 campos adicionais, **incluindo dado sensível
  LGPD** — raça/cor, PCD, readaptado, LE, LTIP, afastamento >90 dias,
  telefones. O usuário pediu explicitamente "todas as colunas possíveis,
  mesmo incluindo dados sensíveis" depois de ver esse catálogo — decisão
  informada, repetida duas vezes, não presumida por mim. Único campo
  deliberadamente recusado: `observacao` (texto livre, risco
  imprevisível). **Atualização de 2026-08-12**: a coleta foi concluída —
  o usuário rodou o `windmill-neon.py` e `extract_efetivo.py` foi
  reexecutado; o painel mostra os 21 campos reais (ver
  `DW_PLANEJAMENTO.md`).
- Viaturas: Placa + Modelo por unidade nesta rodada — **superado em
  2026-08-18/2026-08-19, ver extensão abaixo**.

**Se/quando a autenticação real for implementada, revisar se essa tabela —
principalmente o painel "dados completos" — deve passar a exigir login**
— está registrado aqui como ponto em aberto, não uma decisão permanente.

**Extensão de 2026-08-19**: o painel "Tempo na OME" do Dashboard Pessoal de
Efetivo (`/efetivo/:id/dashboard/tempoome`) ganhou uma tabela nominal
("Informações dos militares" — Matrícula, Posto/Graduação, Nome de Guerra,
OME, Tempo na OME atual). O usuário autorizou explicitamente ("pode mostrar
matrícula e nome de guerra, o app tem login"). Nota registrada: o "login"
atual é `src/lib/authClient.js`, um protótipo client-side em localStorage —
qualquer um com acesso ao dev tools pode setar uma sessão sem senha (feito
várias vezes nesta mesma sessão pra testar o protótipo de níveis de
acesso), então não é uma barreira de servidor real. Isso não muda o risco
líquido da decisão, porque a exceção acima (tabela de Efetivo) já expõe
nome completo + matrícula do efetivo inteiro sem gate nenhum desde
2026-08-07 — a tabela nova do painel 08 não introduz uma categoria de
exposição nova, só reduz pra Posto/OME/Tempo o que já está público em
outro lugar do app.

**Extensão de 2026-08-18/2026-08-19 — Viaturas, escopo de campos públicos
ampliado bem além de "Placa + Modelo"**: a ficha por viatura
(`/viatura/:placa`, 2026-08-18), a tabela real de Viaturas (`/viaturas/:id`,
ampliada em 2026-08-19) e o novo Dashboard Pessoal de Viaturas (5 módulos,
`/viaturas/:id/dashboard/:modulo`, 2026-08-19) publicam, sem autenticação
real, por veículo: placa, patrimônio, chassis, renavam, marca/modelo/ano,
combustível, posse (própria/alugada), destinação (operacional/
administrativa/equipamento), situação, rastreamento (se tem GPS),
quantidade de condutores vinculados, categoria de habilitação exigida,
odômetro e último abastecimento (data + valor). Nenhum desses campos é PII
de pessoa física — o risco aqui é de **segurança operacional** (capacidade
e prontidão real da frota por quartel, publicamente consultável), não LGPD.
Mesma decisão-base de 2026-08-07 (MVP sem autenticação, risco apresentado
e aceito) — não foi reapresentada campo a campo nesta rodada porque o
princípio (frota por quartel é sensível, exposta mesmo assim como MVP) já
estava confirmado; **revisar se cabe reforço quando a autenticação real for
implementada** (mesmo ponto em aberto já registrado acima para Efetivo).

## Ficha do militar (SGP) — Caminho A público × Caminho B interno (2026-08-19)

Ao clicar num militar na tabela de Efetivo abre-se `/militar/:matricula`
(`src/pages/MilitarFicha.jsx`). O SGP (`ovrsgp.tb_pess` + satélites) tem
dado sensível de categoria especial. Como a ficha, por ora, é servida pelo
build público sem login real, vale uma regra dura de allowlist/denylist:

**Allowlist — pode ir pro build público (Caminho A):** posto/graduação,
matrícula, nome, nome de guerra, sexo, idade (nunca a data de nascimento
bruta), OME, função; e blocos de carreira administrativa: data de ingresso,
última promoção, última movimentação, unidade anterior, órgão, tempo de
serviço, tempo na unidade, horário especial, readaptado, acúmulo de cargos,
LE, LTIP, afastamento > 90 dias, suplemento pessoal (nº/ano e data), PCNH.

**Denylist — NUNCA em arquivo versionado/público (só Caminho B, atrás de
autenticação real no servidor interno):** CPF, RG (militar e civil), título
de eleitor, PIS/PASEP, CNH, passaporte, carteira profissional, reservista;
endereço residencial (rua/nº/bairro/cidade/CEP/complemento/ponto de
referência); filiação (nomes do pai/mãe); **saúde** (doença crônica,
medicamento controlado, alergia, imunização, acidentes, tipo/fator
sanguíneo); **biometria** (foto, assinatura, digitais); características
físicas/medidas; **raça/cor**; **religião**; estado civil; naturalidade/
nacionalidade; telefones; dados bancários (`tb_pess_x_banco`); documentos
anexados (`tb_docm`); **dependentes** (`tb_depen`, incl. menores); e o
histórico nominal completo de promoção/movimentação/afastamento.

O gatilho do Caminho B fica pronto: a página já isola o que mostra, o
mapeamento das tabelas do SGP por bloco está em `DW_MODELO_DADOS.md`, e o
`windmill-sgp.py` (a escrever quando a conexão ao SGP for definida) deve
carregar o denylist só em schema/role restrito no Neon, nunca no JSON
público. Enquanto o Caminho B não existir, a ficha exibe explicitamente que
o restante é de acesso interno autenticado.

**Ressalva**: o painel "Verificar dados completos" (seção acima) já expõe
hoje `racaCor`/`pcd`/telefones no `efetivo_lista.json` público, o que
contradiz este denylist. Registrado como pendência em `DW_PLANEJAMENTO.md`
(remover num próximo passo).

## LGPD — pontos a não esquecer nas próximas fases

- Base legal para tratamento dos dados de efetivo/RH (dado de servidor
  público em contexto institucional tem tratamento distinto de dado de
  cliente/usuário comum, mas ainda exige cuidado).
- Minimização: `marts` deve expor só o necessário para cada consumidor —
  não replicar PII em toda view "por via das dúvidas".
- Rastreabilidade: quem acessou dado PII e quando (auditoria) é um item a
  detalhar quando a API/autenticação real forem desenhadas.

## Perfis de acesso (2026-08-24)

Modelo revisado: **perfil** (o que um papel vê), **atribuição** (qual perfil
cada usuário tem) e **unidade** (que vem da OME do usuário, não de escolha do
administrador) passam a ser três coisas separadas. Ver
`src/lib/accessControl.js` e a tela `/adm`.

| Perfil | Acesso |
|---|---|
| Administrador | Todas as funcionalidades e dados, mais a própria `/adm` |
| Comandante Geral | Ilimitado a todos os dados |
| Subcomandante Geral | Ilimitado a todos os dados |
| DGP | Sua unidade + **Efetivo de todas as unidades** |
| DLog | Sua unidade + **Viaturas e Materiais de todas** |
| DF | Sua unidade + **Finanças de todas** |
| Titular | Sua unidade e as subordinadas |
| Assessor | O mesmo do titular a quem está vinculado, enquanto o vínculo valer |

Comandante e Subcomandante são perfis distintos apesar do acesso idêntico:
separar dá trilha de auditoria, e é barato agora e caro depois.

### Indicador temático vale em qualquer unidade

Mudança de comportamento em relação ao modelo anterior: o indicador do perfil
(Efetivo para a DGP, Viaturas/Materiais para a DLog, Finanças para a DF) passa
a valer em **qualquer** unidade, não só no card principal do organograma. É o
que distingue um diretor temático de um titular.

### Assessor: o vínculo caduca sozinho

Fluxo definido pela corporação: o administrador dá o perfil de Titular a um
militar; esse titular pede um ou mais assessores e informa quem são; o
administrador cria cada um vinculado a ele.

O acesso do assessor vale **enquanto aquele titular continuar titular da OME
em que concedeu o acesso**. Por isso a OME concedida fica gravada na
atribuição do assessor: comparando com a OME atual do titular, a transferência
é detectada sozinha. Se o titular for transferido, perder o perfil ou for
removido, o assessor perde o acesso na hora — sem depender de alguém lembrar
de revogar. A tela `/adm` mostra o motivo da suspensão em vez de só apagar o
acesso.

### Autenticação: CPF

As credenciais internas do CBMPE são **CPF e senha**. O modelo já registra o
CPF de cada usuário, e é por ele que a OME será resolvida junto à base do
CBMPE quando a integração existir (`resolverOmePorCpf`, hoje um seam que
devolve `null`). Enquanto isso, a unidade pode ser preenchida à mão e a tela a
marca como provisória, em vez de fingir que sabe.

**Consequência para o DW**: a decisão de descartar o CPF na entrada continua
valendo para a cópia do mapa de força (`launch_militaries.military_cpf`), que
é redundante. Mas o CPF do SGP (`tb_pess.nr_cpf_pess`) passa a ter uso
concreto — a resolução usuário → OME — e a recomendação é que essa consulta
aconteça **no servidor, a cada login**, sem materializar CPF no DW nem em
nenhum JSON servido ao navegador.

### O limite continua o mesmo

Isto é protótipo de **visualização**. A verificação roda no navegador e o dado
que alimenta o app é servido junto com ele — quem abrir o DevTools lê tudo,
independente do perfil. Organiza a interface, não protege o dado. Autorização
real exige o backend, e é pré-requisito para o app sair da Vercel com dado
nominal. A própria tela `/adm` diz isso.

## Contato de militar fica em tabela separada (2026-08-24)

`core.contato_militar` existe como tabela própria, e não como duas colunas na
`dim_militar`, por um motivo operacional: um `SELECT *` na dimensão é a coisa
mais natural do mundo, e não pode ser o caminho pelo qual o telefone de 2.045
militares sai do DW. Separado, consultar contato vira decisão explícita — e
vira um alvo único de `GRANT` quando os papéis (`etl_writer`, `bi_reader`,
`app_reader`) forem criados.

`marts.militar` deliberadamente **não** traz telefone.

As abas de telefone da planilha trazem também **e-mail e endereço**. Não foram
carregados: nenhum consumidor pediu, e dado sensível sem uso concreto não
entra no DW. A mesma regra que manteve o CPF do mapa de força fora da `raw`.
