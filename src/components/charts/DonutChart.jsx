import React, { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { fmtNumero } from "@/lib/cbmpe";

// Vermelho + cinza como par de 2 cores — laranja (--accent) só entra a
// partir da 3ª fatia (pedido do usuário: evitar laranja em distinções de
// apenas 2 categorias).
const PALETA_PADRAO = ["hsl(var(--primary))", "hsl(var(--muted-foreground))", "hsl(var(--accent))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"];

function TooltipDonut({ active, payload, total }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const pct = total ? ((p.value / total) * 100).toFixed(1) : "0.0";
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg">
      <p className="flex items-center gap-2 text-[12px]">
        <span className="h-2 w-2 rounded-full" style={{ background: p.payload.fill }} />
        <span className="text-muted-foreground">{p.name}:</span>
        <span className="font-semibold text-foreground">{fmtNumero(p.value)} ({pct}%)</span>
      </p>
    </div>
  );
}

// Donut com total no centro + legenda lateral — usado nos cards "Distribuição
// de Oficiais x Praças" / "Distribuição por sexo" etc. (spec.md do dashboard
// de Efetivo). data: [{ label, valor }].
export default function DonutChart({ data, rotuloTotal = "TOTAL", altura = 200, cores, aoClicarFatia }) {
  const palette = cores || PALETA_PADRAO;
  const clicavel = typeof aoClicarFatia === "function";
  const total = useMemo(() => data.reduce((a, d) => a + d.valor, 0), [data]);
  const dataComCor = useMemo(
    () => data.map((d, i) => ({ ...d, fill: palette[i % palette.length] })),
    [data, palette]
  );

  if (!total) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-border text-[12px] text-muted-foreground">
        Sem registros.
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:justify-center">
      <div className="relative shrink-0" style={{ width: altura, height: altura }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={dataComCor}
              dataKey="valor"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius="68%"
              outerRadius="100%"
              paddingAngle={total > 0 ? 1 : 0}
              stroke="none"
              isAnimationActive={false}
              cursor={clicavel ? "pointer" : undefined}
              onClick={clicavel ? (d) => aoClicarFatia((d?.payload || d).label) : undefined}
            >
              {dataComCor.map((d, i) => <Cell key={i} fill={d.fill} />)}
            </Pie>
            <Tooltip content={<TooltipDonut total={total} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-xl font-semibold tracking-tight text-foreground">{fmtNumero(total)}</span>
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{rotuloTotal}</span>
        </div>
      </div>
      <div className="flex w-full flex-col gap-1.5 sm:w-auto">
        {dataComCor.map((d, i) => (
          <div
            key={i}
            onClick={clicavel ? () => aoClicarFatia(d.label) : undefined}
            className={`flex items-center justify-between gap-4 rounded-lg px-2 py-1 text-[12px] ${clicavel ? "cursor-pointer hover:bg-muted/60" : ""}`}
          >
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: d.fill }} />
              {d.label}
            </span>
            <span className="font-semibold tabular-nums text-foreground">{fmtNumero(d.valor)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
