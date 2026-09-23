import React, { useMemo } from "react";
import { filtrarPorEscopoOcorrencias } from "@/lib/ocorrenciasDashboard";
import SectionCard from "@/components/ui/section-card";
import DonutChart from "@/components/charts/DonutChart";
import AguardandoCredencial from "./AguardandoCredencial";
import CardPendente from "./CardPendente";

// Aba "Perfil de vítimas" (8ª de 8, dado de saúde — LGPD art. 11) —
// status_ocorrencias.md: 🟢 confirmed nos 5 quadrantes, incluindo "Divisão
// por gênero" (renomeado de "...- Duplicar" em 2026-09-09) e "Vítimas com
// deficiência" (reusa o modelo "Dados para estatística - APH", mesmo join
// de aphEstatistica na aba APH). Só "Vítimas com deficiência" é
// reconstruível aqui com o que foi confirmado por Igor em texto — gênero e
// faixa etária dependem de nomes de coluna que NENHUM SQL recebido citou
// (ver TODO em extract_dashboard_ocorrencias.py/extrair_aph_estatistica).
//
// Minimização LGPD: `aphEstatistica` nunca carrega nome, CPF ou protocolo
// de vítima — só os campos já agregáveis (cvi/entregueVivo/deficiencia),
// mesma regra do extrator de Vacinação.
export default function ModuloPerfilVitimas({ aphEstatistica, permitidas, bloqueado, pendencias }) {
  const doEscopo = useMemo(() => filtrarPorEscopoOcorrencias(aphEstatistica, permitidas), [aphEstatistica, permitidas]);
  const porDeficiencia = useMemo(() => {
    const m = new Map();
    doEscopo.forEach((a) => {
      if (a.deficiencia == null) return;
      const label = a.deficiencia ? "Com deficiência" : "Sem deficiência";
      m.set(label, (m.get(label) || 0) + 1);
    });
    return [...m.entries()].map(([label, valor]) => ({ label, valor }));
  }, [doEscopo]);

  if (bloqueado) return <AguardandoCredencial />;

  return (
    <div className="space-y-5">
      <SectionCard titulo="Vítimas com deficiência">
        {porDeficiencia.length > 0 ? (
          <DonutChart data={porDeficiencia} rotuloTotal="Vítimas" altura={200} />
        ) : (
          <CardPendente
            titulo="Sem registros com o campo preenchido"
            motivo="Coluna roe_aph_ocorrencias.deficiencia extraída, mas nenhuma linha do escopo atual tem valor — ou a chave de join (ver docstring do extrator) não está correta ainda."
          />
        )}
      </SectionCard>

      <SectionCard titulo="Divisão por gênero, faixa etária e demais quadrantes">
        <CardPendente titulo="Aguardando SQL/schema" motivo={pendencias?.perfil_vitimas_sexo_idade} />
      </SectionCard>
    </div>
  );
}
