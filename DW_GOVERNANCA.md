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

`src/lib/authClient.js` hoje é um stub local (`localStorage`, sem validação
real de credenciais), com um único campo `role` (`admin`/`user`) sem
modelo de permissões granular. Para o DW real:

- O RBAC precisa diferenciar, no mínimo, quem pode ver dado PII de quem só
  vê agregado — mapeando para as roles/views definidas na seção anterior.
- Esta é uma dependência da fase de implementação da API (ver roadmap em
  `DW_PLANEJAMENTO.md`), não algo a resolver nesta etapa de planejamento
  puro.

## Exceção confirmada: tabela nominal de Efetivo/Viaturas no app (MVP, sem autenticação)

Decisão registrada em 2026-08-07 (ver `DW_PLANEJAMENTO.md`): ao contrário
do restante do app (que só expõe contagem agregada por unidade), a página
de Indicador de Efetivo e Viaturas mostra uma tabela por unidade — Posto/
Graduação + Matrícula + Nome de Guerra por militar; Placa + Modelo por
viatura — publicada no mesmo JSON estático, público e sem autenticação
usado pelo resto do app. Isso é dado identificável (Efetivo) indo para um
site público, e informação de frota por quartel que também é sensível do
ponto de vista de segurança operacional (não só LGPD) para um órgão de
segurança pública. Apresentei esse risco explicitamente ao usuário antes
de implementar; a decisão foi seguir mesmo assim, como MVP, ciente de que
`authClient.js` ainda é um stub sem autenticação real (ver seção acima).
Nome completo, data de nascimento, sexo, saúde, endereço/telefone (do
militar) e chassi/patrimônio (da viatura) continuam fora de qualquer JSON
gerado — só os campos explicitamente confirmados saem do Neon.
**Se/quando a autenticação real for implementada, revisar se essa tabela
deve passar a exigir login** — está registrado aqui como ponto em aberto,
não uma decisão permanente.

## LGPD — pontos a não esquecer nas próximas fases

- Base legal para tratamento dos dados de efetivo/RH (dado de servidor
  público em contexto institucional tem tratamento distinto de dado de
  cliente/usuário comum, mas ainda exige cuidado).
- Minimização: `marts` deve expor só o necessário para cada consumidor —
  não replicar PII em toda view "por via das dúvidas".
- Rastreabilidade: quem acessou dado PII e quando (auditoria) é um item a
  detalhar quando a API/autenticação real forem desenhadas.
