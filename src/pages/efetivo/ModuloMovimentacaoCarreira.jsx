import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fmtNumero } from "@/lib/cbmpe";
import { linkEfetivoTabela } from "@/lib/efetivoDashboard";
import SectionCard from "@/components/ui/section-card";
import PanelGrafico from "@/components/charts/PanelGrafico";
import MultiSelectFiltro from "@/components/ui/multi-select-filtro";
import saidaPrevisao from "@/data/real/efetivo_dashboard/saida_previsao.json";

// Painel 07 do handoff — 4 de 6 quadrantes prontos (carreira_extra.json,
// população sem PII derivada de Militar.json) + 2 desbloqueados em
// 2026-08-19 com o SQL original do Metabase, executado contra o Postgres do
// data warehouse (ver etl/efetivo/extract_saida_previsao.py — fonte
// diferente: inativos_metabase / peculio_metabase_v1, população de
// inativos/projeção, não o efetivo ativo). Por isso "Saída de militares" e
// "Previsão de saída" não respondem aos filtros desta página (grão
// agregado, sem posto/OME) nem são clicáveis (população não bate 1:1 com a
// tabela de Efetivo ativo).
const TEMPO_SERVICO_BUCKETS = [
  { label: "0-5", min: 0, max: 5 },
  { label: "6-10", min: 6, max: 10 },
  { label: "11-15", min: 11, max: 15 },
  { label: "16-20", min: 16, max: 20 },
  { label: "21-25", min: 21, max: 25 },
  { label: "26-30", min: 26, max: 30 },
  { label: "31-35", min: 31, max: 35 },
];

function bucketTempoServico(anos) {
  const b = TEMPO_SERVICO_BUCKETS.find((x) => anos >= x.min && anos <= x.max);
  return b ? b.label : "31-35";
}

function paramsAtuais({ postos, omes }) {
  const p = {};
  if (postos.size) p.postoGrad = [...postos];
  if (omes.size) p.ome = [...omes];
  return p;
}

export default function ModuloMovimentacaoCarreira({ indId, carreira }) {
  const navigate = useNavigate();
  const [postos, setPostos] = useState(new Set());
  const [omes, setOmes] = useState(new Set());
  const filtrosPostos = useMemo(() => [...new Set(carreira.map((r) => r.posto))].sort(), [carreira]);
  const filtrosOmes = useMemo(() => [...new Set(carreira.map((r) => r.ome))].sort(), [carreira]);

  const filtrados = useMemo(
    () => carreira.filter((r) => (postos.size === 0 || postos.has(r.posto)) && (omes.size === 0 || omes.has(r.ome))),
    [carreira, postos, omes]
  );
  const filtroAtivo = postos.size > 0 || omes.size > 0;
  const base = paramsAtuais({ postos, omes });

  function irParaTabela(paramsExtra) {
    navigate(linkEfetivoTabela(indId, { ...base, ...paramsExtra }));
  }

  const movimentacaoData = useMemo(() => {
    const m = new Map();
    filtrados.forEach((r) => { if (r.anoMovimentacao) m.set(r.anoMovimentacao, (m.get(r.anoMovimentacao) || 0) + 1); });
    return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([label, valor]) => ({ label, valor }));
  }, [filtrados]);

  const promocaoData = useMemo(() => {
    const m = new Map();
    filtrados.forEach((r) => { if (r.anoPromocao) m.set(r.anoPromocao, (m.get(r.anoPromocao) || 0) + 1); });
    return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([label, valor]) => ({ label, valor }));
  }, [filtrados]);

  const ingressoData = useMemo(() => {
    const m = new Map();
    filtrados.forEach((r) => { if (r.anoIngresso) m.set(r.anoIngresso, (m.get(r.anoIngresso) || 0) + 1); });
    return [...m.entries()].sort((a, b) => b[0] - a[0]).map(([label, valor]) => ({ label: String(label), valor }));
  }, [filtrados]);

  const tempoServicoData = useMemo(() => {
    const buckets = new Map(TEMPO_SERVICO_BUCKETS.map((b) => [b.label, 0]));
    filtrados.forEach((r) => {
      const k = bucketTempoServico(r.tempoServicoAnos);
      buckets.set(k, (buckets.get(k) || 0) + 1);
    });
    return TEMPO_SERVICO_BUCKETS.map((b) => ({ label: b.label, valor: buckets.get(b.label) }));
  }, [filtrados]);

  const saidaData = useMemo(
    () => Object.entries(saidaPrevisao.saida_por_ano).sort((a, b) => Number(a[0]) - Number(b[0])).map(([label, valor]) => ({ label, valor })),
    []
  );

  const previsaoData = useMemo(() => {
    const m = new Map();
    saidaPrevisao.previsao_saida.forEach((r) => {
      if (!m.has(r.ano)) m.set(r.ano, { Oficiais: 0, Praças: 0 });
      const o = m.get(r.ano);
      if (r.categoria === "oficial") o.Oficiais = r.total; else if (r.categoria === "praca") o.Praças = r.total;
    });
    return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([ano, v]) => ({ label: String(ano), ...v }));
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <MultiSelectFiltro label="Patente" valores={filtrosPostos} selecionado={postos} onChange={setPostos} />
        <MultiSelectFiltro label="OME" valores={filtrosOmes} selecionado={omes} onChange={setOmes} />
        {filtroAtivo && (
          <button onClick={() => { setPostos(new Set()); setOmes(new Set()); }} className="text-[12px] font-medium text-muted-foreground hover:text-foreground">
            Limpar filtros
          </button>
        )}
        {filtroAtivo && (
          <span className="text-[12px] text-muted-foreground">{fmtNumero(filtrados.length)} de {fmtNumero(carreira.length)} militares</span>
        )}
        <span className="text-[11px] text-muted-foreground">Fonte sem campo de sexo — filtro "Sexo" não se aplica a este painel.</span>
      </div>

      <SectionCard titulo="Movimentações por ano" subtitulo="29 registros sem data de movimentação ficam fora da série.">
        <PanelGrafico
          tipo="line" data={movimentacaoData} xKey="label" yKeys={["valor"]} altura={260}
          aoClicarBarra={(d) => irParaTabela({ dataMovimentacaoSp: { min: d.label, max: d.label } })}
        />
      </SectionCard>

      <SectionCard
        titulo="Promoções por ano"
        subtitulo="Militar.json é um snapshot vivo: anos recentes tendem a subir com o tempo, à medida que novas promoções acontecem — não é um erro de cálculo."
      >
        <PanelGrafico
          tipo="bar" data={promocaoData} xKey="label" yKeys={["valor"]} altura={260}
          aoClicarBarra={(d) => irParaTabela({ dataUltimaPromocao: { min: d.label, max: d.label } })}
        />
      </SectionCard>

      <SectionCard titulo="Ingresso de militares">
        <PanelGrafico
          tipo="hbar" data={ingressoData} xKey="label" yKeys={["valor"]} altura={Math.max(320, ingressoData.length * 16)}
          aoClicarBarra={(d) => irParaTabela({ dataIngresso: { min: d.label, max: d.label } })}
        />
      </SectionCard>

      <SectionCard titulo="Tempo de serviço em anos">
        <PanelGrafico
          tipo="bar" data={tempoServicoData} xKey="label" yKeys={["valor"]} altura={260}
          aoClicarBarra={(d) => {
            const b = TEMPO_SERVICO_BUCKETS.find((x) => x.label === d.label);
            irParaTabela({ tempoServicoAnos: { min: b.min, max: b.max } });
          }}
        />
      </SectionCard>

      <SectionCard
        titulo="Saída de militares"
        subtitulo='Fonte diferente (inativos_metabase, desbloqueada em 2026-08-19) — não responde aos filtros acima e não abre a tabela de Efetivo (população de inativos, não de efetivo ativo).'
      >
        <PanelGrafico tipo="bar" data={saidaData} xKey="label" yKeys={["valor"]} altura={240} />
      </SectionCard>

      <SectionCard
        titulo="Previsão de saída"
        subtitulo="Projeção por reserva (tempo de serviço ou idade-limite, o que vier primeiro) contra peculio_metabase_v1 — mesma ressalva de fonte do card acima."
      >
        <PanelGrafico tipo="bar" data={previsaoData} xKey="label" yKeys={["Oficiais", "Praças"]} altura={260} legenda />
      </SectionCard>
    </div>
  );
}
