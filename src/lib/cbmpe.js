// CBMPE BI — Núcleo de dados e helpers de hierarquia
import { NODES_PADRAO, montarOrganograma, metricasProprias, metricasDivisoesProprias } from "@/data/organograma";
import { fetchOrganogramaRemoto } from "@/lib/organogramaClient";

export { metricasProprias, metricasDivisoesProprias };

export const CORES_TIPO = {
  comando: { label: "Comando-Geral", token: "primary", dot: "bg-primary" },
  diretoria: { label: "Diretoria", token: "accent", dot: "bg-accent" },
  grupamento: { label: "Grupamento", token: "chart-3", dot: "bg-chart-3" },
  departamento: { label: "Departamento", token: "chart-4", dot: "bg-chart-4" },
  escola: { label: "Escola", token: "chart-5", dot: "bg-chart-5" },
  secao: { label: "Seção", token: "muted-foreground", dot: "bg-muted-foreground" },
  pelotao: { label: "Pelotão", token: "secondary-foreground", dot: "bg-secondary-foreground" }
};

export const CATEGORIAS = {
  operacional: { label: "Operacional", cor: "text-primary" },
  financeiro: { label: "Financeiro", cor: "text-chart-4" },
  logistico: { label: "Logístico", cor: "text-accent" },
  ensino: { label: "Ensino & Pesquisa", cor: "text-chart-3" },
  recursos_humanos: { label: "Recursos Humanos", cor: "text-chart-5" },
  saude: { label: "Saúde", cor: "text-chart-2" },
  gestao: { label: "Gestão", cor: "text-foreground" }
};

export const SEVERIDADE = {
  critica: { label: "Crítica", token: "destructive", dot: "bg-destructive", text: "text-destructive", badge: "bg-destructive/10 text-destructive" },
  alta: { label: "Alta", token: "primary", dot: "bg-primary", text: "text-primary", badge: "bg-primary/10 text-primary" },
  media: { label: "Média", token: "accent", dot: "bg-accent", text: "text-accent", badge: "bg-accent/10 text-accent" },
  baixa: { label: "Baixa", token: "chart-3", dot: "bg-chart-3", text: "text-chart-3", badge: "bg-chart-3/10 text-chart-3" }
};

// ----- Fetchers -----
// A estrutura (sigla/nível/pai) vem do backend de organograma quando
// configurado (GET /organograma, ver src/lib/organogramaClient.js) — ela é
// a única parte editável em /adm (ver src/pages/Administracao.jsx). Os
// mocks de indicador/dashboard/alerta continuam vindo de
// src/data/organograma.js (fora do escopo do organograma editável), mas
// são remontados a partir de QUALQUER árvore ativa via montarOrganograma(),
// pra uma unidade movida/renomeada aparecer consistente em todo o app.
//
// `organogramaCache` guarda a promise em memória pra Promise.all(4x) do
// CbmpeProvider não disparar 4 GETs simultâneos nem remontar 4 vezes — ver
// invalidarCacheOrganograma(), chamada pelo contexto sempre que
// recarregar() roda de novo (ex. depois de uma edição em /adm).
let organogramaCache = null;

async function carregarOrganograma() {
  if (organogramaCache) return organogramaCache;
  organogramaCache = (async () => {
    let nodes = NODES_PADRAO;
    try {
      const remoto = await fetchOrganogramaRemoto();
      if (remoto && remoto.length) nodes = remoto;
    } catch (e) {
      // Backend fora do ar ou não configurado: cai no organograma padrão
      // embutido no bundle — o app nunca fica sem estrutura nenhuma.
      console.warn("Organograma: usando estrutura padrão local (backend indisponível)", e);
    }
    return montarOrganograma(nodes);
  })();
  return organogramaCache;
}

// Chamada depois de qualquer criação/edição/exclusão de unidade em /adm,
// pra próxima leitura buscar a árvore atualizada em vez da cacheada.
export function invalidarCacheOrganograma() {
  organogramaCache = null;
}

export async function fetchUnidades() {
  const { unidades } = await carregarOrganograma();
  return [...unidades].sort((a, b) => b.nivel - a.nivel);
}

export async function fetchIndicadores() {
  const { indicadores } = await carregarOrganograma();
  return indicadores;
}

export async function fetchDashboards() {
  const { dashboards } = await carregarOrganograma();
  return [...dashboards].sort((a, b) => (b.atualizado_em || "").localeCompare(a.atualizado_em || ""));
}

export async function fetchAlertas() {
  const { alertas } = await carregarOrganograma();
  return [...alertas].sort((a, b) => (b.data || "").localeCompare(a.data || ""));
}

// ----- Árvore -----
export function buildArvore(unidades) {
  const porId = {};
  unidades.forEach((u) => (porId[u.id] = { ...u, filhos: [] }));
  const raizes = [];
  Object.values(porId).forEach((u) => {
    if (u.parent_id && porId[u.parent_id]) {
      porId[u.parent_id].filhos.push(u);
    } else {
      raizes.push(u);
    }
  });
  ordenarArvore(raizes);
  return { raizes, porId };
}

function ordenarArvore(nos) {
  nos.sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
  nos.forEach((n) => ordenarArvore(n.filhos));
}

export function getFilhos(unidades, parentId) {
  return unidades
    .filter((u) => (parentId ? u.parent_id === parentId : !u.parent_id))
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

export function getCaminho(unidades, id) {
  const mapa = {};
  unidades.forEach((u) => (mapa[u.id] = u));
  const caminho = [];
  let atual = id ? mapa[id] : null;
  while (atual) {
    caminho.unshift(atual);
    atual = atual.parent_id ? mapa[atual.parent_id] : null;
  }
  return caminho;
}

export function getSubordinados(unidades, id) {
  // todos os descendentes
  const filhos = getFilhos(unidades, id);
  let todos = [...filhos];
  filhos.forEach((f) => {
    todos = todos.concat(getSubordinados(unidades, f.id));
  });
  return todos;
}

export function contarSubordinados(unidades, id) {
  const mapaFilhos = {};
  unidades.forEach((u) => {
    if (u.parent_id) {
      mapaFilhos[u.parent_id] = (mapaFilhos[u.parent_id] || 0) + 1;
    }
  });
  let count = 0;
  let fila = [id];
  const vistos = new Set();
  while (fila.length) {
    const atual = fila.pop();
    if (vistos.has(atual)) continue;
    vistos.add(atual);
    unidades
      .filter((u) => u.parent_id === atual)
      .forEach((u) => {
        count++;
        fila.push(u.id);
      });
  }
  return count;
}

export function parseSerie(serie) {
  if (!serie) return [];
  try {
    const arr = typeof serie === "string" ? JSON.parse(serie) : serie;
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function fmtNumero(v, unidade = "") {
  if (v === null || v === undefined || isNaN(v)) return "—";
  const n = Number(v);
  const opts =
    Math.abs(n) >= 1000
      ? { maximumFractionDigits: 0 }
      : { maximumFractionDigits: 1 };
  return `${n.toLocaleString("pt-BR", opts)}${unidade ? " " + unidade : ""}`;
}

export function fmtPercentual(v) {
  if (v === null || v === undefined || isNaN(v)) return "—";
  const sinal = v > 0 ? "+" : "";
  return `${sinal}${Number(v).toFixed(1)}%`;
}

export function fmtMoeda(v) {
  if (v === null || v === undefined || isNaN(v)) return "—";
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

// Título/valor/complemento padronizados para os cards de indicador (KpiCard) —
// evita repetir a mesma lógica de formatação em Home, Diretoria e DashboardDetalhe.
export function tituloKpi(k) {
  return k.nome === "Efetivo" ? "Efetivo Atual" : k.nome;
}

export function valorKpi(k) {
  if (k.nome === "Materiais" || k.nome === "Atividades Específicas") return "Em construção";
  if (k.nome === "Finanças") return fmtMoeda(k.valor);
  return fmtNumero(k.valor);
}

export function extraKpi(k) {
  if (k.nome === "Efetivo" && k.meta != null) return `Previsto: ${fmtNumero(k.meta)}`;
  if (k.nome === "Finanças" && k.executadoPct != null) return `Executado: ${k.executadoPct}%`;
  return undefined;
}

// ----- Indicadores e Submódulos -----
export const KPI_BASES = ["Efetivo", "Viaturas", "Materiais", "Finanças", "Atividades Específicas"];

// Cor consistente por tipo de indicador, usada nos filtros e gráficos comparativos.
export const COR_INDICADOR = {
  Efetivo: "hsl(var(--primary))",
  Viaturas: "hsl(var(--accent))",
  Materiais: "hsl(var(--chart-3))",
  "Finanças": "hsl(var(--chart-4))",
  "Atividades Específicas": "hsl(var(--chart-5))",
};

export const MODULOS_POR_INDICADOR = {
  Efetivo: [
    { key: "por_unidade", nome: "Efetivo por Unidade" },
    { key: "por_posto", nome: "Efetivo por Posto/Graduação" },
    { key: "por_regiao", nome: "Efetivo por Região" },
    { key: "historico", nome: "Efetivo Histórico" }
  ],
  Viaturas: [
    { key: "por_unidade", nome: "Viaturas por Unidade" },
    { key: "por_tipo", nome: "Viaturas por Tipo" },
    { key: "disponibilidade", nome: "Disponibilidade Operacional" },
    { key: "historico", nome: "Viaturas Histórico" }
  ],
  Materiais: [
    { key: "por_unidade", nome: "Materiais por Unidade" },
    { key: "por_categoria", nome: "Materiais por Categoria" },
    { key: "estoque", nome: "Nível de Estoque" },
    { key: "historico", nome: "Materiais Histórico" }
  ],
  Finanças: [
    { key: "por_unidade", nome: "Finanças por Unidade" },
    { key: "orcamento", nome: "Execução Orçamentária" },
    { key: "despesas", nome: "Despesas por Categoria" },
    { key: "historico", nome: "Finanças Histórico" }
  ],
  "Atividades Específicas": [
    { key: "por_unidade", nome: "Atividades por Unidade" },
    { key: "por_tipo", nome: "Atividades por Tipo" },
    { key: "por_regiao", nome: "Atividades por Região" },
    { key: "historico", nome: "Atividades Histórico" }
  ]
};

// ----- Séries por período (dia/semana/mês/trimestre/ano) -----
// Gera uma série determinística (mesmo seed => mesmos números) para uso nos
// gráficos de evolução quando o usuário troca a granularidade do período —
// não há backend real, então cada granularidade é simulada a partir do valor
// atual do indicador.
function hashSeedLocal(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function criarRngLocal(seedStr) {
  let a = hashSeedLocal(seedStr);
  return function rng() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PERIODO_CONFIG = {
  dia: { pontos: 30, prefixo: "D" },
  semana: { pontos: 12, prefixo: "S" },
  mes: { pontos: 12, prefixo: "M" },
  trimestre: { pontos: 8, prefixo: "T" },
  ano: { pontos: 5, prefixo: "A" },
};

export const PERIODO_OPCOES = [
  { key: "dia", label: "Dia" },
  { key: "semana", label: "Semana" },
  { key: "mes", label: "Mês" },
  { key: "trimestre", label: "Trimestre" },
  { key: "ano", label: "Ano" },
];

export function gerarSerieIndicadorPeriodo(indicadorId, valorFinal, periodo = "mes") {
  const cfg = PERIODO_CONFIG[periodo] || PERIODO_CONFIG.mes;
  const rng = criarRngLocal(`${indicadorId}:${periodo}`);
  const inicio = valorFinal * (0.75 + rng() * 0.15);
  const serie = [];
  for (let i = 0; i < cfg.pontos; i++) {
    const progresso = cfg.pontos <= 1 ? 1 : i / (cfg.pontos - 1);
    const base = inicio + (valorFinal - inicio) * progresso;
    const ruido = base * 0.08 * (rng() * 2 - 1);
    serie.push(Math.max(0, Math.round(base + ruido)));
  }
  serie[cfg.pontos - 1] = Math.round(valorFinal);
  return serie.map((valor, i) => ({ label: `${cfg.prefixo}${i + 1}`, valor }));
}

export function getBaseIndicador(nome) {
  const base = (nome || "").split(" · ")[0].split(" - ")[0].trim();
  return KPI_BASES.includes(base) ? base : base;
}

export function getModulosIndicador(nome) {
  const base = getBaseIndicador(nome);
  return MODULOS_POR_INDICADOR[base] || [
    { key: "por_unidade", nome: `${base} por Unidade` },
    { key: "historico", nome: `${base} Histórico` }
  ];
}

// Retorna os indicadores de mesmo nome nas unidades subordinadas (descendentes)
export function getIndicadoresSubordinados(indicadores, unidades, unidadeId, nomeIndicador) {
  const subs = getSubordinados(unidades, unidadeId).map((u) => u.id);
  return indicadores.filter((i) => subs.includes(i.unidade_id) && i.nome === nomeIndicador);
}