// Carga e filtro do painel de Mapa de Força.
//
// O dado é NOMINAL (guarnição de cada viatura, com matrícula e nome de guerra)
// e vem do DW pelo backend — GET /dados/mapa-forca/indice e /dia/:data, com
// login SGU e recorte por perfil no servidor (backend/services/dadosService.js,
// views marts.mapa_forca_*). Antes eram arquivos de public/dados/mapa-forca/,
// servidos sem autenticação. O painel só apresenta os últimos 30 dias.
//
// Sem token SGU (login local) ou com o backend fora de alcance, o painel
// avisa em vez de mostrar dado velho.

import { fetchMapaForcaIndice, fetchMapaForcaDia } from "@/lib/dadosClient";
import { capitalizar, postoGradPadrao, turnoPadrao } from "@/lib/textoPadrao";

export const MODULOS_ATIVIDADES_DASHBOARD = [
  { n: 1, key: "mapa-forca", nome: "Mapa de Força" },
];

const SEM_BACKEND =
  "O Mapa de Força é lido do DW pelo servidor do app (login SGU). Entre com a conta SGU " +
  "e confirme que o backend alcança o DW.";

// Cache em memória por dia. Um dia fechado não muda, então não há o que
// invalidar; o índice (que anda com a carga) vale enquanto a aba estiver aberta.
const cache = new Map();

export async function carregarIndice() {
  if (!cache.has("indice")) {
    cache.set("indice", fetchMapaForcaIndice().then(exigir).then(padronizarIndice));
    cache.get("indice").catch(() => cache.delete("indice"));
  }
  return cache.get("indice");
}

export async function carregarDia(data) {
  if (!data) return null;
  if (!cache.has(data)) {
    cache.set(data, fetchMapaForcaDia(data).then(exigir).then(padronizarDia));
    cache.get(data).catch(() => cache.delete(data));
  }
  return cache.get(data);
}

// Dia em que o painel abre. A carga do DW roda uma vez por dia, de madrugada (05:30), então o
// último dia da janela costuma ser o próprio dia da carga, só com o que foi lançado até ali
// (16/10/2026: 46 lançamentos de 2 OMEs e nenhuma viatura, contra ~300 e ~150 nos dias cheios).
// Abre no último dia se ele já tiver ao menos metade dos lançamentos do anterior; senão, no
// anterior. O último dia continua no filtro de data.
export async function diaPadrao(datas) {
  const ultimo = datas[datas.length - 1] || null;
  const anterior = datas[datas.length - 2];
  if (!anterior) return ultimo;
  try {
    const [u, a] = await Promise.all([carregarDia(ultimo), carregarDia(anterior)]);
    return u.lancamentos.length * 2 >= a.lancamentos.length ? ultimo : anterior;
  } catch {
    return ultimo;
  }
}

// Padrão de texto (src/lib/textoPadrao.js): a fonte grava tudo em caixa alta. Só exibição — matrícula, ids,
// OME e acrônimo da viatura (usados em filtro e ligação) não mudam.
function padronizarIndice(i) {
  const postos = {};
  Object.entries(i.postos || {}).forEach(([id, p]) => {
    postos[id] = { ...p, nome: capitalizar(p.nome), municipio: capitalizar(p.municipio), bairro: capitalizar(p.bairro) };
  });
  return { ...i, postos };
}

function padronizarDia(d) {
  return {
    ...d,
    lancamentos: (d.lancamentos || []).map((l) => ({
      ...l,
      tipoServico: capitalizar(l.tipoServico),
      turno: turnoPadrao(l.turno),
      guarnicao: l.guarnicao.map((m) => ({ ...m, postoGrad: postoGradPadrao(m.postoGrad), funcao: capitalizar(m.funcao) })),
    })),
  };
}

function exigir(resposta) {
  if (!resposta) throw new Error(SEM_BACKEND);
  return resposta;
}

// ---------------------------------------------------------------------------
// Filtros
// ---------------------------------------------------------------------------

// Um lançamento entra quando a OME dele está no escopo da unidade sendo
// visualizada. É a mesma regra dos outros Dashboards Pessoais
// (siglasPermitidas, em dashboardHelpers.js): na DGO aparece a subárvore
// inteira; num GB, só aquele GB.
//
// Só 17 OMEs lançam mapa de força, e todas ficam sob a DGO. Numa unidade
// administrativa o painel fica legitimamente vazio — e diz isso, em vez de
// parecer quebrado.
export function filtrarLancamentos(lancamentos, { permitidas, filtros, postos }) {
  if (!lancamentos) return [];
  const { omes, postosSel, tipos, numeros, matricula } = filtros;
  const alvo = (matricula || "").trim().toLowerCase();

  return lancamentos.filter((l) => {
    if (permitidas && permitidas.size && !permitidas.has(l.ome)) return false;
    if (omes?.size && !omes.has(l.ome)) return false;
    if (postosSel?.size && !postosSel.has(l.posto)) return false;

    if (tipos?.size && !l.viaturas.some((v) => tipos.has(v.acronimo))) return false;
    if (numeros?.size && !l.viaturas.some((v) => numeros.has(v.numero))) return false;

    if (alvo) {
      const bate = l.guarnicao.some(
        (m) => (m.matricula || "").toLowerCase().includes(alvo)
          || (m.nomeGuerra || "").toLowerCase().includes(alvo)
      );
      if (!bate) return false;
    }
    return true;
  });
}

// Agrupa por posto de serviço — o grão do balão no mapa. Postos sem
// coordenada saem numa lista à parte em vez de sumirem: são 2 hoje, e some
// balão é pior que balão a menos.
export function agruparPorPosto(lancamentos, postos) {
  const porPosto = new Map();
  const semPosto = [];

  lancamentos.forEach((l) => {
    const info = l.posto ? postos[l.posto] : null;
    if (!info || info.lat == null || info.lon == null) {
      semPosto.push(l);
      return;
    }
    if (!porPosto.has(l.posto)) {
      porPosto.set(l.posto, { id: l.posto, ...info, lancamentos: [], viaturas: 0, militares: 0 });
    }
    const alvo = porPosto.get(l.posto);
    alvo.lancamentos.push(l);
    alvo.viaturas += l.viaturas.length;
    alvo.militares += l.guarnicao.length;
  });

  return { porPosto: Array.from(porPosto.values()), semPosto };
}

// Opções dos filtros, recalculadas sobre o que sobrou dos OUTROS filtros —
// é o que faz "subfiltro" funcionar de fato: escolher um tipo de viatura
// reduz a lista de números de ordem aos daquele tipo.
export function opcoesDeFiltro(lancamentos, postos) {
  const omes = new Set();
  const postosVistos = new Map();
  const tipos = new Set();
  const numerosPorTipo = new Map();
  const militares = new Map();

  lancamentos.forEach((l) => {
    if (l.ome) omes.add(l.ome);
    if (l.posto && postos[l.posto]) postosVistos.set(l.posto, postos[l.posto]);
    l.viaturas.forEach((v) => {
      if (v.acronimo) {
        tipos.add(v.acronimo);
        if (!numerosPorTipo.has(v.acronimo)) numerosPorTipo.set(v.acronimo, new Set());
        if (v.numero) numerosPorTipo.get(v.acronimo).add(v.numero);
      }
    });
    l.guarnicao.forEach((m) => {
      if (m.matricula && !militares.has(m.matricula)) {
        militares.set(m.matricula, `${m.postoGrad || ""} ${m.nomeGuerra || ""}`.trim());
      }
    });
  });

  return {
    omes: Array.from(omes).sort(),
    postos: Array.from(postosVistos.entries())
      .map(([id, p]) => ({ id, nome: p.nome, ome: p.ome }))
      .sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR")),
    tipos: Array.from(tipos).sort(),
    numerosPorTipo,
    militares: Array.from(militares.entries())
      .map(([matricula, nome]) => ({ matricula, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
  };
}

export function totais(lancamentos) {
  const viaturas = new Set();
  const militares = new Set();
  let lancamentosComViatura = 0;
  lancamentos.forEach((l) => {
    if (l.viaturas.length) lancamentosComViatura += 1;
    l.viaturas.forEach((v) => viaturas.add(v.placa || `${v.acronimo}-${v.numero}`));
    l.guarnicao.forEach((m) => militares.add(m.matricula));
  });
  return {
    lancamentos: lancamentos.length,
    lancamentosComViatura,
    viaturas: viaturas.size,
    militares: militares.size,
  };
}
