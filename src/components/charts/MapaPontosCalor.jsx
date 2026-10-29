import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, Minus, Maximize2 } from "lucide-react";
import { projetarNoMapa, dentroDoMapa } from "@/lib/projecaoPe";
import useZoomMapa from "@/lib/useZoomMapa";
import MolduraNoronha from "./MolduraNoronha";

// Pontos quentes sobre o mapa de Pernambuco: os registros são somados numa grade de
// ~1 km (0,01°) e cada célula vira um círculo com área proporcional à contagem.
// Mesmo pano de fundo, projeção e zoom do GeoMarcadores (Mapa de Força), sem as
// insígnias e o detalhe de posto, que lá são do grão "posto de serviço".
// `pontos`: [{ lat, lng, rotulo }] — `rotulo` (bairro, cidade) aparece no balão; o clique
// num círculo devolve os rótulos daquela célula (aoClicarCelula).
const PASSO_GRADE = 0.01;
const RAIO_MIN = 2.2;
const RAIO_MAX = 11;

export default function MapaPontosCalor({ municipios, pontos, altura = 420, rotuloItem = "registro(s)", aoClicarCelula = undefined }) {
  const [hover, setHover] = useState(null);
  const quadroBase = useMemo(() => ({
    x: municipios.minX ?? 0, y: municipios.minY ?? 0, w: municipios.width, h: municipios.height,
  }), [municipios]);
  const mapa = useZoomMapa(quadroBase);
  const { escala } = mapa;

  const celulas = useMemo(() => {
    const m = new Map();
    pontos.forEach((p) => {
      if (p.lat == null || p.lng == null || !dentroDoMapa(p.lat, p.lng)) return;
      const lat = Math.round(p.lat / PASSO_GRADE) * PASSO_GRADE;
      const lng = Math.round(p.lng / PASSO_GRADE) * PASSO_GRADE;
      const chave = `${lat.toFixed(2)}|${lng.toFixed(2)}`;
      const c = m.get(chave) || { lat, lng, valor: 0, rotulos: new Map() };
      c.valor += 1;
      if (p.rotulo) c.rotulos.set(p.rotulo, (c.rotulos.get(p.rotulo) || 0) + 1);
      m.set(chave, c);
    });
    return [...m.values()]
      .map((c) => ({ ...c, ...projetarNoMapa(c.lat, c.lng) }))
      .sort((a, b) => a.valor - b.valor); // maiores por cima
  }, [pontos]);

  const maximo = useMemo(() => Math.max(1, ...celulas.map((c) => c.valor)), [celulas]);
  const raio = (v) => (RAIO_MIN + (RAIO_MAX - RAIO_MIN) * Math.sqrt(v / maximo)) / escala;
  const semCoordenada = pontos.length - celulas.reduce((a, c) => a + c.valor, 0);

  function mover(e, c) {
    const zoom = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
    setHover({ x: e.clientX / zoom, y: e.clientY / zoom, c });
  }

  const botao = "flex h-6 w-6 items-center justify-center rounded border border-border bg-card text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground disabled:opacity-40";
  const cursor = mapa.arrastandoAgora ? "grabbing" : (mapa.zoomAtivo ? "grab" : "default");

  return (
    <div className="relative rounded-lg border border-border bg-muted/20 p-2">
      <svg
        ref={mapa.svgRef}
        viewBox={`${mapa.vb.x} ${mapa.vb.y} ${mapa.vb.w} ${mapa.vb.h}`}
        style={{ width: "100%", height: altura, cursor, touchAction: "none" }}
        onPointerDown={mapa.aoPressionar}
        onPointerMove={mapa.aoMover}
        onPointerUp={mapa.aoSoltar}
        onPointerLeave={(e) => { mapa.aoSoltar(e); setHover(null); }}
      >
        {municipios.features.map((f) => (
          <path key={f.id} d={f.d} fill="hsl(var(--foreground) / 0.07)" stroke="hsl(var(--card))" strokeWidth={0.4 / escala} />
        ))}
        <MolduraNoronha escala={escala} />
        {celulas.map((c) => (
          <circle
            key={`${c.lat}|${c.lng}`}
            cx={c.x} cy={c.y} r={raio(c.valor)}
            fill="hsl(var(--primary) / 0.45)"
            stroke="hsl(var(--primary))"
            strokeWidth={0.6 / escala}
            onPointerMove={(e) => mover(e, c)}
            onPointerLeave={() => setHover(null)}
            // O arrasto do mapa termina num pointerup sobre o círculo: só é clique se não arrastou.
            onClick={aoClicarCelula ? () => { if (!mapa.arrastando()) aoClicarCelula([...c.rotulos.keys()]); } : undefined}
            cursor={aoClicarCelula ? "pointer" : undefined}
          />
        ))}
      </svg>

      <div className="absolute right-3 top-3 flex flex-col gap-1">
        <button type="button" className={botao} onClick={mapa.maisZoom} aria-label="Aproximar"><Plus className="h-3.5 w-3.5" /></button>
        <button type="button" className={botao} onClick={mapa.menosZoom} aria-label="Afastar"><Minus className="h-3.5 w-3.5" /></button>
        <button type="button" className={botao} onClick={mapa.resetar} disabled={!mapa.zoomAtivo} aria-label="Enquadrar Pernambuco"><Maximize2 className="h-3.5 w-3.5" /></button>
      </div>
      <p className="mt-1 px-1 text-[11px] text-muted-foreground">
        Círculos somam os registros num raio de ~1 km. Ctrl + roda do mouse ou os botões dão zoom; arraste para mover.
        {semCoordenada > 0 && ` ${semCoordenada} ${rotuloItem} sem coordenada ficam fora do mapa.`}
      </p>

      {hover && createPortal(
        <div
          className="pointer-events-none fixed z-50 max-w-[260px] rounded-lg border border-border bg-popover px-3 py-2 text-[12px] shadow-lg"
          style={{ left: hover.x + 14, top: hover.y + 14 }}
        >
          <p className="font-semibold text-foreground">{hover.c.valor} {rotuloItem}</p>
          {[...hover.c.rotulos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([r, n]) => (
            <p key={r} className="text-muted-foreground">{r}: {n}</p>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
