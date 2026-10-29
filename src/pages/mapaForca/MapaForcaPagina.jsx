import React from "react";
import { useParams, Link } from "react-router-dom";
import { BarChart3, ShieldAlert } from "lucide-react";
import EmptyState from "@/components/ui/empty-state";
import CabecalhoPainel from "@/components/layout/CabecalhoPainel";
import { usePainelOperacional } from "@/lib/usePainelOperacional";
import ModuloMapaForca from "@/pages/atividades/ModuloMapaForca";

// Mapa de Força como indicador próprio (2026-10-29; antes uma família de
// Atividades Específicas). /mapa-forca/:id — `id` é o indicador "Mapa de Força"
// da unidade (recorte pela unidade e subordinadas) ou "geral" (a corporação
// inteira, pelo atalho do "CBMPE - Geral"). O módulo é o mesmo de antes.
export default function MapaForcaPagina() {
  const { id } = useParams();
  const ctx = usePainelOperacional(id, "Mapa de Força");

  if (ctx.loading && !ctx.encontrado) return <div className="h-96 animate-pulse rounded-xl bg-muted/40" />;

  if (!ctx.encontrado) {
    return (
      <EmptyState
        icon={BarChart3}
        titulo="Painel não encontrado"
        acao={<Link to="/organograma" className="text-[13px] font-medium text-primary hover:underline">Voltar ao organograma</Link>}
      />
    );
  }

  if (!ctx.permitido) {
    return (
      <EmptyState
        icon={ShieldAlert}
        titulo="Acesso restrito"
        descricao="Seu usuário não tem permissão para ver o Mapa de Força desta unidade. A visão da corporação inteira fica no atalho do CBMPE - Geral, no organograma."
        acao={<Link to="/organograma" className="text-[13px] font-medium text-primary hover:underline">Voltar ao organograma</Link>}
      />
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <CabecalhoPainel
        geral={ctx.geral}
        caminho={ctx.caminho}
        trilha={[{ rotulo: "Mapa de Força" }]}
        titulo="Mapa de Força"
        subtitulo={ctx.subtitulo}
        voltarPara={ctx.geral ? "/organograma" : `/diretoria/${ctx.unidade?.id}`}
      />
      <ModuloMapaForca permitidas={ctx.permitidas} unidade={ctx.unidade} />
    </div>
  );
}
