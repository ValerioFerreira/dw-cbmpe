import React from "react";
import { useLocation } from "react-router-dom";
import { BarChart3 } from "lucide-react";

export default function EmConstrucao() {
  const { state } = useLocation();
  const titulo = state?.titulo;

  return (
    <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center animate-fade-in">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/8 text-primary">
        <BarChart3 className="h-7 w-7" />
      </div>
      {titulo && <p className="text-[13px] text-muted-foreground">{titulo}</p>}
      <p className="font-display text-xl font-semibold text-foreground">Em construção</p>
    </div>
  );
}
