import React, { useMemo } from "react";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Cell, LabelList, Legend
} from "recharts";

const COR_PRIMARIA = "hsl(var(--primary))";
const COR_CINZA = "hsl(var(--muted-foreground))";
const COR_ACENTO = "hsl(var(--accent))";
const COR_GRID = "hsl(var(--border))";
const COR_TEXTO = "hsl(var(--muted-foreground))";

// Paleta padrão: vermelho (marca) + cinza como par de 2 cores — laranja
// (--accent) só entra como 3ª cor em diante, nunca como a 2ª (pedido do
// usuário: evitar laranja em distinções de apenas 2 categorias).
const PALETA_PADRAO = [COR_PRIMARIA, COR_CINZA, COR_ACENTO, "hsl(var(--chart-3))", "hsl(var(--chart-4))"];

function fmtRotulo(v) {
  return typeof v === "number" ? v.toLocaleString("pt-BR") : v;
}

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

export default function PanelGrafico({
  tipo = "bar", data, xKey = "label", yKeys = ["valor"], altura = 240, unidade, cores, stacked = false,
  aoClicarBarra, legenda = false,
}) {
  const palette = useMemo(() => cores || PALETA_PADRAO, [cores]);
  const clicavel = typeof aoClicarBarra === "function";

  const margemBase = { top: 8, right: legenda ? 96 : 8, bottom: 0, left: -16 };
  const propsComuns = { data, margin: margemBase };

  const eixoX = (
    <XAxis
      dataKey={xKey}
      tick={{ fontSize: 11, fill: COR_TEXTO }}
      tickLine={false}
      axisLine={{ stroke: COR_GRID }}
      interval={0}
      angle={-35}
      textAnchor="end"
      height={64}
    />
  );

  return (
    <ResponsiveContainer width="100%" height={altura}>
      {tipo === "bar" ? (
        <BarChart {...propsComuns} margin={{ ...margemBase, top: 24, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={COR_GRID} vertical={false} />
          {eixoX}
          <YAxis tick={{ fontSize: 11, fill: COR_TEXTO }} tickLine={false} axisLine={false} />
          <Tooltip content={<TooltipCustom unidade={unidade} />} cursor={{ fill: "hsl(var(--muted))" }} />
          {legenda && <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: 12 }} />}
          {yKeys.map((k, i) => (
            <Bar
              key={k}
              dataKey={k}
              stackId={stacked ? "a" : undefined}
              radius={[3, 3, 0, 0]}
              maxBarSize={42}
              isAnimationActive={false}
              cursor={clicavel ? "pointer" : undefined}
              onClick={clicavel ? (pontoDado) => aoClicarBarra(pontoDado?.payload || pontoDado, k) : undefined}
            >
              {data.map((_, idx) => <Cell key={idx} fill={palette[i % palette.length]} />)}
              <LabelList dataKey={k} position="top" formatter={fmtRotulo} style={{ fontSize: 10, fill: "hsl(var(--foreground))" }} />
            </Bar>
          ))}
        </BarChart>
      ) : tipo === "hbar" ? (
        // Barras horizontais rankeadas — categoria no eixo Y, valor no eixo X
        // (ex. "Ingresso de militares" por ano, painel 07). Altura precisa
        // escalar com o nº de categorias pra cada barra não ficar espremida.
        <BarChart {...propsComuns} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={COR_GRID} horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: COR_TEXTO }} tickLine={false} axisLine={{ stroke: COR_GRID }} />
          <YAxis type="category" dataKey={xKey} tick={{ fontSize: 11, fill: COR_TEXTO }} tickLine={false} axisLine={false} width={56} />
          <Tooltip content={<TooltipCustom unidade={unidade} />} cursor={{ fill: "hsl(var(--muted))" }} />
          {yKeys.map((k, i) => (
            <Bar
              key={k}
              dataKey={k}
              radius={[0, 3, 3, 0]}
              maxBarSize={18}
              isAnimationActive={false}
              cursor={clicavel ? "pointer" : undefined}
              onClick={clicavel ? (pontoDado) => aoClicarBarra(pontoDado?.payload || pontoDado, k) : undefined}
            >
              {data.map((_, idx) => <Cell key={idx} fill={palette[i % palette.length]} />)}
              <LabelList dataKey={k} position="right" formatter={fmtRotulo} style={{ fontSize: 10, fill: "hsl(var(--foreground))" }} />
            </Bar>
          ))}
        </BarChart>
      ) : tipo === "line" ? (
        <LineChart {...propsComuns}>
          <CartesianGrid strokeDasharray="3 3" stroke={COR_GRID} vertical={false} />
          {eixoX}
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
          {eixoX}
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
