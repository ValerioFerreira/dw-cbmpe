// Projeção do mapa de Pernambuco — converte lat/long em coordenada de tela
// dentro do MESMO viewBox usado por municipios_pe.json (o mapa que já está
// nos painéis de Distribuição Geográfica de Efetivo e de Viaturas).
//
// Até 2026-08-26 o municipios_pe.json só tinha os paths já projetados: a
// projeção não estava escrita em lugar nenhum, e por isso não dava pra
// colocar nenhum marcador geográfico sobre o mapa. Ela foi recuperada por
// comparação com o geojson de origem (etl/_geo/municipios_pe.geojson.json) e
// confere até a segunda casa decimal nos 184 municípios — a verificação é
// reexecutável: `python etl/_geo/projetar_municipios.py`.
//
// É equirretangular simples (sem correção de cosseno da latitude), enquadrada
// na bbox do CONTINENTE. Fernando de Noronha fica deliberadamente fora: a
// ilha está a ~350 km da costa e, dentro da mesma bbox, espremeria o
// continente. Ver NORONHA abaixo — o GBI lança guarnição no SBFN todo dia,
// então quem for desenhar o mapa de força precisa de um encarte pra ilha.

export const BBOX_PE = {
  lonMin: -41.3579578012,
  lonMax: -34.8072398439,
  latMin: -9.4824782643,
  latMax: -7.2737543958,
};

export const LARGURA_PE = 1000;
export const ESCALA_PE = LARGURA_PE / (BBOX_PE.lonMax - BBOX_PE.lonMin); // 152.655022933115
export const ALTURA_PE = (BBOX_PE.latMax - BBOX_PE.latMin) * ESCALA_PE;  // 337.1727927987858

/** lat/long → {x, y} no viewBox de municipios_pe.json (0 0 1000 337.17). */
export function projetar(latitude, longitude) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return {
    x: (lon - BBOX_PE.lonMin) * ESCALA_PE,
    y: (BBOX_PE.latMax - lat) * ESCALA_PE,
  };
}

/** true quando o ponto cai dentro do retângulo desenhado (Noronha não cai). */
export function dentroDoMapa(latitude, longitude) {
  const p = projetar(latitude, longitude);
  return !!p && p.x >= 0 && p.x <= LARGURA_PE && p.y >= 0 && p.y <= ALTURA_PE;
}

// Fernando de Noronha, para quem precisar desenhar o encarte. As coordenadas
// são do arquipélago; o posto de serviço real é o SBFN (aeródromo).
export const NORONHA = { latitude: -3.8547, longitude: -32.4297, nome: "Fernando de Noronha" };
