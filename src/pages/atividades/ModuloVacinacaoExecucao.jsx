import React, { useMemo, useState } from "react";
import { Syringe } from "lucide-react";
import { serieCampo } from "@/lib/vacinacaoDashboard";
import SectionCard from "@/components/ui/section-card";
import PanelGrafico from "@/components/charts/PanelGrafico";
import DonutChart from "@/components/charts/DonutChart";
import EmptyState from "@/components/ui/empty-state";
import MultiSelectFiltro from "@/components/ui/multi-select-filtro";
import FiltroPeriodoDatas, { PERIODO_VAZIO } from "@/components/ui/filtro-periodo-datas";
import { passaMultiSelect, passaPeriodo, limitesDeData } from "@/lib/dashboardHelpers";

// Aba "Execução e Logística" do Dashboard de Vacinações — 2º de 3 módulos
// (ver ModuloVacinacaoVisaoGeral.jsx para o racional do painel exclusivo
// da DAS, sem filtro por unidade).
//
// 9 categorias (8 marcas + "sem marca") — mais que a paleta padrão de 5
// cores do DonutChart (pensada para 2-5 fatias), então aqui a paleta é
// passada explícita com as 6 cores de dado disponíveis (--chart-5 incluída,
// não usada em nenhum outro donut do app) pra reduzir repetição de cor.
const PALETA_MARCAS = [
  "hsl(var(--primary))", "hsl(var(--muted-foreground))", "hsl(var(--accent))",
  "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))",
];

// Diferente do protótipo (que mostrava só top7/top5 por limitação do
// print do Metabase), aqui os 3 quadrantes trazem a distribuição COMPLETA
// — mesma decisão já tomada em Efetivo/Finanças de tirar recortes fixos
// quando o dado real permite o total (ver DW_PLANEJAMENTO.md, 2026-09-21).
export default function ModuloVacinacaoExecucao({ eventos: todosEventos, unidade }) {
  const [omes, setOmes] = useState(new Set());
  const [campanhas, setCampanhas] = useState(new Set());
  const [vacinas, setVacinas] = useState(new Set());
  const [periodo, setPeriodo] = useState(PERIODO_VAZIO);
  const opcoes = useMemo(() => {
    const unicos = (campo) => [...new Set(todosEventos.map((e) => e[campo]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "pt-BR"));
    return { omes: unicos("ome"), campanhas: unicos("campanha"), vacinas: unicos("vacina") };
  }, [todosEventos]);
  const limites = useMemo(() => limitesDeData(todosEventos), [todosEventos]);
  const eventos = useMemo(
    () => todosEventos.filter((e) => passaMultiSelect(e.ome, omes) && passaMultiSelect(e.campanha, campanhas)
      && passaMultiSelect(e.vacina, vacinas) && passaPeriodo(e.data, periodo)),
    [todosEventos, omes, campanhas, vacinas, periodo]
  );
  const filtroAtivo = omes.size + campanhas.size + vacinas.size > 0 || !!periodo.de || !!periodo.ate;
  const limpar = () => { setOmes(new Set()); setCampanhas(new Set()); setVacinas(new Set()); setPeriodo(PERIODO_VAZIO); };

  const porPosto = useMemo(() => serieCampo(eventos, "posto"), [eventos]);
  const porAplicador = useMemo(() => serieCampo(eventos, "aplicador"), [eventos]);
  const porMarca = useMemo(() => serieCampo(eventos, "marca", { rotuloNulo: "Sem marca registrada" }), [eventos]);

  // Postos e aplicadores lado a lado ficam com a MESMA altura — pedido do
  // usuário — a maior das duas contagens decide (hoje aplicadores, 23 vs.
  // 19 postos).
  const alturaCompartilhadaPostoAplicador = Math.max(320, porPosto.length * 26, porAplicador.length * 26);

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
        <MultiSelectFiltro label="OME" valores={opcoes.omes} selecionado={omes} onChange={setOmes} />
        <MultiSelectFiltro label="Campanha" valores={opcoes.campanhas} selecionado={campanhas} onChange={setCampanhas} />
        <MultiSelectFiltro label="Vacina" valores={opcoes.vacinas} selecionado={vacinas} onChange={setVacinas} />
        <FiltroPeriodoDatas valor={periodo} onChange={setPeriodo} min={limites.min} max={limites.max} />
        {filtroAtivo && (
          <button onClick={limpar} className="text-[12px] font-medium text-muted-foreground hover:text-foreground">Limpar filtros</button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <SectionCard titulo="Postos de vacinação com maior número de aplicações">
          <PanelGrafico tipo="hbar" data={porPosto} xKey="label" yKeys={["valor"]} altura={alturaCompartilhadaPostoAplicador} />
        </SectionCard>
        <SectionCard titulo="Profissionais com maior número de aplicações">
          <PanelGrafico tipo="hbar" data={porAplicador} xKey="label" yKeys={["valor"]} altura={alturaCompartilhadaPostoAplicador} />
        </SectionCard>
      </div>

      {/* max-w-md no CARD inteiro (não só no conteúdo): sem isso o card
          ficava com a largura cheia da grade acima, com o donut pequeno
          "boiando" no meio de muito fundo branco — pedido do usuário. */}
      <div className="mx-auto max-w-md">
        <SectionCard titulo="Representatividade das marcas">
          <DonutChart data={porMarca} rotuloTotal="Aplicações" altura={220} cores={PALETA_MARCAS} />
        </SectionCard>
      </div>
    </div>
  );
}
