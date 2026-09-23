import { getSubordinados } from "@/lib/cbmpe";
import { MODULOS_ATIVIDADES_DASHBOARD } from "@/lib/mapaForca";
import { MODULOS_VACINACAO_DASHBOARD } from "@/lib/vacinacaoDashboard";
import { MODULOS_OCORRENCIAS_DASHBOARD } from "@/lib/ocorrenciasDashboard";

// Agrupamento por família do indicador "Atividades Específicas" — fonte
// única de verdade usada tanto pela grade de balões (Indicador.jsx) quanto
// pela barra de abas do dashboard (AtividadesDashboard.jsx), pra que as duas
// nunca fiquem inconsistentes entre si.
//
// Movido pra cá (2026-09-23) porque Mapa de Força passou a precisar do mesmo
// cálculo de "subárvore da DGO" que Ocorrências já tinha em
// ocorrenciasDashboard.js — duas famílias usando a mesma regra é o sinal de
// que ela deixou de ser específica de um domínio só.
export function subarvoreDgo(unidades) {
  const dgo = unidades.find((u) => u.sigla === "DGO");
  if (!dgo) return new Set();
  return new Set(["DGO", ...getSubordinados(unidades, dgo.id).map((u) => u.sigla)]);
}

export function estaNaSubarvoreDgo(unidade, unidades) {
  if (!unidade) return false;
  return subarvoreDgo(unidades).has(unidade.sigla);
}

// Cada família diz: quais módulos ela agrupa, e sob qual `escopo` (função de
// unidade → bool) o BALÃO da família aparece na grade de Indicador.jsx.
//
// `escopo` é avaliado sobre a unidade cujo indicador está sendo visto — não
// sobre a unidade do usuário logado. Não há herança pro superior: se a
// unidade vista não está no escopo, o balão simplesmente não aparece nessa
// página, mesmo que o usuário tenha permissão de navegar até uma unidade
// subordinada onde ele apareceria (ex.: Subcomando Geral não vê o balão de
// Ocorrências na própria página, mas vê ao navegar até a DGO).
//
// `restricao` é opcional: quando presente, AtividadesDashboard.jsx usa o
// texto pra mostrar um EmptyState de escopo ao abrir um módulo da família
// fora dele (deep link direto). Vacinação não tem `restricao` aqui porque
// cada um dos 4 módulos já resolve o próprio EmptyState internamente (ver
// ModuloVacinacaoVisaoGeral.jsx e as outras 3 abas) — duplicar a mensagem
// aqui não teria efeito prático (o gate interno roda primeiro).
export const FAMILIAS_ATIVIDADES = [
  {
    id: "mapa-forca",
    nome: "Mapa de Força",
    modulos: MODULOS_ATIVIDADES_DASHBOARD,
    escopo: (unidade, unidades) => estaNaSubarvoreDgo(unidade, unidades),
    restricao: {
      titulo: "Disponível apenas na DGO e sua subárvore",
      descricao: "O Dashboard de Mapa de Força fica sob tutela da Diretoria Geral de Operações (DGO) — DIM, DINTER I, DINTER II, DIESP e os batalhões/CATs abaixo delas. Fora dessa cadeia, esta aba não se aplica.",
    },
  },
  {
    id: "vacinacao",
    nome: "Vacinação",
    modulos: MODULOS_VACINACAO_DASHBOARD,
    escopo: (unidade) => unidade?.sigla === "DAS",
  },
  {
    id: "ocorrencias",
    nome: "Ocorrências",
    modulos: MODULOS_OCORRENCIAS_DASHBOARD,
    // Igual Mapa de Força, mas excluindo a DIESP (pedido explícito do
    // usuário, 2026-09-23): DIESP continua com acesso a Mapa de Força, só
    // perde Ocorrências.
    escopo: (unidade, unidades) => estaNaSubarvoreDgo(unidade, unidades) && unidade?.sigla !== "DIESP",
    restricao: {
      titulo: "Disponível apenas na DGO e sua subárvore",
      descricao: "O Dashboard de Ocorrências fica sob tutela da Diretoria Geral de Operações (DGO) — DIM, DINTER I, DINTER II e os batalhões/CATs abaixo delas (a DIESP tem acesso ao Mapa de Força, mas não a Ocorrências). Fora dessa cadeia, esta aba não se aplica.",
    },
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
