// Cliente da camada de dados do DW (backend GET /dados/*, ver
// backend/routes/dadosRoutes.js).
//
// Dentro da rede (CapRover/VM): lê do backend, com login SGU e recorte por perfil.
//
// App publicado na Vercel, que NÃO alcança o backend nem o banco: lê o SNAPSHOT
// (arquivos estáticos em /snapshot/*.json, gerados do DW por backend/scripts/
// gerar_snapshot.js e publicados por etl/snapshot/publicar_snapshot.py — sem nome
// completo nem CPF). O snapshot só entra quando não há backend: sem VITE_AUTH_API_URL,
// sem token (login local AGGD) ou backend inalcançável/com erro de servidor. Resposta
// 401/403 do backend (sessão expirada, perfil sem acesso) NÃO cai no snapshot — o
// recorte por perfil vale. No build interno (VITE_APP_INTERNO=1) o snapshot nunca é usado.
const AUTH_API_URL = (import.meta.env.VITE_AUTH_API_URL || "").replace(/\/$/, "");
const INTERNO = import.meta.env.VITE_APP_INTERNO === "1";
const STORAGE_KEY = "cbmpe_auth_user_v2"; // mesma chave de src/lib/authClient.js
const TIMEOUT_MS = 8000;

function tokenDaSessao() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null")?.token || null;
  } catch {
    return null;
  }
}

async function lerSnapshot(caminho) {
  if (INTERNO || caminho.includes("?")) return null; // consulta ao vivo (ex.: contatos) nao tem snapshot
  // "painel/df" -> painel-df.json; "mapa-forca/dia/2026-10-06" -> mapa-forca-dia-2026-10-06.json
  const arquivo = `${caminho.replace(/\//g, "-")}.json`;
  try {
    const resposta = await fetch(`/snapshot/${arquivo}`);
    // Sem o arquivo, a Vercel devolve o index.html (SPA) com 200: confere o tipo.
    if (!resposta.ok || !(resposta.headers.get("content-type") || "").includes("json")) return null;
    const dados = await resposta.json();
    return dados;
  } catch {
    return null;
  }
}

async function getDados(caminho) {
  const token = tokenDaSessao();
  if (!AUTH_API_URL || !token) return lerSnapshot(caminho);

  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${AUTH_API_URL}/dados/${caminho}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controle.signal,
    });
    if (response.ok) return await response.json();
    // 401/403: o backend respondeu e negou — vale o recorte, sem snapshot.
    return response.status >= 500 ? lerSnapshot(caminho) : null;
  } catch {
    // Backend fora do alcance (Vercel, VPN caída).
    return lerSnapshot(caminho);
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

/** Frota por viatura (tabela, dashboard e ficha), recortada pelo perfil no servidor. */
export const fetchViaturasDw = () => getDados("viaturas");

/** Painel corporativo: "df", "vacinacao" ou "ocorrencias". 403 (painel fora
 *  do perfil) também devolve null — a tela segue com o que já tinha. */
export const fetchPainelDw = (nome) => getDados(`painel/${nome}`);

/** Mapa de Força: catálogo dos postos + dias da janela de 30 dias. */
export const fetchMapaForcaIndice = () => getDados("mapa-forca/indice");

/** Mapa de Força de um dia (AAAA-MM-DD), nominal e já recortado pelo perfil. */
export const fetchMapaForcaDia = (data) => getDados(`mapa-forca/dia/${encodeURIComponent(data)}`);

/** Telefones (SGP, ao vivo) da guarnição de um posto num dia: { [matrícula só com dígitos]: "(81) 9…" }.
 *  Sem backend (snapshot da Vercel) devolve null — o detalhe do posto segue sem telefone. */
export const fetchMapaForcaContatos = (data, posto) =>
  getDados(`mapa-forca/contatos?data=${encodeURIComponent(data)}&posto=${encodeURIComponent(posto)}`);
