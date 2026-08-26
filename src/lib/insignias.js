// Insígnia (brasão) de cada unidade.
//
// Os arquivos vêm do "CBMPE - Repositório de Insígnias" enviado pelo usuário,
// que fica FORA do commit — só os PNG das unidades que o app desenha entram,
// já reduzidos para 256px por etl/_geo/copiar_insignias.py. Ficam em
// public/insignias/, servidos como arquivo estático (não entram no bundle).
//
// Unidade sem insígnia própria (Comando Geral, Subcomando, GCG, GSG, CPO,
// CPP, DGA e a DVP, que não está no repositório) cai no brasão da corporação.
// Preferimos o brasão a não mostrar nada: o espaço no cabeçalho já está
// reservado, e um buraco lê como erro de carregamento.

const BASE = "/insignias";

/** Sigla → nome de arquivo seguro em URL. Espelha sigla_para_arquivo em
 *  etl/_geo/copiar_insignias.py — mudou lá, muda aqui. */
export function siglaParaArquivo(sigla) {
  const limpa = String(sigla || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "");
  return limpa.replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

// Unidades sem insígnia própria no repositório.
const SEM_INSIGNIA = new Set([
  "COMANDO GERAL", "SUBCOMANDO GERAL", "GCG", "GSG", "CPO", "CPP", "DGA", "DVP",
]);

export const BRASAO_CBMPE = `${BASE}/CBMPE.png`;

/** URL da insígnia da unidade (ou o brasão da corporação). */
export function insigniaDaUnidade(sigla) {
  if (!sigla || SEM_INSIGNIA.has(sigla)) return BRASAO_CBMPE;
  return `${BASE}/${siglaParaArquivo(sigla)}.png`;
}

// Grupamentos e batalhões — os únicos que ganham insígnia no MAPA (decisão do
// usuário: no mapa, só os grupamentos; no QCG, o brasão). Diretorias e
// centros aparecem com insígnia na página da unidade, não sobre o mapa.
const GRUPAMENTOS = new Set([
  "1º GB", "2º GB", "3º GB", "4º GB", "5º GB", "6º GB", "7º GB", "9º GB",
  "GBI", "GBS", "GBMar", "GBAPH", "ABMG",
]);

export function ehGrupamento(sigla) {
  return GRUPAMENTOS.has(sigla);
}

/**
 * Insígnia para desenhar sobre o mapa, ou null quando o ponto não é um
 * grupamento nem o QCG. O QCG concentra as diretorias e o comando, então
 * recebe o brasão da corporação em vez da insígnia de uma delas.
 */
export function insigniaNoMapa(sigla, nomeDoPosto) {
  if (/\bQCG\b/i.test(nomeDoPosto || "")) return BRASAO_CBMPE;
  return ehGrupamento(sigla) ? insigniaDaUnidade(sigla) : null;
}
