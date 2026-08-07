import React from "react";

export default function KpiCard({ nome, valor, extra, destaque = false, compacto = false }) {
  const valorLongo = typeof valor === "string" && valor.length > 8;
  const tamanhoValor = valorLongo ? "text-[15px]" : compacto ? "text-xl" : "text-[22px]";

  return (
    <div
      className={`group relative flex h-full flex-col justify-center gap-1.5 overflow-hidden rounded-xl border bg-card p-4 transition-all hover:shadow-md ${
        destaque ? "border-primary/20 shadow-sm" : "border-border"
      }`}
    >
      {destaque && <span className="absolute left-0 top-0 h-full w-0.5 bg-primary" />}
      <p className="truncate text-[13px] font-medium text-muted-foreground">{nome}</p>
      <p className={`font-display ${tamanhoValor} font-semibold tracking-tight text-foreground leading-tight`}>
        {valor}
      </p>
      {extra && <p className="text-[11px] text-muted-foreground">{extra}</p>}
    </div>
  );
}
