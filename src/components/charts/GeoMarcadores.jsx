import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { fmtNumero } from "@/lib/cbmpe";
import { projetar, dentroDoMapa, LARGURA_PE, ALTURA_PE, NORONHA } from "@/lib/projecaoPe";

// Mapa de Pernambuco com balões posicionados por lat/long — irmão do
// GeoChoropleth, que pinta município. Aqui o município é só o contorno; o que
// interessa é o ponto, porque o grão do Mapa de Força é o posto de serviço
// (a seção de bombeiros), não a cidade.
//
// Sem biblioteca de mapa e sem tiles, de propósito: um Leaflet precisaria
// buscar imagem de servidor externo, e o destino deste app é a intranet, onde
// isso não existe. O SVG é o mesmo municipios_pe.json que os painéis de
// Distribuição Geográfica já usam; o que faltava era a projeção, recuperada
// em 2026-08-26 (ver src/lib/projecaoPe.js).
//
// Fernando de Noronha fica FORA do viewBox — a ilha está a ~350 km da costa e,
// dentro da mesma caixa, espremeria o continente. Como o GBI lança guarnição
// no SBFN todo dia, ela ganha um encarte no canto, desenhado à parte.

const RAIO_MIN = 4;
const RAIO_MAX = 13;

export default function GeoMarcadores({
  municipios, pontos, altura = 420, aoClicarPonto, valorDoPonto = (p) => p.viaturas,
  rotuloValor = "viatura(s)",
}) {
  const [hover, setHover] = useState(null);

  const maximo = useMemo(
    () => Math.max(1, ...pontos.map(valorDoPonto)),
    [pontos, valorDoPonto]
  );

  // Área proporcional ao valor (raiz), não raio — raio proporcional exagera
  // o grande e some com o pequeno.
  const raio = (v) => RAIO_MIN + (RAIO_MAX - RAIO_MIN) * Math.sqrt(Math.min(v / maximo, 1));

  const { noMapa, noEncarte } = useMemo(() => {
    const dentro = [], fora = [];
    pontos.forEach((p) => (dentroDoMapa(p.lat, p.lon) ? dentro : fora).push(p));
    return { noMapa: dentro, noEncarte: fora };
  }, [pontos]);

  // Mesma correção de deslocamento do tooltip já resolvida em GeoChoropleth:
  // `html { zoom: 1.25 }` reescala a página, e `.animate-fade-in` deixa um
  // transform residual no ancestral que quebra `position: fixed`. Daí dividir
  // pelo zoom e renderizar via portal no body.
  function moverTooltip(e, ponto) {
    const zoom = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
    setHover({ x: e.clientX / zoom, y: e.clientY / zoom, ponto });
  }

  const clicavel = typeof aoClicarPonto === "function";

  return (
    <div className="relative rounded-lg border border-border bg-muted/20 p-2">
      <svg
        viewBox={`0 0 ${LARGURA_PE} ${ALTURA_PE}`}
        style={{ width: "100%", height: altura }}
        onMouseLeave={() => setHover(null)}
      >
        {municipios.features.map((f) => (
          <path
            key={f.id}
            d={f.d}
            fill="hsl(var(--foreground) / 0.07)"
            stroke="hsl(var(--card))"
            strokeWidth={0.4}
          />
        ))}

        {noMapa.map((p) => {
          const { x, y } = projetar(p.lat, p.lon);
          const v = valorDoPonto(p);
          const aproximado = p.origemCoord !== "posto";
          return (
            <g key={p.id}>
              <circle
                cx={x} cy={y} r={raio(v)}
                fill="hsl(var(--primary) / 0.55)"
                stroke="hsl(var(--primary))"
                strokeWidth={1}
                // Tracejado quando a coordenada não é do próprio posto: hoje
                // 97 dos 185 postos herdam a coordenada da OME, então o balão
                // marca a unidade, não a seção. Mostrar isso na tela evita que
                // alguém leia posição aproximada como posição real.
                strokeDasharray={aproximado ? "2 2" : undefined}
                cursor={clicavel ? "pointer" : undefined}
                onClick={clicavel ? () => aoClicarPonto(p) : undefined}
                onMouseMove={(e) => moverTooltip(e, p)}
              />
              <text
                x={x} y={y + 3}
                textAnchor="middle"
                className="pointer-events-none select-none"
                style={{ fontSize: 9, fontWeight: 600, fill: "hsl(var(--primary-foreground))" }}
              >
                {v > 0 ? v : ""}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Encarte de Fernando de Noronha */}
      {noEncarte.length > 0 && (
        <div className="absolute right-3 top-3 w-40 rounded-lg border border-dashed border-border bg-card/95 p-2 shadow-sm">
          <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
            {NORONHA.nome}
          </p>
          <div className="space-y-1">
            {noEncarte.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={clicavel ? () => aoClicarPonto(p) : undefined}
                onMouseMove={(e) => moverTooltip(e, p)}
                onMouseLeave={() => setHover(null)}
                className="flex w-full items-center justify-between gap-2 rounded px-1.5 py-1 text-left text-[11px] hover:bg-primary/10"
              >
                <span className="truncate text-foreground/80">{p.nome}</span>
                <span className="shrink-0 font-semibold tabular-nums text-foreground">
                  {fmtNumero(valorDoPonto(p))}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {hover && createPortal(
        <div
          className="pointer-events-none fixed z-50 max-w-xs rounded-lg border border-border bg-popover px-3 py-2 text-[12px] shadow-lg"
          style={{ left: hover.x + 12, top: hover.y + 12 }}
        >
          <b className="text-foreground">{hover.ponto.nome}</b>
          <div className="text-muted-foreground">
            {hover.ponto.ome}
            {hover.ponto.municipio ? ` · ${hover.ponto.municipio}` : ""}
          </div>
          <div className="mt-1 text-foreground">
            {fmtNumero(valorDoPonto(hover.ponto))} {rotuloValor}
            {" · "}
            {fmtNumero(hover.ponto.militares)} militar(es)
          </div>
          {hover.ponto.origemCoord !== "posto" && (
            <div className="mt-1 text-[10px] text-muted-foreground">
              {hover.ponto.origemCoord === "ome"
                ? "posição aproximada — o posto não tem coordenada própria"
                : "posição corrigida pelo município declarado"}
            </div>
          )}
        </div>,
        document.body
      )}

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border border-primary bg-primary/55" />
          coordenada do próprio posto
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border border-dashed border-primary bg-primary/55" />
          posição aproximada (coordenada da OME)
        </span>
      </div>
    </div>
  );
}
