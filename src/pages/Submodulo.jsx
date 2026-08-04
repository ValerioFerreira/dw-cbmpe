import React, { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ChevronRight, Table2, Layers, ArrowLeft
} from "lucide-react";
import { useCbmpe } from "@/lib/cbmpe-context";
import {
  getCaminho, getFilhos, getIndicadoresSubordinados,
  getModulosIndicador, fmtNumero, parseSerie
} from "@/lib/cbmpe";
import SectionCard from "@/components/ui/section-card";
import PanelGrafico from "@/components/charts/PanelGrafico";
import EmptyState from "@/components/ui/empty-state";

// Dados sintéticos para módulos categoriais (não deriváveis diretamente dos indicadores)
const SYNTH = {
  por_posto: [
    { label: "Oficiais", valor: 480 },
    { label: "Praças", valor: 6200 },
    { label: "Alunos", valor: 980 },
    { label: "Cadetes", valor: 540 }
  ],
  por_tipo: [
    { label: "ABT/UR", valor: 240 },
    { label: "Caminhões", valor: 180 },
    { label: "Ambulâncias", valor: 90 },
    { label: "Lanchas", valor: 42 },
    { label: "Motocicletas", valor: 130 }
  ],
  por_regiao: [
    { label: "RMR", valor: 4200 },
    { label: "Agreste", valor: 1900 },
    { label: "Sertão", valor: 1700 },
    { label: "ZM", valor: 400 }
  ],
  por_categoria: [
    { label: "EPI", valor: 320 },
    { label: "Combustível", valor: 240 },
    { label: "Armamento", valor: 120 },
    { label: "Outros", valor: 410 }
  ],
  estoque: [
    { label: "Crítico", valor: 18 },
    { label: "Baixo", valor: 34 },
    { label: "Médio", valor: 52 },
    { label: "Cheio", valor: 96 }
  ],
  disponibilidade: [
    { label: "Operacional", valor: 78 },
    { label: "Manutenção", valor: 14 },
    { label: "Reserva", valor: 8 }
  ],
  orcamento: [
    { label: "Executado", valor: 78 },
    { label: "Previsto", valor: 100 }
  ],
  despesas: [
    { label: "Pessoal", valor: 62 },
    { label: "Custeio", valor: 22 },
    { label: "Investim.", valor: 12 },
    { label: "Outros", valor: 4 }
  ]
};

export default function Submodulo() {
  const { id, modulo } = useParams();
  const { indicadores, unidades, porId, loading } = useCbmpe();

  const ind = indicadores.find((i) => i.id === id);
  const unidade = ind ? porId[ind.unidade_id] : null;
  const caminho = ind ? getCaminho(unidades, ind.unidade_id) : [];
  const modulos = ind ? getModulosIndicador(ind.nome) : [];
  const moduloInfo = modulos.find((m) => m.key === modulo);

  const subs = useMemo(
    () => (ind ? getIndicadoresSubordinados(indicadores, unidades, ind.unidade_id, ind.nome) : []),
    [ind, indicadores, unidades]
  );

  const dadosUnidade = useMemo(() => {
    if (!ind) return [];
    return getFilhos(unidades, ind.unidade_id).map((f) => {
      const i = indicadores.find((x) => x.unidade_id === f.id && x.nome === ind.nome);
      return { label: f.sigla || f.nome, valor: i ? i.valor : 0 };
    });
  }, [ind, unidades, indicadores]);

  const serieAgg = useMemo(() => {
    const series = subs.map((s) => parseSerie(s.serie)).filter((s) => s.length);
    if (!series.length) return [];
    const len = Math.min(...series.map((s) => s.length));
    return Array.from({ length: len }).map((_, i) => ({
      label: `M${i + 1}`,
      valor: Math.round(series.reduce((a, s) => a + (Number(s[i]) || 0), 0))
    }));
  }, [subs]);

  if (loading && !ind) return <div className="h-96 animate-pulse rounded-xl bg-muted/40" />;

  if (!ind || !moduloInfo) {
    return (
      <EmptyState
        icon={Layers}
        titulo="Submódulo não encontrado"
        acao={<Link to="/" className="text-[13px] font-medium text-primary hover:underline">Voltar ao início</Link>}
      />
    );
  }

  const isUnidade = modulo === "por_unidade";
  const isHistorico = modulo === "historico";
  const synth = SYNTH[modulo];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <Link to="/organograma" className="hover:text-foreground">Organograma</Link>
        <ChevronRight className="h-3 w-3" />
        {caminho.map((c) => (
          <span key={c.id} className="inline-flex items-center gap-1.5">
            <Link to={`/diretoria/${c.id}`} className="hover:text-foreground">{c.sigla || c.nome}</Link>
            <ChevronRight className="h-3 w-3" />
          </span>
        ))}
        <Link to={`/indicador/${ind.id}`} className="hover:text-foreground">{ind.nome}</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">{moduloInfo.nome}</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/8 text-primary">
            <Layers className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">{moduloInfo.nome}</h1>
            <p className="mt-0.5 text-[13px] text-muted-foreground">{ind.nome} · {unidade?.nome}</p>
            <p className="mt-1.5 text-[11px] text-muted-foreground">{subs.length} unidades vinculadas analisadas</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to={`/indicador/${ind.id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Indicador
          </Link>
          <Link to={`/detalhamento/${ind.id}/${modulo}`} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground transition-colors hover:bg-primary/90">
            <Table2 className="h-3.5 w-3.5" /> Detalhamento
          </Link>
        </div>
      </div>

      {/* Outros módulos */}
      <div className="flex flex-wrap gap-2">
        {modulos.map((m) => (
          <Link
            key={m.key}
            to={`/submodulo/${ind.id}/${m.key}`}
            className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors ${
              m.key === modulo ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {m.nome}
          </Link>
        ))}
      </div>

      {/* Gráficos do módulo */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <SectionCard titulo={moduloInfo.nome} subtitulo="Distribuição por categoria">
            {isUnidade && dadosUnidade.length > 0 ? (
              <PanelGrafico tipo="bar" data={dadosUnidade} xKey="label" yKeys={["valor"]} altura={300} />
            ) : isHistorico && serieAgg.length > 0 ? (
              <PanelGrafico tipo="area" data={serieAgg} xKey="label" yKeys={["valor"]} altura={300} />
            ) : synth ? (
              <PanelGrafico tipo="bar" data={synth} xKey="label" yKeys={["valor"]} altura={300} />
            ) : (
              <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border text-[12px] text-muted-foreground">Dados insuficientes.</div>
            )}
          </SectionCard>

          {isHistorico && serieAgg.length > 0 && (
            <SectionCard titulo="Comparativo Mensal" subtitulo="Evolução agregada">
              <PanelGrafico tipo="bar" data={serieAgg} xKey="label" yKeys={["valor"]} altura={240} />
            </SectionCard>
          )}
        </div>

        <div className="space-y-6">
          <SectionCard titulo="Composição" subtitulo="Distribuição proporcional">
            {isUnidade && dadosUnidade.length > 0 ? (
              <PanelGrafico tipo="bar" data={dadosUnidade.slice(0, 6)} xKey="label" yKeys={["valor"]} altura={220} />
            ) : synth ? (
              <PanelGrafico tipo="bar" data={synth} xKey="label" yKeys={["valor"]} altura={220} stacked />
            ) : (
              <p className="text-[12px] text-muted-foreground">Sem dados.</p>
            )}
          </SectionCard>

          <SectionCard titulo="Resumo" subtitulo="Indicadores-chave">
            <div className="space-y-2">
              <LinhaResumo label="Unidades analisadas" valor={String(subs.length)} />
              <LinhaResumo label="Valor consolidado" valor={fmtNumero(subs.reduce((a, s) => a + (s.valor || 0), 0), ind.unidade_medida)} />
              <LinhaResumo label="Módulo" valor={moduloInfo.nome} />
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function LinhaResumo({ label, valor }) {
  return (
    <div className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-muted/40">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <span className="text-[12px] font-semibold tabular-nums text-foreground">{valor}</span>
    </div>
  );
}