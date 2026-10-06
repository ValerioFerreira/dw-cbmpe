// Frota por viatura usada pelas telas (tabela de Viaturas, ficha, dashboard).
//
// Vem só do DW, pelo backend (GET /dados/viaturas, app no CapRover com login
// SGU), já recortada pelo perfil do usuário no servidor — quem só vê a própria
// unidade recebe só a frota dela. É preenchida em src/lib/cbmpe.js
// (carregarOrganograma), antes de as telas renderizarem. Sem JSON embutido desde
// 2026-10-06 (viaturas_lista.json e viaturas_detalhe.json, que iam no pacote
// sem login, foram removidos): sem backend a lista fica vazia e as telas dizem
// isso.
//
// As telas importam ESTE objeto — nunca o dado direto — para a troca valer em
// todas ao mesmo tempo. `viaturas` é o array que o servidor devolve (uma entrada
// por veículo cadastrado, com `sigla` = unidade do organograma).
const viaturasLista = {
  viaturas: [],
  doDw: false,
};

export function aplicarViaturasDw(remoto) {
  if (!Array.isArray(remoto?.viaturas)) return false;
  viaturasLista.viaturas = remoto.viaturas;
  viaturasLista.doDw = true;
  return true;
}

export default viaturasLista;
