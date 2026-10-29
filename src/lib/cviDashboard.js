import { faixaEtaria } from "@/lib/ocorrenciasDashboard";

// Painel CVI (crime violento intencional) — aba de Ocorrências desde 2026-10-29. Este
// arquivo junta o que o painel (ModuloCvi.jsx) e a tabela de detalhamento (CviTabela.jsx)
// precisam enxergar igual: os rótulos derivados de cada registro e o link de drill-down.
// Todo clique numa visualização do painel leva à tabela filtrada pelos mesmos valores que
// a visualização mostra — por isso os rótulos saem daqui, e não de cada tela.

export const TIPOS_CVI = ["Agressão física", "Arma branca", "Arma de fogo", "Objeto contundente", "Violência sexual", "Outros"];
export const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const FAIXAS_RESPOSTA = [
  { label: "até 5 min", max: 5 }, { label: "5 a 10 min", max: 10 }, { label: "10 a 15 min", max: 15 },
  { label: "15 a 20 min", max: 20 }, { label: "20 a 30 min", max: 30 }, { label: "mais de 30 min", max: Infinity },
];

export const rotuloHora = (h) => `${String(h).padStart(2, "0")}h`;
export const rotuloMes = (aaaaMm) => `${MESES[Number(aaaaMm.slice(5, 7)) - 1]}/${aaaaMm.slice(2, 4)}`;
export const rotuloLocal = (bairro, cidade) => [bairro, cidade].filter(Boolean).join(" — ") || null;

// Município sem acento, em maiúsculas — a mesma chave de marts.populacao_municipio
// (etl/dw/ddl/25), para casar a cidade do ROE com a população do IBGE.
export function chaveMunicipio(nome) {
  return String(nome || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toUpperCase();
}

// Campos derivados de um registro (uma vítima, ou a ocorrência sem ficha de vítima).
export function derivarCvi(r) {
  const d = r.data ? new Date(r.data) : null;
  const valida = d && !Number.isNaN(d.getTime());
  const faixaResposta = r.tempoRespostaMin == null ? null : FAIXAS_RESPOSTA.find((f) => r.tempoRespostaMin <= f.max).label;
  return {
    ...r,
    dia: r.data ? r.data.slice(0, 10) : null,
    hora: valida ? rotuloHora(d.getHours()) : null,
    horaNum: valida ? d.getHours() : null,
    diaSemana: valida ? DIAS_SEMANA[d.getDay()] : null,
    diaSemanaNum: valida ? d.getDay() : null,
    mes: r.data ? rotuloMes(r.data.slice(0, 7)) : null,
    local: rotuloLocal(r.bairro, r.cidade),
    faixa: r.vitima ? faixaEtaria(r.idade, false) : null,
    desfecho: r.entregueVivo === true ? "Entregue com vida" : r.entregueVivo === false ? "Sem vida" : null,
    obito: r.entregueVivo === false || (r.vitimasFataisOcorrencia || 0) > 0,
    faixaResposta,
  };
}

// Link para a tabela de detalhamento. `params`: { chave: valor | [valores] } com as
// chaves das colunas da tabela (CviTabela.jsx), mais `de`/`ate` do período.
export function linkCviTabela(base, params) {
  return linkTabela(`${base}/cvi/tabela`, params);
}

// Mesma montagem de URL para qualquer tabela de detalhamento (CVI e Ocorrências).
export function linkTabela(caminho, params) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([chave, valor]) => {
    if (valor === null || valor === undefined || valor === "") return;
    const lista = valor instanceof Set ? [...valor] : Array.isArray(valor) ? valor : [valor];
    if (!lista.length) return;
    sp.set(chave, lista.join(","));
  });
  const qs = sp.toString();
  return `${caminho}${qs ? `?${qs}` : ""}`;
}
