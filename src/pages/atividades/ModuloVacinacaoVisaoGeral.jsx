import React, { useMemo, useState } from "react";
import { Syringe } from "lucide-react";
import { fmtNumero } from "@/lib/cbmpe";
import { serieMensal, serieCampo, passaMultiSelect, mesesDisponiveis, filtrarPorPeriodo } from "@/lib/vacinacaoDashboard";
import { ordenarPorAntiguidadeOme } from "@/lib/antiguidadeOme";
import SectionCard from "@/components/ui/section-card";
import KpiCard from "@/components/ui/kpi-card";
import PanelGrafico from "@/components/charts/PanelGrafico";
import MultiSelectFiltro from "@/components/ui/multi-select-filtro";
import EmptyState from "@/components/ui/empty-state";

// Aba "Visão Geral" do Dashboard de Vacinações — 1º de 4 módulos (mesma
// divisão de abas do protótipo do Igor, ver dashboards/das.zip e
// scratchpad/pacotes/das/status_dashboard_vacinacoes.md). Painel exclusivo
// da DAS (checagem de unidade replicada em cada módulo da aba, mesmo
// padrão de escopoTotal em ModuloDespesasDiversas.jsx).
//
// "Vacinações mensais" era um quadrante bloqueado no protótipo (o print só
// mostrava a FORMA da curva, sem valor por mês) — desbloqueado agora que
// há dado por evento real (ver DW_PLANEJAMENTO.md, 2026-09-21).
export default function ModuloVacinacaoVisaoGeral({ eventos, unidade }) {
  const [omes, setOmes] = useState(new Set());
  const [campanhas, setCampanhas] = useState(new Set());
  const [vacinas, setVacinas] = useState(new Set());
  const [mesInicio, setMesInicio] = useState("");
  const [mesFim, setMesFim] = useState("");

  const todasOmes = useMemo(() => ordenarPorAntiguidadeOme(serieCampo(eventos, "ome").map((s) => s.label)), [eventos]);
  const todasCampanhas = useMemo(() => serieCampo(eventos, "campanha").map((s) => s.label), [eventos]);
  const todasVacinas = useMemo(() => serieCampo(eventos, "vacina").map((s) => s.label), [eventos]);
  const periodo = useMemo(() => mesesDisponiveis(eventos), [eventos]);

  const filtrados = useMemo(() => {
    const porFiltroSimples = eventos.filter((e) =>
      passaMultiSelect(e.ome, omes) && passaMultiSelect(e.campanha, campanhas) && passaMultiSelect(e.vacina, vacinas)
    );
    return filtrarPorPeriodo(porFiltroSimples, mesInicio, mesFim);
  }, [eventos, omes, campanhas, vacinas, mesInicio, mesFim]);

  const filtroAtivo = omes.size > 0 || campanhas.size > 0 || vacinas.size > 0 || mesInicio || mesFim;

  const totalCampanhas = useMemo(() => new Set(filtrados.map((e) => e.campanha)).size, [filtrados]);
  const porCampanha = useMemo(() => serieCampo(filtrados, "campanha"), [filtrados]);
  const porOme = useMemo(() => serieCampo(filtrados, "ome"), [filtrados]);
  const porVacina = useMemo(() => serieCampo(filtrados, "vacina"), [filtrados]);
  const mensal = useMemo(() => serieMensal(filtrados), [filtrados]);

  // "Total de aplicações por OME" tem quase 3x mais categorias que "Vacinas
  // mais aplicadas" (51 OMEs vs. ~20 vacinas) — pedido do usuário: os dois
  // gráficos ficam com a MESMA altura visível (a de "Vacinas mais
  // aplicadas", que é menor), e o de OME ganha rolagem vertical interna em
  // vez de esticar o card.
  const alturaCompartilhadaOmeVacina = Math.max(400, porVacina.length * 28);

  if (unidade?.sigla !== "DAS") {
    return (
      <EmptyState
        icon={Syringe}
        titulo="Disponível apenas na Diretoria de Assistência Social"
        descricao="O Dashboard de Vacinações é um painel próprio da DAS — não é filtrado por unidade, então só aparece ao visualizar a DAS (ou, por herança de acesso, para quem tem visibilidade sobre ela)."
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <MultiSelectFiltro label="OME" valores={todasOmes} selecionado={omes} onChange={setOmes} />
        <MultiSelectFiltro label="Campanha" valores={todasCampanhas} selecionado={campanhas} onChange={setCampanhas} />
        <MultiSelectFiltro label="Vacina" valores={todasVacinas} selecionado={vacinas} onChange={setVacinas} />
        <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          Período
          <select value={mesInicio} onChange={(e) => setMesInicio(e.target.value)} className="rounded-lg border border-border bg-card px-2 py-1.5 text-[12px] font-medium text-foreground">
            <option value="">Início</option>
            {periodo.map((m) => <option key={m.chave} value={m.chave}>{m.label}</option>)}
          </select>
          <span className="text-muted-foreground">–</span>
          <select value={mesFim} onChange={(e) => setMesFim(e.target.value)} className="rounded-lg border border-border bg-card px-2 py-1.5 text-[12px] font-medium text-foreground">
            <option value="">Fim</option>
            {periodo.map((m) => <option key={m.chave} value={m.chave}>{m.label}</option>)}
          </select>
        </label>
        {filtroAtivo && (
          <button
            onClick={() => { setOmes(new Set()); setCampanhas(new Set()); setVacinas(new Set()); setMesInicio(""); setMesFim(""); }}
            className="text-[12px] font-medium text-muted-foreground hover:text-foreground"
          >
            Limpar filtros
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard nome="Total de vacinas aplicadas" valor={fmtNumero(filtrados.length)} destaque />
        <KpiCard nome="Total de campanhas efetuadas" valor={fmtNumero(totalCampanhas)} />
      </div>

      <SectionCard titulo="Vacinas aplicadas por campanha">
        <PanelGrafico tipo="bar" data={porCampanha} xKey="label" yKeys={["valor"]} altura={320} anguloEixoX={-35} alturaEixoX={90} />
      </SectionCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <SectionCard titulo="Total de aplicações por OME">
          <div style={{ height: alturaCompartilhadaOmeVacina }} className="overflow-y-auto pr-1">
            <PanelGrafico tipo="hbar" data={porOme} xKey="label" yKeys={["valor"]} altura={Math.max(alturaCompartilhadaOmeVacina, porOme.length * 24)} />
          </div>
        </SectionCard>
        <SectionCard titulo="Vacinas mais aplicadas">
          <PanelGrafico tipo="hbar" data={porVacina} xKey="label" yKeys={["valor"]} altura={alturaCompartilhadaOmeVacina} />
        </SectionCard>
      </div>

      <SectionCard titulo="Vacinações mensais">
        <PanelGrafico tipo="line" curva="linear" data={mensal} xKey="label" yKeys={["valor"]} altura={300} anguloEixoX={-60} alturaEixoX={80} fontEixoX={9} paddingEixoX={{ left: 16, right: 16 }} />
      </SectionCard>
    </div>
  );
}
