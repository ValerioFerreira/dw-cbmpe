import React, { useMemo, useState } from "react";
import { fmtNumero } from "@/lib/cbmpe";
import {
  filtrarPorEscopoOcorrencias, serieCampoOcorrencias, serieDiaria, passaMultiSelect,
} from "@/lib/ocorrenciasDashboard";
import { ordenarPorAntiguidadeOme } from "@/lib/antiguidadeOme";
import SectionCard from "@/components/ui/section-card";
import KpiCard from "@/components/ui/kpi-card";
import PanelGrafico from "@/components/charts/PanelGrafico";
import MultiSelectFiltro from "@/components/ui/multi-select-filtro";
import AguardandoCredencial from "./AguardandoCredencial";

const NATUREZA_ATIVIDADE_COMUNITARIA = "Atividade Comunitária";

// Aba "Atividade Comunitária" (9ª de 9) — não existia no protótipo do Igor
// nem na integração original das 8 abas, apesar de status_ocorrencias.md
// (linha ~107-108) confirmar que é uma das 6 naturezas EXATAS de
// roe_basico_ocorrencias (query de "Visão Geral — Natureza"). Não existe
// (e não foi inventada) uma roe_atividade_comunitaria_ocorrencias — o
// DW_CATALOGO_FONTES.md só lista tabelas de detalhe para APH/Incêndio/
// Salvamento/Produtos Perigosos/Prevenção. Por isso esta aba fica só com o
// que é reconstruível a partir de roe_basico_ocorrencias — mesmo "nível
// básico" que Incêndio/Salvamento já têm antes de entrar no detalhe
// específico deles (Finalizadas/Aguardando finalização), mais os cards que
// APH (Cidade/Subgrupo) e Visão Geral (Grupo)/Salvamento (Ocorrências
// diárias) já provam serem reconstruíveis do mesmo grão sem tabela de
// detalhe. Diferente de ModuloAph.jsx, aqui "Subgrupo" NÃO exclui
// "Outro"/"Diversos" — essa exclusão foi uma decisão específica confirmada
// por Igor para a aba APH, sem equivalente documentado para Atividade
// Comunitária, então não é reproduzida por suposição.
export default function ModuloAtividadeComunitaria({ ocorrencias, permitidas, bloqueado }) {
  const [omes, setOmes] = useState(new Set());
  const doEscopo = useMemo(() => filtrarPorEscopoOcorrencias(ocorrencias, permitidas), [ocorrencias, permitidas]);
  const todasOmes = useMemo(() => ordenarPorAntiguidadeOme([...new Set(doEscopo.map((o) => o.ome).filter(Boolean))]), [doEscopo]);
  const filtrados = useMemo(
    () => doEscopo.filter((o) => o.natureza === NATUREZA_ATIVIDADE_COMUNITARIA && passaMultiSelect(o.ome, omes)),
    [doEscopo, omes]
  );
  const finalizadas = useMemo(() => filtrados.filter((o) => o.finalizado), [filtrados]);
  const aguardando = useMemo(() => filtrados.filter((o) => !o.finalizado), [filtrados]);
  const diaria = useMemo(() => serieDiaria(filtrados), [filtrados]);

  const porCidade = useMemo(() => serieCampoOcorrencias(finalizadas, "cidade").slice(0, 5), [finalizadas]);
  const porSubgrupo = useMemo(() => serieCampoOcorrencias(finalizadas, "subgrupo").slice(0, 5), [finalizadas]);
  const porGrupo = useMemo(() => serieCampoOcorrencias(finalizadas, "grupo").slice(0, 5), [finalizadas]);

  if (bloqueado) return <AguardandoCredencial />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <MultiSelectFiltro label="OME" valores={todasOmes} selecionado={omes} onChange={setOmes} />
        {omes.size > 0 && (
          <button onClick={() => setOmes(new Set())} className="text-[12px] font-medium text-muted-foreground hover:text-foreground">
            Limpar filtros
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard nome="Finalizadas" valor={fmtNumero(finalizadas.length)} destaque />
        <KpiCard nome="Aguardando finalização" valor={fmtNumero(aguardando.length)} />
      </div>

      <SectionCard titulo="Ocorrências diárias">
        <PanelGrafico tipo="line" curva="linear" data={diaria} xKey="label" yKeys={["valor"]} altura={280} anguloEixoX={-60} alturaEixoX={70} fontEixoX={8} />
      </SectionCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard titulo="Cidade" subtitulo="Top 5">
          <PanelGrafico tipo="hbar" data={porCidade} xKey="label" yKeys={["valor"]} altura={220} />
        </SectionCard>
        <SectionCard titulo="Subgrupo" subtitulo="Top 5">
          <PanelGrafico tipo="hbar" data={porSubgrupo} xKey="label" yKeys={["valor"]} altura={220} />
        </SectionCard>
      </div>

      <SectionCard titulo="Grupo" subtitulo="Top 5">
        <PanelGrafico tipo="hbar" data={porGrupo} xKey="label" yKeys={["valor"]} altura={240} />
      </SectionCard>
    </div>
  );
}
