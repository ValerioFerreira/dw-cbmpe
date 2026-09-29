import efetivoListaEmbutida from "@/data/real/efetivo_lista.json";

// Relação nominal do efetivo usada pelas telas (tabela, ficha, painéis).
//
// Começa com o JSON embutido no bundle e, quando o backend alcança o DW
// (GET /dados/efetivo, app no CapRover com login SGU), tem o conteúdo
// SUBSTITUÍDO pelo do DW em src/lib/cbmpe.js (carregarOrganograma), antes de
// as telas renderizarem. As telas importam ESTE objeto — nunca o JSON direto —
// para a troca valer em todas ao mesmo tempo.
//
// O que vem do DW já vem recortado pelo perfil do usuário no servidor: quem
// só pode ver a própria unidade recebe só ela.
const efetivoLista = {
  fonte: efetivoListaEmbutida.fonte,
  gerado_em: efetivoListaEmbutida.gerado_em,
  por_unidade: efetivoListaEmbutida.por_unidade,
  doDw: false,
};

export function aplicarEfetivoListaDw(remoto) {
  if (!remoto?.por_unidade) return false;
  efetivoLista.fonte = remoto.fonte;
  efetivoLista.gerado_em = remoto.data_referencia || null;
  efetivoLista.por_unidade = remoto.por_unidade;
  efetivoLista.doDw = true;
  return true;
}

export default efetivoLista;
