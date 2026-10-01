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
  const { unidades, atribuicoes } = useCbmpe();

  const restrito = user?.role === "nivel";
  // `user.perfilAtivo` (2026-09-25, suporte a mais de um perfil por
  // usuário) — qual perfil está em uso nesta sessão, escolhido no Topbar
  // (ver AuthContext.jsx > setPerfilAtivo); sem escolha, calcularAcesso cai
  // no perfil principal sozinho.
  const acesso = useMemo(
    () => (restrito ? calcularAcesso(user.nivelAcesso, unidades, getSubordinados, atribuicoes, user.perfilAtivo) : null),
    [restrito, user, unidades, atribuicoes]
  );

  // true/false — já resolve o caso "sem restrição" (admin) como permitido.
  function permiteSigla(sigla) {
    if (!restrito) return true;
    if (!sigla) return false;
    if (acesso.total) return true;
    return acesso.siglas.has(sigla);
  }

  // Indicador (Efetivo/Viaturas/Materiais/Finanças) de uma unidade: liberado
  // se a unidade em si está liberada, OU se o indicador é um dos temáticos do
  // perfil — e aí vale em QUALQUER unidade, não só no card principal. É o que
  // distingue um diretor temático (a DGP vê o Efetivo de todo mundo) de um
  // titular (vê tudo da sua unidade e de nenhuma outra). Decisão de
  // 2026-08-24, ver @/lib/accessControl.
  function permiteIndicador(ind, unidadeSigla) {
    if (!restrito) return true;
    if (!ind) return false;
    if (acesso.total) return true;
    if (permiteSigla(unidadeSigla)) return true;
    return acesso.indicadores.has(ind.nome);
  }

  // Atalho de KPI do topo do organograma (card "CBMPE - Geral").
  function permiteKpiTopo(nome) {
    if (!restrito) return true;
    if (acesso.total) return true;
    return acesso.indicadores.has(nome);
  }

  const ehAdministrador = !restrito || !!acesso?.admin;

  // Seletor "LOB Atual/Nova" do organograma: Administrador, Comandante e
  // Subcomandante Geral (perfis de acesso total), e o login local AGGD.
  const podeVerLob = !restrito || !!acesso?.total;

  // Token pra rotas de escrita do backend (organograma, atribuições — ver
  // requireAdmin.js): só quando o PRÓPRIO perfil do usuário SGU é
  // ADMINISTRADOR — o backend revalida isso de qualquer forma, mas evitar
  // mandar o token à toa poupa uma chamada que vai dar 403. O login local
  // AGGD (role "admin", ver authClient.js) vê tudo mas não tem token — fica
  // só na visualização.
  const tokenAdmin = restrito && acesso?.admin ? user?.token : undefined;

  return { restrito, acesso, permiteSigla, permiteIndicador, permiteKpiTopo, ehAdministrador, podeVerLob, tokenAdmin };
}
