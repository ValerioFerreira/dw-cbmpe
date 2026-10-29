import { useMemo } from "react";
import { useCbmpe } from "@/lib/cbmpe-context";
import { useAcessoUsuario } from "@/lib/useAcessoUsuario";
import { getCaminho } from "@/lib/cbmpe";
import { siglasPermitidas, TODAS_AS_UNIDADES } from "@/lib/dashboardHelpers";

// Contexto das páginas de Mapa de Força e Ocorrências (indicadores próprios desde
// 2026-10-29). Duas formas de entrar:
//  - pelo card da unidade (`id` = id do indicador): recorte pela unidade vista e
//    subordinadas (siglasPermitidas), com a checagem de perfil de sempre;
//  - pelo atalho do "CBMPE - Geral" no organograma (`id` = "geral"): a corporação
//    inteira, para qualquer usuário logado ("todos podem ver tudo", decisão do
//    usuário) — o backend também entrega tudo a qualquer usuário logado.
export const ID_GERAL = "geral";

export function usePainelOperacional(id, nomeIndicador) {
  const { indicadores, unidades, porId, loading } = useCbmpe();
  const { permiteIndicador } = useAcessoUsuario();

  const geral = id === ID_GERAL;
  const ind = geral ? null : indicadores.find((i) => i.id === id && i.nome === nomeIndicador) || null;
  const unidade = ind ? porId[ind.unidade_id] : null;
  const caminho = ind ? getCaminho(unidades, ind.unidade_id) : [];
  const permitidas = useMemo(
    () => (geral ? TODAS_AS_UNIDADES : siglasPermitidas(unidade, unidades)),
    [geral, unidade, unidades]
  );

  // Valor do indicador: o da unidade, ou, na visão da corporação, o da DGO (a cadeia inteira
  // onde esses dois indicadores existem soma ali).
  const valor = geral ? indicadores.find((i) => i.nome === nomeIndicador && i.sigla === "DGO")?.valor ?? null : ind?.valor ?? null;

  return {
    geral,
    valor,
    ind,
    unidade,
    caminho,
    permitidas,
    loading,
    encontrado: geral || !!ind,
    permitido: geral || (!!ind && permiteIndicador(ind, unidade?.sigla)),
    subtitulo: geral ? "CBMPE - Geral · todas as unidades" : unidade?.nome,
  };
}
