// Carga e filtro do painel de Mapa de Força.
//
// É o primeiro dado do app que NÃO vem do bundle. Todos os outros
// (efetivo_lista.json, viaturas_detalhe.json...) são `import`ados, e o Vite
// os embute no JS — o navegador baixa tudo antes do login. O mapa de força
// não cabe nesse modelo: são ~280 lançamentos por dia, com guarnição nominal,
// e o painel precisa de qualquer data dentro da janela.
//
// Então aqui o dado é BUSCADO em tempo de execução, de `public/dados/
// mapa-forca/`, um arquivo por dia (~130 KB). O bundle não cresce, e a
// janela muda sem tocar em código.
//
// Quando existir servidor com autenticação, só a URL abaixo muda — o painel
// não sabe de onde o dado veio. É o mesmo seam que src/data/organograma.js
// usa para os JSONs estáticos.
//
// Os arquivos são gerados por etl/mapa_forca/extract_mapa_forca.py.

const BASE = "/dados/mapa-forca";

export const MODULOS_ATIVIDADES_DASHBOARD = [
  { n: 1, key: "mapa-forca", nome: "Mapa de Força" },
];

// Cache em memória por dia. Trocar de data e voltar não rebusca — e um dia
// já fechado nunca muda, então não há o que invalidar.
const cache = new Map();

export async function carregarIndice() {
  if (!cache.has("indice")) {
    cache.set("indice", fetch(`${BASE}/indice.json`).then(aceitarJson));
  }
  return cache.get("indice");
}

export async function carregarDia(data) {
  if (!data) return null;
  if (!cache.has(data)) {
    cache.set(data, fetch(`${BASE}/${data}.json`).then(aceitarJson));
  }
  return cache.get(data);
}

// `fetch` não rejeita em 404 — e neste app o 404 vem com cara de sucesso: a
// Vercel e o nginx reescrevem qualquer rota desconhecida para /index.html
// (SPA), então um arquivo faltando devolve 200 com HTML. Sem esta checagem o
// erro apareceria como "Unexpected token '<'", que não diz nada.
async function aceitarJson(resposta) {
  if (!resposta.ok) {
    throw new Error(`Arquivo do mapa de força não encontrado (HTTP ${resposta.status}).`);
  }
  const tipo = resposta.headers.get("content-type") || "";
  if (!tipo.includes("json")) {
    throw new Error(
      "O servidor devolveu HTML no lugar do JSON — provavelmente os arquivos " +
      "de public/dados/mapa-forca/ não foram publicados neste deploy."
    );
  }
  return resposta.json();
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
