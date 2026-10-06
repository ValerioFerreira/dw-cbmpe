// Cliente da camada de dados do DW (backend GET /dados/*, ver
// backend/routes/dadosRoutes.js).
//
// Sempre com fallback: sem backend configurado (VITE_AUTH_API_URL vazio),
// sem sessão SGU (ex.: login local AGGD, que não tem token) ou com o backend
// fora do alcance (app na Vercel, fora da rede do CBMPE), devolve null e o
// app segue com os JSON embutidos no bundle. No CapRover, dentro da rede,
// passa a ler do DW sem nenhuma mudança de código.
const AUTH_API_URL = (import.meta.env.VITE_AUTH_API_URL || "").replace(/\/$/, "");
const STORAGE_KEY = "cbmpe_auth_user_v2"; // mesma chave de src/lib/authClient.js
const TIMEOUT_MS = 8000;

function tokenDaSessao() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null")?.token || null;
  } catch {
    return null;
  }
}

async function getDados(caminho) {
  const token = tokenDaSessao();
  if (!AUTH_API_URL || !token) return null;

  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${AUTH_API_URL}/dados/${caminho}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controle.signal,
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Agregados por unidade + titulares (sem recorte por perfil). */
export const fetchMetricasDw = () => getDados("metricas");

/** Relação nominal do efetivo, já recortada pelo perfil no servidor. */
export const fetchEfetivoDw = () => getDados("efetivo");

/** Lotação por função (QOD), já recortada pelo perfil no servidor. */
export const fetchLotacaoDw = () => getDados("lotacao");

/** Painel corporativo: "df", "vacinacao" ou "ocorrencias". 403 (painel fora
 *  do perfil) também devolve null — a tela segue com o que já tinha. */
export const fetchPainelDw = (nome) => getDados(`painel/${nome}`);

/** Mapa de Força: catálogo dos postos + dias da janela de 30 dias. */
export const fetchMapaForcaIndice = () => getDados("mapa-forca/indice");

/** Mapa de Força de um dia (AAAA-MM-DD), nominal e já recortado pelo perfil. */
export const fetchMapaForcaDia = (data) => getDados(`mapa-forca/dia/${encodeURIComponent(data)}`);
