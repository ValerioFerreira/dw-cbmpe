import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { fmtNumero } from "@/lib/cbmpe";
import MolduraNoronha from "./MolduraNoronha";

// Teto fixo da escala de intensidade (pedido do usuário: legenda sempre
// "0 a 1000" no Efetivo; outro painel passa o próprio `teto`, ex. CVI), em vez de recalcular o topo a cada mudança de filtro — mantém
// a cor comparável entre filtros diferentes). Nenhuma cidade individual
// chega perto disso hoje (Recife ~880-900), então serve de teto estável.
const TETO_ESCALA = 1000;

// Mapa coroplético de Pernambuco (aba "Distribuição Geográfica" do dashboard
// de Efetivo). municipios: { width, height, features: [{id,name,d}] } — os
// paths SVG já vêm pré-computados (ver spec-02-distribuicao-geografica.md,
// geometria fornecida por Igor a partir do IBGE). counts: Map<cidade, valor>.
// Escala sequencial em raiz quadrada: realça cidades menores sem esconder
// tudo atrás de Recife.
export default function GeoChoropleth({
  municipios, counts, altura = 340, aoClicarMunicipio,
  rotuloItem = "militar(es) lotado(s)", tituloRanking = "Municípios com maior efetivo",
  teto = TETO_ESCALA,
  infoRanking = "Contagem de militares feita pelo município-sede da OME, não leva em consideração a distribuição em SBs.",
  colunaExtra = undefined, // { titulo, valor: (municipio) => texto } — coluna ao lado do total no ranking
}) {
  const [hover, setHover] = useState(null);
  const clicavel = typeof aoClicarMunicipio === "function";

  const top8 = useMemo(
    () => Array.from(counts.entries()).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 8),
    [counts]
  );

  // Duas causas de deslocamento pro balão de tooltip, as duas já resolvidas
  // em filtro-coluna.jsx e replicadas aqui: (1) `html { zoom: 1.25 }`
  // (index.css) reescala a página inteira — um `position: fixed` interpreta
  // left/top no espaço PRÉ-zoom, mas clientX/clientY do mouse vêm em pixels
  // reais (PÓS-zoom), então dividimos pelo zoom; (2) `.animate-fade-in`
  // (usada nos wrappers de página) usa `animation-fill-mode: both`, que
  // deixa um `transform: translate(0)` residual no ancestral depois da
  // animação — qualquer transform em ancestral vira containing block de
  // `position: fixed`, quebrando a suposição de "fixed = relativo à
  // viewport". Só escapa disso renderizando via portal direto no
  // document.body (fora da árvore de qualquer ancestral com transform).
  function moverTooltip(e, name, v) {
    const zoom = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
    setHover({ x: e.clientX / zoom, y: e.clientY / zoom, name, v });
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="relative flex-1 rounded-lg border border-border bg-muted/20 p-2">
        <svg
          viewBox={`${municipios.minX ?? 0} ${municipios.minY ?? 0} ${municipios.width} ${municipios.height}`}
          style={{ width: "100%", height: altura }}
          onMouseLeave={() => setHover(null)}
        >
          {municipios.features.map((f) => {
            const v = counts.get(f.name) || 0;
            let fill = "hsl(var(--foreground) / 0.14)";
            if (v > 0) {
              const t = Math.sqrt(Math.min(v / teto, 1));
              const alpha = (0.16 + t * 0.84).toFixed(2);
              fill = `hsl(var(--primary) / ${alpha})`;
            }
            return (
              <path
                key={f.id}
                d={f.d}
                fill={fill}
                stroke="hsl(var(--card))"
                strokeWidth={0.4}
                cursor={clicavel && v > 0 ? "pointer" : undefined}
                onClick={clicavel && v > 0 ? () => aoClicarMunicipio(f.name) : undefined}
                onMouseMove={(e) => moverTooltip(e, f.name, v)}
              />
            );
          })}
          <MolduraNoronha />
        </svg>
        {hover && createPortal(
          <div
            className="pointer-events-none fixed z-50 rounded-lg border border-border bg-popover px-3 py-2 text-[12px] shadow-lg"
            style={{ left: hover.x + 10, top: hover.y + 10 }}
          >
            <b className="text-foreground">{hover.name}</b>
            <span className="text-muted-foreground">
              {": "}
              {hover.v > 0 ? `${fmtNumero(hover.v)} ${rotuloItem}` : "sem OME do CBMPE"}
            </span>
          </div>,
          document.body
        )}
        {/* Legenda de intensidade — discreta, canto inferior esquerdo, escala fixa 0–1000. */}
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-card/80 px-2 py-1 text-[10px] text-muted-foreground">
          <span>0</span>
          <span className="h-1.5 w-16 rounded-full" style={{ background: "linear-gradient(to right, hsl(var(--primary) / 0.16), hsl(var(--primary) / 1))" }} />
          <span>{fmtNumero(teto)}</span>
        </div>
      </div>

      <div className={`w-full shrink-0 ${colunaExtra ? "lg:w-80" : "lg:w-56"}`}>
        <div className="mb-2 flex items-center gap-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{tituloRanking}</p>
          <InfoBalao texto={infoRanking} />
        </div>
        {colunaExtra && (
          <div className="flex items-center justify-between gap-2 px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Município</span>
            <span className="flex gap-3">
              <span className="w-10 text-right">Total</span>
              <span className="w-24 whitespace-nowrap text-right">{colunaExtra.titulo}</span>
            </span>
          </div>
        )}
        <div className="space-y-1">
          {top8.map(([name, v]) => (
            <div
              key={name}
              onClick={clicavel ? () => aoClicarMunicipio(name) : undefined}
              className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-[12px] ${clicavel ? "cursor-pointer hover:bg-primary/10" : "hover:bg-muted/40"}`}
            >
              <span className="text-foreground/80">{name}</span>
              {colunaExtra ? (
                <span className="flex gap-3 tabular-nums">
                  <span className="w-10 text-right font-semibold text-foreground">{fmtNumero(v)}</span>
                  <span className="w-24 text-right text-foreground/80">{colunaExtra.valor(name)}</span>
                </span>
              ) : (
                <span className="font-semibold tabular-nums text-foreground">{fmtNumero(v)}</span>
              )}
            </div>
          ))}
          {top8.length === 0 && <p className="px-2 py-3 text-[12px] text-muted-foreground">Sem dados para os filtros atuais.</p>}
        </div>
      </div>
    </div>
  );
}

function InfoBalao({ texto }) {
  const [aberto, setAberto] = useState(false);
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onMouseEnter={() => setAberto(true)}
        onMouseLeave={() => setAberto(false)}
        onClick={(e) => { e.stopPropagation(); setAberto((v) => !v); }}
        className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-muted-foreground/40 text-[9px] font-bold text-muted-foreground hover:border-primary hover:text-primary"
        aria-label="Mais informações"
      >
        i
      </button>
      {aberto && (
        <span className="absolute left-1/2 top-full z-50 mt-1.5 w-56 -translate-x-1/2 rounded-lg border border-border bg-popover px-3 py-2 text-[11px] font-normal normal-case tracking-normal text-popover-foreground shadow-lg">
          {texto}
        </span>
      )}
    </span>
  );
}
