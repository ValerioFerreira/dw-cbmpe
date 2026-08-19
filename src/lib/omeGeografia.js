// De-para OME -> cidade-sede (fornecido por Igor, ver
// spec-02-distribuicao-geografica.json) — extraído de efetivoDashboard.js
// pra ser reaproveitado também no dashboard de Viaturas. Usado só pra
// desenhar o mapa e pra traduzir um clique num município de volta numa
// lista de OMEs (drill-down).
//
// Chaves mistas de propósito: cada fonte (militares.json, viaturas_detalhe.json)
// grafa a mesma OME de um jeito ligeiramente diferente (ex. "CAT Agreste" vs
// "CAT AGRESTE"), então o mapa acumula as variantes conhecidas em vez de
// normalizar tudo pra uma única grafia.
export const CIDADE_POR_OME = {
  CG: "Recife", SG: "Recife", ADIDO: "Recife", DGO: "Recife", DIEsp: "Recife", DPlaG: "Recife", DAS: "Recife",
  DEIP: "Recife", AECI: "Recife", DVP: "Recife", "DInter/2": "Petrolina", DGP: "Recife", "DInter/1": "Caruaru",
  DLog: "Recife", DJD: "Recife", DTIC: "Recife", DF: "Recife", "6ºGB": "Garanhuns", "1ºGB": "Vitória de Santo Antão",
  "3ºGB": "Serra Talhada", GBI: "Jaboatão dos Guararapes", AjG: "Recife", GBS: "Abreu e Lima", CInt: "Recife",
  "4ºGB": "Petrolina", "CAT/RMR": "Recife", GBAPH: "Olinda", "2ºGB": "Caruaru", CEFD: "Recife", "7ºGB": "Carpina",
  ABMG: "Jaboatão dos Guararapes", CI: "Recife", CEAO: "Recife", GBMar: "Recife", "CAT Zona da Mata": "Goiana",
  "5ºGB": "Salgueiro", "CAT Sertão": "Petrolina", GCG: "Recife", "CAT Agreste": "Caruaru", "9ºGB": "Arcoverde",
  CPPA: "Recife", CMan: "Recife", CCS: "Recife", DIM: "Recife", CPO: "Recife", GSG: "Recife",
  // Grafias específicas de viaturas_detalhe.json (mesma OME das linhas
  // acima, só que com outro texto na fonte de origem).
  "CAT RMR": "Recife", "CAT MATA": "Goiana", "CAT AGRESTE": "Caruaru", "CAT SERTÃO": "Petrolina",
};

export function omesDaCidade(nomeCidade) {
  return Object.entries(CIDADE_POR_OME).filter(([, cidade]) => cidade === nomeCidade).map(([ome]) => ome);
}
