import React, { useMemo } from "react";

// Mapa de calor dia da semana × hora (7 × 24) — "quando acontece". Cada célula é a
// contagem de registros naquele dia/hora; a cor é proporcional à raiz do valor
// (realça as horas menores sem apagar tudo atrás do pico). `celulas`: matriz
// [dia 0=Dom..6=Sáb][hora 0..23] de números.
const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function HeatmapSemanaHora({ celulas, rotuloItem = "registro(s)", aoClicarCelula = undefined }) {
  const maximo = useMemo(() => Math.max(1, ...celulas.flat()), [celulas]);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px]">
        <div className="grid gap-[3px]" style={{ gridTemplateColumns: "36px repeat(24, minmax(0, 1fr))" }}>
          <span />
          {Array.from({ length: 24 }, (_, h) => (
            <span key={h} className="text-center text-[9px] text-muted-foreground">{h % 3 === 0 ? `${h}h` : ""}</span>
          ))}
          {DIAS.map((dia, d) => (
            <React.Fragment key={dia}>
              <span className="flex items-center text-[11px] font-medium text-muted-foreground">{dia}</span>
              {celulas[d].map((v, h) => {
                const t = v > 0 ? Math.sqrt(v / maximo) : 0;
                return (
                  <span
                    key={h}
                    title={`${dia}, ${String(h).padStart(2, "0")}h–${String(h).padStart(2, "0")}h59: ${v} ${rotuloItem}`}
                    onClick={aoClicarCelula && v > 0 ? () => aoClicarCelula(d, h) : undefined}
                    className={`flex aspect-square items-center justify-center rounded-[3px] text-[9px] font-semibold ${aoClicarCelula && v > 0 ? "cursor-pointer hover:ring-2 hover:ring-primary/60" : ""}`}
                    style={{
                      background: v > 0 ? `hsl(var(--primary) / ${(0.12 + t * 0.88).toFixed(2)})` : "hsl(var(--foreground) / 0.05)",
                      color: t > 0.55 ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))",
                    }}
                  >
                    {v > 0 && t > 0.55 ? v : ""}
                  </span>
                );
              })}
            </React.Fragment>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-end gap-2 text-[10px] text-muted-foreground">
          <span>menos</span>
          {[0.12, 0.35, 0.6, 0.85, 1].map((a) => (
            <span key={a} className="h-2.5 w-5 rounded-[2px]" style={{ background: `hsl(var(--primary) / ${a})` }} />
          ))}
          <span>mais (máx. {maximo})</span>
        </div>
      </div>
    </div>
  );
}
