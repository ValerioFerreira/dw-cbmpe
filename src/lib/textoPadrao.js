// Padrão de texto exibido no Mapa de Força. O DW e o Mapa de Força gravam quase tudo em CAIXA ALTA
// (função, tipo de serviço, nome do posto, município, turno), enquanto o resto do sistema usa
// Capitalização por palavra e o posto/graduação no formato do Efetivo ("3ºSgt", "Cb", "Sd").
//   - nome de guerra e matrícula: ficam como estão (caixa alta / número);
//   - posto/graduação: o mesmo formato do Efetivo;
//   - demais textos: Capitalizado, com conectivos ("de", "da", "e"...) em minúsculas e as siglas
//     conhecidas (GBS, APH, CAT...) em caixa alta.
// Só afeta a EXIBIÇÃO: os campos usados em filtro e em ligação (matrícula, id, OME, acrônimo da viatura)
// não mudam.

const SIGLAS = new Set([
  "GB", "GBS", "GBAPH", "GBI", "GBFN", "SB", "SBI", "SBAPH", "SBS", "SBSA", "SBFN", "CAT", "ZM", "RMR",
  "QCG", "CMAN", "ABMG", "DGO", "DIM", "DIESP", "DPCIP", "DAP", "CIAT", "CIODS", "ATI", "SATEC", "DINTER",
  "APH", "CCI", "CRS", "ARP", "IML", "GAPH", "GCI", "GS", "AT", "AIS", "II", "III", "IV", "V", "VI",
]);
const ESPECIAIS = { GBMAR: "GBMar" };
const CONECTIVOS = new Set(["de", "da", "do", "das", "dos", "e", "em", "a", "o", "as", "os", "com", "para", "por", "no", "na", "nos", "nas", "ao", "aos"]);

const POSTO_GRAD = {
  CEL: "Cel", TC: "Ten Cel", MAJ: "Maj", CAP: "Cap", "1ºTEN": "1ºTen", "2ºTEN": "2ºTen", ASP: "Aspirante",
  SUBTEN: "Subten", "1ºSGT": "1ºSgt", "2ºSGT": "2ºSgt", "3ºSGT": "3ºSgt", CB: "Cb", SD: "Sd",
};

const chave = (v) => String(v || "").toUpperCase().replace("°", "º").replace(/\s+/g, "");

/** "UNIDADE TÁTICA DE MERGULHO" -> "Unidade Tática de Mergulho". */
export function capitalizar(texto) {
  if (texto === null || texto === undefined) return texto;
  const partes = String(texto).trim().split(/([\s/()\-–,.]+)/);
  let primeira = true;
  return partes.map((p) => {
    if (!p || /^[\s/()\-–,.]+$/.test(p)) return p;
    const baixa = p.toLowerCase();
    const sigla = baixa.toUpperCase();
    let saida;
    if (ESPECIAIS[sigla]) saida = ESPECIAIS[sigla];
    else if (SIGLAS.has(sigla)) saida = sigla;
    else if (/\d/.test(p)) saida = p.toUpperCase(); // 1ªSB, 022L, 12H: código, fica como veio
    else if (!primeira && CONECTIVOS.has(baixa)) saida = baixa;
    else saida = baixa.charAt(0).toUpperCase() + baixa.slice(1);
    primeira = false;
    return saida;
  }).join("");
}

/** "3º SGT" -> "3ºSgt", "SD" -> "Sd" (formato do Efetivo). Desconhecido: capitaliza. */
export function postoGradPadrao(pg) {
  if (!pg) return pg;
  return POSTO_GRAD[chave(pg)] || capitalizar(pg);
}

/** Posição do posto/graduação na hierarquia (0 = mais antigo); desconhecido vai por último. */
export function ordemPostoGrad(pg) {
  const k = Object.keys(POSTO_GRAD);
  const i = k.indexOf(chave(pg));
  if (i !== -1) return i;
  const j = Object.values(POSTO_GRAD).findIndex((v) => chave(v) === chave(pg));
  return j === -1 ? k.length : j;
}

/** "1º TURNO" -> "1º Turno"; "24H" -> "24h". */
export function turnoPadrao(t) {
  if (!t) return t;
  const x = String(t).trim().replace("°", "º");
  return /^\d+H$/i.test(x) ? x.toLowerCase() : capitalizar(x);
}
