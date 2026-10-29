import { MODULOS_VACINACAO_DASHBOARD } from "@/lib/vacinacaoDashboard";

// Agrupamento por família do indicador "Atividades Específicas" — fonte
// única de verdade usada tanto pela grade de balões (Indicador.jsx) quanto
// pela barra de abas do dashboard (AtividadesDashboard.jsx), pra que as duas
// nunca fiquem inconsistentes entre si.
//
// Mapa de Força e Ocorrências eram famílias daqui até 2026-10-29, quando viraram
// indicadores próprios na página da unidade (ver ESCOPO_INDICADOR_OPERACIONAL em
// src/data/organograma.js, que guarda a regra de escopo da cadeia da DGO, e as
// páginas src/pages/mapaForca/ e src/pages/ocorrencias/). As URLs antigas
// (/atividades/:id/dashboard/mapa-forca e ocorrencias-*) redirecionam para as
// novas em AtividadesDashboard.jsx.
//
// Cada família diz: quais módulos ela agrupa, e sob qual `escopo` (função de
// unidade → bool) o BALÃO da família aparece na grade de Indicador.jsx.
//
// `escopo` é avaliado sobre a unidade cujo indicador está sendo visto — não
// sobre a unidade do usuário logado. Não há herança pro superior: se a
// unidade vista não está no escopo, o balão simplesmente não aparece nessa
// página.
//
// Vacinação não tem `restricao`: cada um dos 4 módulos já resolve o próprio
// EmptyState internamente (ver ModuloVacinacaoVisaoGeral.jsx e as outras 3 abas).
export const FAMILIAS_ATIVIDADES = [
  {
    id: "vacinacao",
    nome: "Vacinação",
    modulos: MODULOS_VACINACAO_DASHBOARD,
    escopo: (unidade) => unidade?.sigla === "DAS",
  },
];

export const TODOS_MODULOS_ATIVIDADES = FAMILIAS_ATIVIDADES.flatMap((f) => f.modulos);

export function familiaDoModulo(key) {
  return FAMILIAS_ATIVIDADES.find((f) => f.modulos.some((m) => m.key === key));
}

// Famílias cujo balão aparece na grade de "Atividades Específicas" da
// unidade dada — ver nota de `escopo` acima sobre a regra de "sem herança".
export function familiasVisiveis(unidade, unidades) {
  return FAMILIAS_ATIVIDADES.filter((f) => f.escopo(unidade, unidades));
}
