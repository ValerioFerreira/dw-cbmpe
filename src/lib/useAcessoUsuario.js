// Hook compartilhado do protótipo de níveis de acesso (ver
// @/lib/accessControl e DW_GOVERNANCA.md). Antes só existia checagem
// visual no organograma (cards esmaecidos); isso não impedia a navegação
// direta — clicando num link de breadcrumb, ou num atalho de KPI de uma
// unidade fora do escopo, o usuário via os dados normalmente. Este hook
// centraliza a mesma regra de acesso para ser reaplicada nas páginas de
// detalhe (Diretoria, Indicador, EfetivoDetalhe, Dashboard, Submódulo,
// Detalhamento), fechando essa brecha de navegação.
import { useMemo } from "react";
import { useAuth } from "./AuthContext";
import { useCbmpe } from "./cbmpe-context";
import { getSubordinados } from "./cbmpe";
import { calcularAcesso } from "./accessControl";

export function useAcessoUsuario() {
  const { user } = useAuth();
  const { unidades } = useCbmpe();

  const restrito = user?.role === "nivel";
  const acesso = useMemo(
    () => (restrito ? calcularAcesso(user.nivelAcesso, unidades, getSubordinados) : null),
    [restrito, user, unidades]
  );

  // true/false — já resolve o caso "sem restrição" (admin) como permitido.
  function permiteSigla(sigla) {
    if (!restrito) return true;
    if (!sigla) return false;
    if (acesso.total) return true;
    return acesso.siglas.has(sigla);
  }

  // Indicador (Efetivo/Viaturas/Materiais/Finanças) de uma unidade: permitido
  // se a unidade em si está liberada, OU se é um dos atalhos de KPI do topo
  // do organograma (hoje só COMANDO GERAL) liberados especificamente —
  // mesma regra usada em Organograma.jsx pros cards de atalho.
  function permiteIndicador(ind, unidadeSigla) {
    if (!restrito) return true;
    if (!ind) return false;
    if (permiteSigla(unidadeSigla)) return true;
    if (acesso.total) return true;
    return unidadeSigla === "COMANDO GERAL" && acesso.kpisTopo.has(ind.nome);
  }

  return { restrito, acesso, permiteSigla, permiteIndicador };
}
