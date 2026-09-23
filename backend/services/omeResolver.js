// Seam para resolver, a partir do CPF que acabou de autenticar no SGU, a
// matricula e a OME atual do militar - sem nunca materializar o CPF fora
// desta funcao (nem no JWT, nem na resposta HTTP, nem em log).
//
// NAO ESTA LIGADO A NENHUM BANCO AINDA. Devolve sempre matricula/ome nulos.
// authService.login() ja chama esta funcao no lugar certo do fluxo - so
// falta implementar o corpo dela quando os dois pontos abaixo estiverem
// confirmados.
//
// O pipeline foi DECIDIDO pelo usuario (DW_PLANEJAMENTO.md, entrada
// 2026-08-24, secao "Decisao sobre resolverOmePorCpf()"): preferir
// CPF -> SGP -> matricula -> OME em vez de ler o campo "military" que o
// proprio SGU devolve, porque cobre 99,9% dos casos. MAS o passo 2 abaixo
// mudou de fonte em 2026-09-23: consultei `core.*` (DATABASE_URL_DW) com a
// VPN ativa e o schema INTEIRO nao existe no banco (so os DDLs em
// etl/dw/ddl/ - nunca rodados contra producao). Existe ate um schema
// `dw_cbmpe` com dim_militar/fato_movimentacao parecidos, mas TAMBEM
// vazio (0 linhas em tudo, testado com information_schema). A unica fonte
// hoje com OME atual populada de verdade e a mesma que ja alimenta
// src/data/real/efetivo_lista.json (pipeline etl/efetivo/extract_efetivo.py,
// sobre DATABASE_URL_EFETIVO/Peculio) - mesmo cruzamento por matricula ja
// usado com sucesso no extrator de Vacinacao. Ate o schema `core` ser
// carregado de verdade (ou a decisao mudar), o passo 2 correto e:
//
//   1. DATABASE_URL_SGP, schema ovrsgp: `select nr_matr_pess from tb_pess
//      where nr_cpf_pess = $1` -> matricula (formato do SGP, precisa
//      normalizar pro formato sem hifen usado em efetivo_lista.json).
//   2. Cruzar a matricula normalizada contra src/data/real/efetivo_lista.json
//      (por_unidade[sigla][].matricula) para achar a OME atual - NAO contra
//      core.fato_efetivo_diario (nao existe ainda). Esse JSON e gerado do
//      lado do frontend/ETL, entao este backend provavelmente precisa ler o
//      mesmo arquivo (ou seu extrator de origem) em vez de reimplementar a
//      consulta - avaliar ao implementar.
//
// Isso ainda e implementacao, nao produto: o SGU nao faz autorizacao (ver
// mesma entrada de 2026-08-24) - resolver a OME so diz DE ONDE o militar e,
// nao QUE PERFIL (Titular/Assessor/DGP/...) ele tem dentro do accessControl
// do app. Essa atribuicao continua manual, via /adm, feita pelo
// administrador depois que a matricula existir. Ver a pergunta em aberto
// registrada em DW_PLANEJAMENTO.md (entrada 2026-09-23) para as opcoes que
// faltam decidir antes de ligar isto de verdade.
export async function resolverMatriculaEOmePorCpf(_cpf) {
  return { matricula: null, ome: null };
}

export default { resolverMatriculaEOmePorCpf };
