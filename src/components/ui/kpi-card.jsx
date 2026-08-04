import React from "react";

export default function KpiCard({ nome, valor, extra, destaque = false, compacto = false }) {
  return (
    <div
      className={`group relative flex h-full flex-col justify-center gap-1.5 overflow-hidden rounded-xl border bg-card p-4 transition-all hover:shadow-md ${
        destaque ? "border-primary/20 shadow-sm" : "border-border"
      }`}
    >
      {destaque && <span className="absolute left-0 top-0 h-full w-0.5 bg-primary" />}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-medium text-muted-foreground line-clamp-2">{nome}</p>
        <p className={`shrink-0 font-display ${compacto ? "text-xl" : "text-[22px]"} font-semibold tracking-tight text-foreground leading-none`}>
          {valor}
        </p>
      </div>
      {extra && <p className="text-right text-[11px] text-muted-foreground">{extra}</p>}
    </div>
  );
}
