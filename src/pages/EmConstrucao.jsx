import React from "react";
import { BarChart3 } from "lucide-react";

export default function EmConstrucao() {
  return (
    <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center animate-fade-in">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/8 text-primary">
        <BarChart3 className="h-7 w-7" />
      </div>
      <p className="font-display text-xl font-semibold text-foreground">Em construção</p>
    </div>
  );
}
