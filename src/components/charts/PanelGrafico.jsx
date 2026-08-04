import React, { useMemo } from "react";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Cell
} from "recharts";

const COR_PRIMARIA = "hsl(var(--primary))";
const COR_ACENTO = "hsl(var(--accent))";
const COR_GRID = "hsl(var(--border))";
const COR_TEXTO = "hsl(var(--muted-foreground))";

function TooltipCustom({ active, payload, label, unidade }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg">
      {label !== undefined && <p className="mb-1 text-[11px] font-medium text-muted-foreground">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2 text-[12px]">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold text-foreground">{p.value}{unidade ? " " + unidade : ""}</span>
        </p>
      ))}
    </div>
  );
}

export default function PanelGrafico({ tipo = "bar", data, xKey = "label", yKeys = ["valor"], altura = 240, unidade, cores, stacked = false }) {
  const palette = useMemo(() => cores || [COR_PRIMARIA, COR_ACENTO, "hsl(var(--chart-3))", "hsl(var(--chart-4))"], [cores]);

  const propsComuns = {
    data, margin: { top: 8, right: 8, bottom: 0, left: -16 },
  };

  return (
    <ResponsiveContainer width="100%" height={altura}>
      {tipo === "bar" ? (
        <BarChart {...propsComuns}>
          <CartesianGrid strokeDasharray="3 3" stroke={COR_GRID} vertical={false} />
          <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: COR_TEXTO }} tickLine={false} axisLine={{ stroke: COR_GRID }} />
          <YAxis tick={{ fontSize: 11, fill: COR_TEXTO }} tickLine={false} axisLine={false} />
          <Tooltip content={<TooltipCustom unidade={unidade} />} cursor={{ fill: "hsl(var(--muted))" }} />
          {yKeys.map((k, i) => (
            <Bar key={k} dataKey={k} stackId={stacked ? "a" : undefined} radius={[3, 3, 0, 0]} maxBarSize={42}>
              {data.map((_, idx) => <Cell key={idx} fill={palette[i % palette.length]} />)}
            </Bar>
          ))}
        </BarChart>
      ) : tipo === "line" ? (
        <LineChart {...propsComuns}>
          <CartesianGrid strokeDasharray="3 3" stroke={COR_GRID} vertical={false} />
          <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: COR_TEXTO }} tickLine={false} axisLine={{ stroke: COR_GRID }} />
          <YAxis tick={{ fontSize: 11, fill: COR_TEXTO }} tickLine={false} axisLine={false} />
          <Tooltip content={<TooltipCustom unidade={unidade} />} />
          {yKeys.map((k, i) => (
            <Line key={k} type="monotone" dataKey={k} stroke={palette[i % palette.length]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          ))}
        </LineChart>
      ) : (
        <AreaChart {...propsComuns}>
          <defs>
            {yKeys.map((k, i) => (
              <linearGradient key={k} id={`grad-${k}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={palette[i % palette.length]} stopOpacity={0.28} />
                <stop offset="100%" stopColor={palette[i % palette.length]} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={COR_GRID} vertical={false} />
          <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: COR_TEXTO }} tickLine={false} axisLine={{ stroke: COR_GRID }} />
          <YAxis tick={{ fontSize: 11, fill: COR_TEXTO }} tickLine={false} axisLine={false} />
          <Tooltip content={<TooltipCustom unidade={unidade} />} />
          {yKeys.map((k, i) => (
            <Area key={k} type="monotone" dataKey={k} stroke={palette[i % palette.length]} strokeWidth={2} fill={`url(#grad-${k})`} />
          ))}
        </AreaChart>
      )}
    </ResponsiveContainer>
  );
}