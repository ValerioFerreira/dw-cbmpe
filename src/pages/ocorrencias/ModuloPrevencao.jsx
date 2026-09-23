import React from "react";
import SectionCard from "@/components/ui/section-card";
import AguardandoCredencial from "./AguardandoCredencial";
import CardPendente from "./CardPendente";

// Aba "Prevenção" (5ª de 8) — a única aba cuja fonte NÃO é
// roe_basico_ocorrencias: status_ocorrencias.md é explícito ("Tabela-fonte
// diferente: public.roe_prevencao_ocorrencias") e essa aba "não tem filtro
// nenhum" no Metabase original (decisão de 2026-09-16, os 4 filtros que
// estavam no protótipo por suposição foram removidos de lá). Como
// roe_prevencao_ocorrencias não tem NENHUMA coluna verificada
// (DW_CATALOGO_FONTES.md) e o extrator só lê roe_basico_ocorrencias, esta
// aba inteira fica pendente — nada aqui vem de `ocorrencias`
// (deliberadamente: misturar um card desta aba com o grão de outra tabela
// seria inventar um join que não existe).
export default function ModuloPrevencao({ bloqueado, pendencias }) {
  if (bloqueado) return <AguardandoCredencial />;

  return (
    <div className="space-y-5">
      <SectionCard
        titulo="Prevenção"
        subtitulo="Duração média, Público estimado x presente, Situação dos AVCBs (🟢 confirmed) e Área média dos eventos (🔴 print) — status_ocorrencias.md"
      >
        <CardPendente titulo="Aguardando SQL/schema de roe_prevencao_ocorrencias" motivo={pendencias?.prevencao_todos_os_cards} />
      </SectionCard>
    </div>
  );
}
