import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fmtNumero } from "@/lib/cbmpe";
import {
  CLASSES, groupCount, useFiltrosEfetivo, linkEfetivoTabela, omesDaCidade,
  OFICIAIS_POSTOS, PRACAS_POSTOS,
} from "@/lib/efetivoDashboard";
import SectionCard from "@/components/ui/section-card";
import GeoChoropleth from "@/components/charts/GeoChoropleth";
import PanelGrafico from "@/components/charts/PanelGrafico";
import MultiSelectFiltro from "@/components/ui/multi-select-filtro";
import TopNControl from "@/components/ui/top-n-control";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown } from "lucide-react";

function RangeFiltro({ min, max, onApply, onClear }) {
  const [minV, setMinV] = useState(min ?? "");
  const [maxV, setMaxV] = useState(max ?? "");
  const ativo = min !== null || max !== null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[12px] font-medium transition-colors ${
            ativo ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          Anos na OME atual
          {ativo && <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">{min ?? 0}–{max ?? "∞"}</span>}
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 space-y-3" align="start">
        <div className="flex items-center gap-2">
          <input type="number" min="0" value={minV} onChange={(e) => setMinV(e.target.value)} placeholder="Mín."
            className="h-8 w-full rounded-md border border-input bg-background px-2 text-[12px] outline-none focus:border-primary" />
          <span className="text-muted-foreground">–</span>
          <input type="number" min="0" value={maxV} onChange={(e) => setMaxV(e.target.value)} placeholder="Máx."
            className="h-8 w-full rounded-md border border-input bg-background px-2 text-[12px] outline-none focus:border-primary" />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onApply(minV === "" ? null : Number(minV), maxV === "" ? null : Number(maxV))}
            className="flex-1 rounded-md bg-primary px-2 py-1.5 text-[12px] font-medium text-primary-foreground hover:bg-primary/90"
          >
            Aplicar
          </button>
          <button
            onClick={() => { setMinV(""); setMaxV(""); onClear(); }}
            className="flex-1 rounded-md border border-border px-2 py-1.5 text-[12px] font-medium text-muted-foreground hover:bg-muted"
          >
            Limpar
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function paramsAtuais({ classes, postos, sexos }) {
  const p = {};
  if (postos.size) p.postoGrad = [...postos];
  else if (classes.size === 1) p.postoGrad = classes.has("Oficiais") ? OFICIAIS_POSTOS : PRACAS_POSTOS;
  if (sexos.size) p.sexo = [...sexos];
  return p;
}

export default function ModuloDistribuicaoGeografica({ indId, militares, municipios }) {
  const navigate = useNavigate();
  const { classes, setClasses, postos, setPostos, omes, setOmes, sexos, setSexos, filtroAtivo, limparTudo } = useFiltrosEfetivo(militares);
  const [tempoMin, setTempoMin] = useState(null);
  const [tempoMax, setTempoMax] = useState(null);
  const [topNOme, setTopNOme] = useState(null);
  const filtrosPostos = useMemo(() => [...new Set(militares.map((r) => r.posto))].sort(), [militares]);
  const filtrosOmes = useMemo(() => [...new Set(militares.map((r) => r.ome))].sort(), [militares]);

  const filtrados = useMemo(() => militares.filter((r) =>
    (classes.size === 0 || classes.has(r.categoria)) &&
    (postos.size === 0 || postos.has(r.posto)) &&
    (omes.size === 0 || omes.has(r.ome)) &&
    (sexos.size === 0 || sexos.has(r.sexo)) &&
    (tempoMin === null || (r.tempoObmAnos !== null && r.tempoObmAnos >= tempoMin)) &&
    (tempoMax === null || (r.tempoObmAnos !== null && r.tempoObmAnos <= tempoMax))
  ), [militares, classes, postos, omes, sexos, tempoMin, tempoMax]);

  const counts = useMemo(() => groupCount(filtrados, (r) => r.cidade), [filtrados]);
  const base = paramsAtuais({ classes, postos, sexos });

  const omeData = useMemo(() => {
    const m = new Map();
    filtrados.forEach((r) => {
      if (!m.has(r.ome)) m.set(r.ome, { pracas: 0, oficiais: 0 });
      const o = m.get(r.ome);
      if (r.categoria === "Praças") o.pracas++; else if (r.categoria === "Oficiais") o.oficiais++;
    });
    return Array.from(m.entries())
      .map(([label, v]) => ({ label, Praças: v.pracas, Oficiais: v.oficiais, total: v.pracas + v.oficiais }))
      .filter((d) => d.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [filtrados]);
  const omeDataExibida = topNOme ? omeData.slice(0, topNOme) : omeData;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <MultiSelectFiltro label="Classe" valores={CLASSES} selecionado={classes} onChange={setClasses} buscavel={false} />
        <MultiSelectFiltro label="Patente" valores={filtrosPostos} selecionado={postos} onChange={setPostos} />
        <MultiSelectFiltro label="OME" valores={filtrosOmes} selecionado={omes} onChange={setOmes} />
        <MultiSelectFiltro label="Sexo" valores={["M", "F"]} selecionado={sexos} onChange={setSexos} buscavel={false} />
        <RangeFiltro min={tempoMin} max={tempoMax} onApply={(mn, mx) => { setTempoMin(mn); setTempoMax(mx); }} onClear={() => { setTempoMin(null); setTempoMax(null); }} />
        {(filtroAtivo || tempoMin !== null || tempoMax !== null) && (
          <button onClick={() => { limparTudo(); setTempoMin(null); setTempoMax(null); }} className="text-[12px] font-medium text-muted-foreground hover:text-foreground">
            Limpar filtros
          </button>
        )}
        {(filtroAtivo || tempoMin !== null || tempoMax !== null) && (
          <span className="text-[12px] text-muted-foreground">{fmtNumero(filtrados.length)} de {fmtNumero(militares.length)} militares</span>
        )}
      </div>

      <SectionCard titulo="Distribuição Geográfica - Lotação">
        <GeoChoropleth
          municipios={municipios}
          counts={counts}
          aoClicarMunicipio={(nome) => navigate(linkEfetivoTabela(indId, { ...base, ome: omesDaCidade(nome) }))}
        />
      </SectionCard>

      <SectionCard
        titulo="Distribuição de Oficiais e Praças por OME"
        acoes={<TopNControl value={topNOme} onChange={setTopNOme} total={omeData.length} opcoes={[10, 20]} />}
      >
        {omeDataExibida.length > 0 ? (
          <PanelGrafico
            tipo="bar" data={omeDataExibida} xKey="label" yKeys={["Praças", "Oficiais"]} altura={280}
            aoClicarBarra={(d, serie) => navigate(linkEfetivoTabela(indId, { ...base, ome: d.label, postoGrad: serie === "Praças" ? PRACAS_POSTOS : OFICIAIS_POSTOS }))}
          />
        ) : (
          <div className="flex h-48 items-center justify-center text-[12px] text-muted-foreground">Sem registros para os filtros atuais.</div>
        )}
      </SectionCard>
    </div>
  );
}
