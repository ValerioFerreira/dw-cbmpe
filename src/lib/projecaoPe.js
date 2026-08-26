// Projeção do mapa de Pernambuco — converte lat/long em coordenada de tela
// dentro do MESMO viewBox usado por municipios_pe.json (o mapa que já está
// nos painéis de Distribuição Geográfica de Efetivo e de Viaturas).
//
// Até 2026-08-26 o municipios_pe.json só tinha os paths já projetados: a
// projeção não estava escrita em lugar nenhum, e por isso não dava pra
// colocar nenhum marcador geográfico sobre o mapa. Ela foi recuperada por
// comparação com o geojson de origem (etl/_geo/municipios_pe.geojson.json).
// A verificação é reexecutável: `python etl/_geo/projetar_municipios.py`.
//
// A malha de origem passou a ser a oficial do IBGE, qualidade máxima
// (etl/_geo/baixar_malha_ibge.py) — daí a bbox abaixo. Estes números têm que
// bater com os que aquele script imprime; mudou lá, muda aqui.
//
// É equirretangular simples (sem correção de cosseno da latitude), enquadrada
// na bbox do CONTINENTE.

export const BBOX_PE = {
  lonMin: -41.3583,
  lonMax: -34.8067,
  latMin: -9.4829,
  latMax: -7.273,
};

export const LARGURA_PE = 1000;
export const ESCALA_PE = LARGURA_PE / (BBOX_PE.lonMax - BBOX_PE.lonMin); // 152.6344709689236
export const ALTURA_PE = (BBOX_PE.latMax - BBOX_PE.latMin) * ESCALA_PE;  // 337.30691739422446

// ---------------------------------------------------------------------------
// Fernando de Noronha
// ---------------------------------------------------------------------------
// A ilha é município de Pernambuco e o GBI lança guarnição no SBFN todo dia,
// mas fica a ~350 km da costa: dentro da mesma bbox ela espremeria o
// continente a ponto de inutilizá-lo. Até 2026-08-26 a saída era deixá-la de
// fora — o que abria um buraco no mapa — ou desenhá-la numa caixa de canto
// separada, fora do SVG.
//
// Desde 2026-08-26 ela entra no mapa como em qualquer atlas: DESLOCADA para
// perto da costa nordeste e AMPLIADA, numa faixa de oceano aberta acima do
// continente (por isso o viewBox começa em minY negativo). A geometria é a
// real — o mesmo polígono do geojson.
//
// Na escala do continente a ilha teria 12,9 × 8,2 unidades, menor que o
// próprio balão que se quer pousar em cima dela; daí a ampliação. O preço é
// um mapa que mente sobre distância e tamanho, então quem desenha É OBRIGADO
// a rotular: use NORONHA_CAIXA, que devolve a moldura e o rótulo "fora de
// escala".
//
// Os mesmos números estão em etl/_geo/projetar_municipios.py, que gera os
// paths. Mudou aqui, muda lá — e o script confere.

// 36 da ilha + folga para o rótulo, que fica ACIMA dela: abaixo bateria na
// ponta norte do continente, que começa em y = 0 nesse mesmo x.
export const MARGEM_OCEANO = 50;
export const MIN_Y_PE = -MARGEM_OCEANO;
export const ALTURA_TOTAL_PE = ALTURA_PE + MARGEM_OCEANO; // 387.30691739422446

// A malha do IBGE traz cinco corpos de terra em Noronha; o mapa desenha só a
// ilha principal, que é onde ficam o aeródromo, a vila e os três postos do
// GBI. As quatro ilhotas triplicariam a altura da moldura para render quatro
// pontinhos, e forçariam a reduzir a ampliação da ilha que interessa.
export const NORONHA_AMPLIACAO = 3.6;
export const NORONHA_DESTINO_X = 935;
export const NORONHA_DESTINO_Y = -36;

/** bbox real da ilha principal no geojson de origem. */
export const BBOX_NORONHA = {
  lonMin: -32.4755,
  lonMax: -32.3913,
  latMin: -3.88,
  latMax: -3.8262,
};

const ESCALA_NORONHA = ESCALA_PE * NORONHA_AMPLIACAO;

/** Moldura tracejada + rótulo que tornam o deslocamento honesto na tela. */
export const NORONHA_CAIXA = {
  x: NORONHA_DESTINO_X,
  y: NORONHA_DESTINO_Y,
  largura: (BBOX_NORONHA.lonMax - BBOX_NORONHA.lonMin) * ESCALA_NORONHA, // 46.27
  altura: (BBOX_NORONHA.latMax - BBOX_NORONHA.latMin) * ESCALA_NORONHA,  // 29.56
  rotulo: `Fernando de Noronha — ${NORONHA_AMPLIACAO}×, fora de posição`,
};

// Região de captura, mais folgada que a bbox do arquipélago: as coordenadas
// dos postos de serviço vêm do cadastro (aeródromo, vila), não do desenho.
// Qualquer ponto nessa janela é Noronha — não existe mais nada de PE por perto.
const CAPTURA_NORONHA = { lonMin: -32.9, lonMax: -32.0, latMin: -4.3, latMax: -3.4 };

/** true quando o ponto é do arquipélago (e portanto vai para a ilha deslocada). */
export function emNoronha(latitude, longitude) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  return (
    Number.isFinite(lat) && Number.isFinite(lon)
    && lon >= CAPTURA_NORONHA.lonMin && lon <= CAPTURA_NORONHA.lonMax
    && lat >= CAPTURA_NORONHA.latMin && lat <= CAPTURA_NORONHA.latMax
  );
}

/**
 * lat/long → {x, y} na projeção CONTINENTAL pura. É a projeção que gerou os
 * paths continentais e a que a verificação do script reproduz — não aplica o
 * deslocamento de Noronha. Para desenhar, use projetarNoMapa.
 */
export function projetar(latitude, longitude) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return {
    x: (lon - BBOX_PE.lonMin) * ESCALA_PE,
    y: (BBOX_PE.latMax - lat) * ESCALA_PE,
  };
}

/**
 * lat/long → {x, y, noronha} onde o ponto deve ser DESENHADO: continente na
 * projeção normal, arquipélago na ilha deslocada e ampliada. É o que os
 * componentes de mapa usam.
 */
export function projetarNoMapa(latitude, longitude) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (emNoronha(lat, lon)) {
    return {
      x: NORONHA_DESTINO_X + (lon - BBOX_NORONHA.lonMin) * ESCALA_NORONHA,
      y: NORONHA_DESTINO_Y + (BBOX_NORONHA.latMax - lat) * ESCALA_NORONHA,
      noronha: true,
    };
  }
  return { ...projetar(lat, lon), noronha: false };
}

/** true quando o ponto cai dentro da área desenhada — continente ou ilha. */
export function dentroDoMapa(latitude, longitude) {
  const p = projetarNoMapa(latitude, longitude);
  return !!p && p.x >= 0 && p.x <= LARGURA_PE && p.y >= MIN_Y_PE && p.y <= ALTURA_PE;
}

// Coordenada de referência do arquipélago, para quem precisar de um ponto
// só (o posto de serviço real é o SBFN, no aeródromo).
export const NORONHA = { latitude: -3.8547, longitude: -32.4297, nome: "Fernando de Noronha" };
