// Protótipo de controle de acesso por níveis — cada usuário de "nível" enxerga
// o organograma inteiro, mas só interage com as unidades (e atalhos de KPI do
// topo) liberadas para ele. É um protótipo apenas de VISUALIZAÇÃO: bloqueia a
// navegação a partir dos cards do organograma, mas não guarda rotas (/diretoria/:id,
// /indicador/:id) — quem tiver o link direto ainda acessa a página de destino.
// Ver decisão em DW_PLANEJAMENTO.md (2026-08-17).
//
// Regra de senha (definida pelo usuário): USUARIO em maiúsculo + "@GSG".
//
// escopo por usuário:
// - subtree: siglas cuja árvore inteira (própria unidade + todos os
//   descendentes) fica liberada.
// - unidades: siglas liberadas só para o card em si (sem descendentes).
// - kpisTopo: nomes dos atalhos de KPI (Efetivo/Viaturas/Materiais/Finanças)
//   que ficam no topo do organograma, sob CBMPE - Geral.
// - total: acesso irrestrito a todos os cards e atalhos.
export const NIVEIS_ACESSO = {
  "4GB": { nome: "4º GB", subtree: ["4º GB"] },
  "DINTER2": { nome: "DINTER II", subtree: ["DINTER II"] },
  "DGO": { nome: "DGO", subtree: ["DGO"] },
  "DGP": { nome: "DGP", unidades: ["DGP"], kpisTopo: ["Efetivo"] },
  "AGGD": { nome: "AGGD", total: true },
};

export function senhaEsperada(usuarioChave) {
  return `${usuarioChave.toUpperCase()}@GSG`;
}

// getSubordinados vem de @/lib/cbmpe — passado por parâmetro pra não criar
// dependência circular (cbmpe.js não depende deste módulo).
export function calcularAcesso(usuarioChave, unidades, getSubordinados) {
  const cfg = NIVEIS_ACESSO[usuarioChave];
  if (!cfg) return { siglas: new Set(), kpisTopo: new Set(), total: false };
  if (cfg.total) return { siglas: null, kpisTopo: null, total: true };

  const siglas = new Set(cfg.unidades || []);
  const bySigla = {};
  unidades.forEach((u) => { bySigla[u.sigla] = u; });

  (cfg.subtree || []).forEach((sigla) => {
    siglas.add(sigla);
    const u = bySigla[sigla];
    if (u) getSubordinados(unidades, u.id).forEach((d) => siglas.add(d.sigla));
  });

  return { siglas, kpisTopo: new Set(cfg.kpisTopo || []), total: false };
}
