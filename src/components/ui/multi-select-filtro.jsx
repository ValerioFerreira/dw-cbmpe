import React, { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

// Filtro multi-seleção de página (não de coluna de tabela — ver
// FiltroColuna em filtro-coluna.jsx para esse outro caso). Convenção:
// selecionado vazio (Set) = sem filtro / todos os valores passam — mesma
// lógica do protótipo original do dashboard de Efetivo.
export default function MultiSelectFiltro({ label, valores, selecionado, onChange, buscavel = true }) {
  const [busca, setBusca] = useState("");

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return q ? valores.filter((v) => v.toLowerCase().includes(q)) : valores;
  }, [valores, busca]);

  function alternar(v) {
    const base = new Set(selecionado);
    if (base.has(v)) base.delete(v); else base.add(v);
    onChange(base);
  }

  const ativo = selecionado.size > 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[12px] font-medium transition-colors ${
            ativo ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          {label}
          {ativo && <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">{selecionado.size}</span>}
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        {buscavel && (
          <div className="border-b border-border p-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar..."
                className="h-8 w-full rounded-md border border-input bg-background pl-7 pr-2 text-[12px] outline-none focus:border-primary"
              />
            </div>
          </div>
        )}
        <div className="flex gap-3 border-b border-border px-2.5 py-1.5 text-[11px] font-medium text-primary">
          <button type="button" onClick={() => onChange(new Set(valores))}>Selecionar tudo</button>
          <button type="button" onClick={() => onChange(new Set())}>Limpar seleção</button>
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {visiveis.map((v) => (
            <label key={v} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[12px] hover:bg-muted/60">
              <Checkbox checked={selecionado.has(v)} onCheckedChange={() => alternar(v)} />
              <span className="truncate">{v}</span>
            </label>
          ))}
          {visiveis.length === 0 && <p className="px-2 py-3 text-center text-[11px] text-muted-foreground">Nenhum valor encontrado.</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
