import municipios from "@/data/real/efetivo_dashboard/municipios_pe.json";
import { projetarNoMapa, dentroDoMapa, ESCALA_PE } from "@/lib/projecaoPe";

// Coordenada coerente com Pernambuco (2026-10-29). O ROE grava a latitude/longitude
// do logradouro como o app do bombeiro entregou, e parte delas não serve para o mapa:
// GPS de outro estado (Juazeiro-BA atendido pelo GB de Petrolina), número truncado
// (-7, -38: cai na Paraíba) ou geocodificação no município errado (ocorrência de
// Custódia pousada a 50 km dela). Só a caixa retangular de PE (dentroDoMapa) deixava
// passar tudo isso: os pontos apareciam fora do contorno do estado.
//
// Regra, medida sobre as 36 mil ocorrências com coordenada em out/2026:
//  - o ponto tem de cair num município de PE, com folga de 1 km — sem ela somem os
//    salvamentos na praia e as ocorrências na margem do São Francisco (367 pontos
//    ficam a menos de 500 m do contorno);
//  - quando o município informado é de PE, o ponto tem de estar a até 10 km dele —
//    acima disso é erro de geocodificação (~700 pontos, metade a mais de 50 km).
// Os paths de municipios_pe.json já estão projetados (projecaoPe.js), então o teste é
// feito no mesmo plano do desenho, Fernando de Noronha incluído.

const FOLGA_PE_KM = 1;
const LIMITE_MUNICIPIO_KM = 10;
const UNIDADES_POR_KM = ESCALA_PE / 111.32;

// Grafia do ROE ≠ grafia do IBGE (a mesma reconciliação de status_ocorrencias.md, seção 2).
const APELIDOS = {
  "BELEM DO SAO FRANCISCO": "BELEM DE SAO FRANCISCO",
  "LAGOA DE ITAENGA": "LAGOA DO ITAENGA",
  IGUARACY: "IGUARACI",
};

export function chaveMunicipioMapa(nome) {
  const chave = String(nome || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toUpperCase();
  return APELIDOS[chave] || chave;
}

let indice = null;
function montarIndice() {
  if (indice) return indice;
  const lista = municipios.features.map((f) => {
    const aneis = f.d.split(/z/i).map((trecho) => {
      const n = trecho.match(/-?\d+(?:\.\d+)?/g) || [];
      const pts = [];
      for (let i = 0; i + 1 < n.length; i += 2) pts.push([Number(n[i]), Number(n[i + 1])]);
      return pts;
    }).filter((a) => a.length > 2);
    const xs = aneis.flat().map((p) => p[0]);
    const ys = aneis.flat().map((p) => p[1]);
    return {
      nome: f.name, aneis,
      minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys),
    };
  });
  indice = { lista, porChave: new Map(lista.map((m) => [chaveMunicipioMapa(m.nome), m])) };
  return indice;
}

/** Nome do município como está no mapa (IBGE), ou null quando não é de PE. */
export function municipioDoMapa(cidade) {
  return montarIndice().porChave.get(chaveMunicipioMapa(cidade))?.nome ?? null;
}

const naCaixa = (m, x, y, folga = 0) => x >= m.minX - folga && x <= m.maxX + folga && y >= m.minY - folga && y <= m.maxY + folga;

function dentro(m, x, y) {
  let c = false;
  m.aneis.forEach((a) => {
    for (let i = 0, j = a.length - 1; i < a.length; j = i++) {
      const [xi, yi] = a[i];
      const [xj, yj] = a[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
  });
  return c;
}

function distancia(m, x, y) {
  let menor = Infinity;
  m.aneis.forEach((a) => {
    for (let i = 0, j = a.length - 1; i < a.length; j = i++) {
      const [ax, ay] = a[j];
      const [bx, by] = a[i];
      const dx = bx - ax;
      const dy = by - ay;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
      menor = Math.min(menor, Math.hypot(x - ax - t * dx, y - ay - t * dy));
    }
  });
  return menor;
}

const cache = new Map();

/** true quando o ponto pode ir para o mapa (ver a regra no topo). */
export function coordenadaCoerente(lat, lng, cidade) {
  if (lat == null || lng == null || !dentroDoMapa(lat, lng)) return false;
  const chave = `${lat}|${lng}|${cidade ?? ""}`;
  if (cache.has(chave)) return cache.get(chave);

  const { lista, porChave } = montarIndice();
  const { x, y } = projetarNoMapa(lat, lng);
  const proprio = porChave.get(chaveMunicipioMapa(cidade));
  let ok;
  if (proprio && naCaixa(proprio, x, y) && dentro(proprio, x, y)) {
    ok = true;
  } else if (proprio && distancia(proprio, x, y) > LIMITE_MUNICIPIO_KM * UNIDADES_POR_KM) {
    ok = false;
  } else {
    const folga = FOLGA_PE_KM * UNIDADES_POR_KM;
    ok = lista.some((m) => naCaixa(m, x, y) && dentro(m, x, y))
      || lista.some((m) => naCaixa(m, x, y, folga) && distancia(m, x, y) <= folga);
  }
  cache.set(chave, ok);
  return ok;
}
