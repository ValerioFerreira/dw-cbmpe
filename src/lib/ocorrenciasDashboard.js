import { groupCount, paraSerie, siglasPermitidas } from "@/lib/dashboardHelpers";

export { groupCount, paraSerie, passaMultiSelect, siglasPermitidas } from "@/lib/dashboardHelpers";
export { serieMensal } from "@/lib/vacinacaoDashboard";

// Helpers do "Dashboard de Ocorrencias" (protótipo de Igor, ver
// dashboards/08-ocorrencias/) - DIFERENTE de Vacinacao (painel exclusivo da
// DAS, sem filtro de unidade): Ocorrencias fica sob tutela geral da DGO e
// disponivel em toda a sua subarvore (DIM/DINTER I/DINTER II/DIESP e os
// batalhoes/CATs abaixo delas), filtrado por OME igual Efetivo/Viaturas/
// Financas - mesmo mecanismo `siglasPermitidas` (unidade + subordinadas),
// reexportado aqui em vez de reinventado (pedido explicito do usuario).
//
// Fonte real: etl/ocorrencias/extract_dashboard_ocorrencias.py, lendo
// roe_basico_ocorrencias direto do Postgres `roe_api_production`
// (10.193.1.252:15432) - BLOQUEADO por credencial ainda (ver
// DW_CATALOGO_FONTES.md). src/data/real/ocorrencias_dashboard.json fica
// vazio ate isso ser resolvido - nunca preencher com dado inventado.

export const MODULOS_OCORRENCIAS_DASHBOARD = [
  { n: 1, key: "ocorrencias-visao-geral", nome: "Ocorrências — Visão Geral" },
  { n: 2, key: "ocorrencias-aph", nome: "Ocorrências — APH" },
  { n: 3, key: "ocorrencias-incendio", nome: "Ocorrências — Incêndio" },
  { n: 4, key: "ocorrencias-salvamento", nome: "Ocorrências — Salvamento" },
  { n: 5, key: "ocorrencias-prevencao", nome: "Ocorrências — Prevenção" },
  { n: 6, key: "ocorrencias-produtos-perigosos", nome: "Ocorrências — Produtos Perigosos" },
  { n: 7, key: "ocorrencias-geolocalizacao", nome: "Ocorrências — Geolocalização" },
  { n: 8, key: "ocorrencias-perfil-vitimas", nome: "Ocorrências — Perfil de Vítimas" },
  { n: 9, key: "ocorrencias-atividade-comunitaria", nome: "Ocorrências — Atividade Comunitária" },
];

// A checagem de escopo por subárvore da DGO (e a exclusão da DIESP) mora em
// atividadesEspecificas.js — Mapa de Força usa o mesmo cálculo, então não
// duplicar aqui (ver FAMILIAS_ATIVIDADES/estaNaSubarvoreDgo lá).

// Restringe `ocorrencias`/`aphEstatistica` (campo `ome`) as siglas
// permitidas - mesmo principio de filtrarPorEscopoFinancas, mas mantendo o
// nome do dominio (evita import cruzado desnecessario entre paineis).
export function filtrarPorEscopoOcorrencias(registros, permitidas) {
  return registros.filter((r) => permitidas.has(r.ome));
}

// "Situacao das vitimas" (aba APH): soma as 4 colunas de vitima.
// `corrigido=false` (default) reproduz o comportamento REAL do Metabase
// hoje - bug de WHERE documentado em status_ocorrencias.md: o filtro
// `status_relatorio = 'Finalizado'` só se aplica ao ramo "Desaparecidas" do
// UNION ALL original, "Feridas"/"Fatais"/"Ilesas" somam a tabela inteira.
// `corrigido=true` aplica o filtro nas 4 partes (o WHERE reescrito). Os
// dois ficam expostos lado a lado no card, um não escondendo o outro -
// decisão pendente com Igor sobre qual vira o número oficial (ver
// PENDENCIAS-PAINEIS-CORPORATIVOS.md, pergunta 2).
export function situacaoVitimas(ocorrencias, { corrigido = false } = {}) {
  const finalizadas = ocorrencias.filter((o) => o.finalizado);
  const feridasBase = corrigido ? finalizadas : ocorrencias;
  const fataisBase = corrigido ? finalizadas : ocorrencias;
  const ilesasBase = corrigido ? finalizadas : ocorrencias;
  return [
    { label: "Feridas", valor: feridasBase.reduce((a, o) => a + (o.vitimasFeridas || 0), 0) },
    { label: "Fatais", valor: fataisBase.reduce((a, o) => a + (o.vitimasFatais || 0), 0) },
    { label: "Ilesas", valor: ilesasBase.reduce((a, o) => a + (o.vitimasIlesas || 0), 0) },
    { label: "Desaparecidas", valor: finalizadas.reduce((a, o) => a + (o.vitimasDesaparecidas || 0), 0) },
  ];
}

// Série {label, valor} desc a partir de um campo categórico, ignorando
// registros sem valor no campo (mesmo padrão de serieCampo em
// vacinacaoDashboard.js, reimplementado aqui só pra não acoplar os dois
// domínios por um helper de 3 linhas).
export function serieCampoOcorrencias(ocorrencias, campo, { rotuloNulo } = {}) {
  const base = rotuloNulo ? ocorrencias : ocorrencias.filter((o) => o[campo]);
  return paraSerie(groupCount(base, (o) => o[campo] || rotuloNulo));
}

// Faixa etária de vítima (aba Perfil de Vítimas) — bucket feito aqui (não
// veio pronto de nenhum SQL de Igor) a partir de `idade`/`idadeEmMeses`
// crus do extrator. `idadeEmMeses=true` já é sinal de bebê (<1 ano) direto
// da origem, não precisa de limiar arbitrário.
export function faixaEtaria(idade, idadeEmMeses) {
  if (idadeEmMeses) return "Menor de 1 ano";
  if (idade == null) return null;
  if (idade < 12) return "0 a 11 anos";
  if (idade < 18) return "12 a 17 anos";
  if (idade < 30) return "18 a 29 anos";
  if (idade < 45) return "30 a 44 anos";
  if (idade < 60) return "45 a 59 anos";
  return "60 anos ou mais";
}

export const ORDEM_FAIXA_ETARIA = [
  "Menor de 1 ano", "0 a 11 anos", "12 a 17 anos", "18 a 29 anos", "30 a 44 anos", "45 a 59 anos", "60 anos ou mais",
];

// Série cronológica por DIA (chave "AAAA-MM-DD"), não por mês — usada em
// "Ocorrências diárias" (aba Salvamento), o único card diário confirmado
// por CSV em status_ocorrencias.md (236 dias, soma = Finalizadas +
// Aguardando finalização). Todo o resto do painel usa granularidade
// mensal (serieMensal, reexportado de vacinacaoDashboard.js).
export function serieDiaria(ocorrencias) {
  const m = new Map();
  ocorrencias.forEach((o) => {
    if (!o.data) return;
    const chave = o.data.slice(0, 10);
    m.set(chave, (m.get(chave) || 0) + 1);
  });
  return Array.from(m.keys()).sort().map((chave) => ({ label: chave, valor: m.get(chave), chave }));
}
