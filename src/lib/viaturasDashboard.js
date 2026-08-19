import { useMemo, useState } from "react";
import { passaMultiSelect } from "@/lib/dashboardHelpers";
import { CIDADE_POR_OME } from "@/lib/omeGeografia";
import viaturasDetalhe from "@/data/real/viaturas_detalhe.json";

export { groupCount, paraSerie, pctTexto } from "@/lib/dashboardHelpers";
export { omesDaCidade } from "@/lib/omeGeografia";

// Helpers e constantes do "Dashboard Pessoal de Viaturas" — mesmo padrão de
// módulos-em-abas já validado no Efetivo (ver efetivoDashboard.js), aplicado
// à frota. Fonte: viaturas_detalhe.json (805 viaturas com placa, campos
// ricos por veículo — tipo, combustível, posse, rastreamento etc.), não
// viaturas_lista.json (que só tem ano/modelo/nome/patrimônio/placa/situação
// e alimenta a tabela real em ViaturaDetalhe.jsx).

export const MODULOS_VIATURAS_DASHBOARD = [
  { n: 1, key: "geral", nome: "Frota Geral" },
  { n: 2, key: "geografico", nome: "Distribuição Geográfica" },
  { n: 3, key: "idade", nome: "Idade e Renovação" },
  { n: 4, key: "tipos", nome: "Tipos e Capacidade Operacional" },
  { n: 5, key: "uso", nome: "Manutenção, Rastreamento e Uso" },
];

export const FAIXA_IDADE_ORDER = ["0-5", "6-10", "11-15", "16-20", "21+"];
export const FAIXA_CONDUTORES_ORDER = ["0", "1", "2-3", "4+"];

// De-para sigla curta de viaturas_detalhe.json (ex. "1ºGB", "DInter/1",
// "CAT AGRESTE") -> sigla real de viaturas.json/viaturas_lista.json (ex.
// "1º GB", "DINTER I", "CAT/AG") — mesma natureza do problema já resolvido
// pra Efetivo em omeSiglaReal (efetivoDashboard.js): duas extrações
// diferentes, duas grafias diferentes pra mesma OME. Sem essa tradução o
// drill-down pra tabela real de Viaturas (ViaturaDetalhe.jsx, que lê
// viaturas_lista.json) não encontraria ninguém nas OMEs cuja grafia diverge.
// A maioria dos códigos de Guarnição/Diretoria já é idêntica nas duas fontes
// (ex. "GBI", "DAS") — só entram aqui os que divergem de fato.
const OME_SIGLA_REAL_VIATURAS = {
  "1ºGB": "1º GB", "2ºGB": "2º GB", "3ºGB": "3º GB", "4ºGB": "4º GB",
  "5ºGB": "5º GB", "6ºGB": "6º GB", "7ºGB": "7º GB", "9ºGB": "9º GB",
  AjG: "AJG", CInt: "CINT", CMan: "CMAN",
  DIEsp: "DIESP", DPlaG: "DPLAG", DLog: "DLOG",
  "DInter/1": "DINTER I", "DInter/2": "DINTER II",
  "CAT AGRESTE": "CAT/AG", "CAT MATA": "CAT/ZM", "CAT RMR": "CAT/RMR", "CAT SERTÃO": "CAT/SE",
};

export function omeSiglaRealViatura(sigla) {
  return OME_SIGLA_REAL_VIATURAS[sigla] || sigla;
}

// Linhas de trabalho do dashboard — achatadas de viaturas_detalhe.por_placa,
// com duas regras de negócio já aplicadas, pra bater com o resto do app:
//  - GTA é unidade fora do organograma (ver comentário em organograma.js,
//    src/data/organograma.js linha ~179) — sua única viatura fica de fora de
//    qualquer contagem por OME, mesma decisão já tomada pro KPI real.
//  - Viaturas "Descarregada" somem da lista e "Devolvida" aparece como
//    "Ativa" — mesma transformação já aplicada em ViaturaDetalhe.jsx, pra o
//    dashboard nunca mostrar um total que a tabela de baixo não bate.
// `cidade` é derivado aqui via CIDADE_POR_OME (não vem pronto na fonte, ao
// contrário de militares.json).
export const LINHAS_VIATURAS = Object.entries(viaturasDetalhe.por_placa)
  .map(([placa, r]) => ({ ...r, placa }))
  .filter((r) => r.ome !== "GTA" && r.situacao !== "Descarregada")
  .map((r) => ({
    ...r,
    situacao: r.situacao === "Devolvida" ? "Ativa" : r.situacao,
    cidade: CIDADE_POR_OME[r.ome] || null,
  }));

// Filtro padrão dos 5 módulos do dashboard: OME, Situação, Tipo e
// Destinação em todas as abas — mesmo princípio do useFiltrosEfetivo.
export function useFiltrosViaturas(viaturas) {
  const [omes, setOmes] = useState(new Set());
  const [situacoes, setSituacoes] = useState(new Set());
  const [tipos, setTipos] = useState(new Set());
  const [destinacoes, setDestinacoes] = useState(new Set());

  const filtrados = useMemo(
    () => viaturas.filter((r) =>
      passaMultiSelect(r.ome, omes) &&
      passaMultiSelect(r.situacao, situacoes) &&
      passaMultiSelect(r.tipoAcronym, tipos) &&
      passaMultiSelect(r.destinacao, destinacoes)
    ),
    [viaturas, omes, situacoes, tipos, destinacoes]
  );

  const filtroAtivo = omes.size > 0 || situacoes.size > 0 || tipos.size > 0 || destinacoes.size > 0;

  function limparTudo() {
    setOmes(new Set());
    setSituacoes(new Set());
    setTipos(new Set());
    setDestinacoes(new Set());
  }

  return {
    omes, setOmes, situacoes, setSituacoes, tipos, setTipos, destinacoes, setDestinacoes,
    filtrados, filtroAtivo, limparTudo,
  };
}

// Parâmetros dos filtros globais ativos, no formato que linkViaturaTabela
// espera — usado por todo módulo antes de somar seus próprios filtros extras.
export function paramsAtuaisViaturas({ omes, situacoes, tipos, destinacoes }) {
  const p = {};
  if (omes.size) p.ome = [...omes];
  if (situacoes.size) p.situacao = [...situacoes];
  if (tipos.size) p.tipoAcronym = [...tipos];
  if (destinacoes.size) p.destinacao = [...destinacoes];
  return p;
}

// Monta a URL da tabela real de Viaturas (/viaturas/:id) já filtrada — usada
// pelo drill-down (clique em barra/fatia/linha de algum módulo do
// dashboard). Mesmo contrato de linkEfetivoTabela: string|string[] vira
// filtro exato, {min,max} vira intervalo numérico (resolvido em runtime pela
// ViaturaDetalhe contra os valores reais da coluna).
export function linkViaturaTabela(indId, params) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([chave, valor]) => {
    if (valor === null || valor === undefined) return;
    if (typeof valor === "object" && !Array.isArray(valor) && ("min" in valor || "max" in valor)) {
      if (valor.min !== undefined && valor.min !== null) sp.set(`${chave}Min`, String(valor.min));
      if (valor.max !== undefined && valor.max !== null) sp.set(`${chave}Max`, String(valor.max));
      return;
    }
    const listaBruta = Array.isArray(valor) ? valor : [valor];
    if (listaBruta.length === 0) return;
    const lista = chave === "ome" ? listaBruta.map(omeSiglaRealViatura) : listaBruta;
    sp.set(chave, lista.join(","));
  });
  const qs = sp.toString();
  return `/viaturas/${indId}${qs ? `?${qs}` : ""}`;
}

// Idade da frota em anos, a partir do ano de fabricação — treze viaturas na
// fonte têm "ano: 23" (erro de digitação/truncamento, não 1923 nem 2023);
// tratamos qualquer ano < 1980 como desconhecido em vez de adivinhar, e essas
// viaturas ficam de fora dos gráficos de idade (mas continuam nos demais).
export function anoValido(ano) {
  return typeof ano === "number" && ano >= 1980 && ano <= new Date().getFullYear();
}

export function bucketIdadeFrota(ano, anoAtual = new Date().getFullYear()) {
  if (!anoValido(ano)) return null;
  const idade = anoAtual - ano;
  if (idade <= 5) return "0-5";
  if (idade <= 10) return "6-10";
  if (idade <= 15) return "11-15";
  if (idade <= 20) return "16-20";
  return "21+";
}

// Faixa de idade -> intervalo de ANO de fabricação (a coluna real é "ano",
// não idade) — "0-5" anos de idade em 2026 = fabricada entre 2021 e 2026.
export function faixaIdadeParaAnoIntervalo(faixa, anoAtual = new Date().getFullYear()) {
  const tabela = {
    "0-5": { min: anoAtual - 5, max: anoAtual },
    "6-10": { min: anoAtual - 10, max: anoAtual - 6 },
    "11-15": { min: anoAtual - 15, max: anoAtual - 11 },
    "16-20": { min: anoAtual - 20, max: anoAtual - 16 },
    "21+": { min: 1980, max: anoAtual - 21 },
  };
  return tabela[faixa];
}

export function bucketCondutores(condutores) {
  if (!condutores) return "0";
  if (condutores === 1) return "1";
  if (condutores <= 3) return "2-3";
  return "4+";
}

export function faixaCondutoresParaIntervalo(faixa) {
  const tabela = {
    "0": { min: 0, max: 0 },
    "1": { min: 1, max: 1 },
    "2-3": { min: 2, max: 3 },
    "4+": { min: 4, max: 1000 },
  };
  return tabela[faixa];
}

// Dias desde o último abastecimento registrado — null quando nunca houve
// registro (224 das 805 viaturas, ver ultimoAbastecimentoData ausente).
export function diasDesdeAbastecimento(iso, agora = Date.now()) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((agora - t) / 86400000);
}
