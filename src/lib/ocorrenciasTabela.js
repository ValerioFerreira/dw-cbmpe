import { DIAS_SEMANA, rotuloHora, rotuloMes, rotuloLocal, linkTabela } from "@/lib/cviDashboard";

// Tabela de detalhamento de Ocorrências (/ocorrencias/:id/tabela, 2026-10-29) — a
// "planilha" do indicador, como as de Efetivo, Viaturas e Finanças. Os rótulos saem
// daqui para o painel (drill-down da aba Geolocalização) e a tabela enxergarem igual.

const simNao = (v) => (v == null ? null : v ? "Sim" : "Não");

export function derivarOcorrencia(r) {
  const d = r.data ? new Date(r.data) : null;
  const valida = d && !Number.isNaN(d.getTime());
  return {
    ...r,
    dia: r.data ? r.data.slice(0, 10) : null,
    hora: valida ? rotuloHora(d.getHours()) : null,
    diaSemana: valida ? DIAS_SEMANA[d.getDay()] : null,
    mes: r.data ? rotuloMes(r.data.slice(0, 7)) : null,
    local: rotuloLocal(r.bairro, r.cidade),
    atendida: simNao(r.ocorrenciaAtendida),
  };
}

export function linkOcorrenciasTabela(base, params) {
  return linkTabela(`${base}/tabela`, params);
}

// "AAAA-MM-DD" de hoje menos `dias`, no fuso do navegador — a mesma janela de
// marts.ocorrencias_organograma (data_recebimento >= current_date - 30).
export function diaMenos(dias) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Total, últimos 30 e últimos 7 dias (quadro da página do indicador).
export function totaisOcorrencias(ocorrencias) {
  const d30 = diaMenos(30);
  const d7 = diaMenos(7);
  let primeiro = null;
  let n30 = 0;
  let n7 = 0;
  ocorrencias.forEach((o) => {
    const dia = o.data ? o.data.slice(0, 10) : null;
    if (!dia) return;
    if (!primeiro || dia < primeiro) primeiro = dia;
    if (dia >= d30) n30 += 1;
    if (dia >= d7) n7 += 1;
  });
  return { total: ocorrencias.length, d30: n30, d7: n7, primeiro, de30: d30, de7: d7 };
}
