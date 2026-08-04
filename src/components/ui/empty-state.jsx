import React from "react";

export default function EmptyState({ icon: Icon, titulo, descricao, acao }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
      {Icon && (
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-card text-muted-foreground border border-border">
          <Icon className="h-5 w-5" />
        </div>
      )}
      <p className="text-[14px] font-medium text-foreground">{titulo}</p>
      {descricao && <p className="mt-1 max-w-sm text-[12px] text-muted-foreground">{descricao}</p>}
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  );
}