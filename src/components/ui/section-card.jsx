import React from "react";
import { MoreHorizontal } from "lucide-react";

export default function SectionCard({ titulo, subtitulo, acoes, children, className = "", semPadding = false }) {
  return (
    <section className={`overflow-hidden rounded-xl border border-border bg-card ${className}`}>
      {(titulo || acoes) && (
        <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <div className="min-w-0">
            {titulo && <h3 className="text-[14px] font-semibold tracking-tight text-foreground">{titulo}</h3>}
            {subtitulo && <p className="mt-0.5 text-[12px] text-muted-foreground">{subtitulo}</p>}
          </div>
          {acoes && <div className="flex items-center gap-2">{acoes}</div>}
        </header>
      )}
      <div className={semPadding ? "" : "p-5"}>{children}</div>
    </section>
  );
}

export function CardHeaderAction({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {children || <MoreHorizontal className="h-4 w-4" />}
    </button>
  );
}