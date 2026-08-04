import React from "react";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";

export default function Sparkline({ data, trend = "estavel" }) {
  const cor = trend === "alta" ? "hsl(var(--chart-4))" : trend === "baixa" ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))";
  const id = `spark-${trend}-${Math.random().toString(36).slice(2, 7)}`;
  const chartData = data.map((v, i) => ({ i, v: Number(v) }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={cor} stopOpacity={0.25} />
            <stop offset="100%" stopColor={cor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis hide domain={["dataMin", "dataMax"]} />
        <Area type="monotone" dataKey="v" stroke={cor} strokeWidth={1.75} fill={`url(#${id})`} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}