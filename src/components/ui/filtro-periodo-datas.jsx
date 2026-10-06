import React from "react";

// Período por data (De / Até) para os dashboards. Datas em "AAAA-MM-DD"; vazio = sem limite.
// Use `passaPeriodo` (dashboardHelpers.js) para aplicar nos registros.
export default function FiltroPeriodoDatas({ valor, onChange, min, max }) {
  const campo = "rounded-lg border border-border bg-card px-2 py-1 text-[12px] font-medium text-foreground";
  return (
    <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
      Período
      <input
        type="date" value={valor.de} min={min} max={valor.ate || max} className={campo} aria-label="Data inicial"
        onChange={(e) => onChange({ ...valor, de: e.target.value })}
      />
      <span>–</span>
      <input
        type="date" value={valor.ate} min={valor.de || min} max={max} className={campo} aria-label="Data final"
        onChange={(e) => onChange({ ...valor, ate: e.target.value })}
      />
    </label>
  );
}

export const PERIODO_VAZIO = { de: "", ate: "" };
