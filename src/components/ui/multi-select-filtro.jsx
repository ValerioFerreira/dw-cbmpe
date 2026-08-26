import React, { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import usePosicaoAncorada from "@/lib/usePosicaoAncorada";

// Filtro multi-seleção de página (não de coluna de tabela — ver
// FiltroColuna em filtro-coluna.jsx para esse outro caso). Convenção:
// selecionado vazio (Set) = sem filtro / todos os valores passam — mesma
// lógica do protótipo original do dashboard de Efetivo.
//
// Usava o Popover do Radix até 2026-08-26, quando o balão foi flagrado
// abrindo longe do botão. Causa medida no navegador: o Radix posiciona por
// `transform: translate(x, y)` com pixels reais, dentro do <html> que tem
// `zoom: 1.25` — o navegador multiplica de novo, e o erro vira 25% da
// distância até o canto superior esquerdo. Trocado pelo posicionamento
// manual de usePosicaoAncorada, o mesmo que FiltroColuna já usava.

const LARGURA_PAINEL = 256;

export default function MultiSelectFiltro({ label, valores, selecionado, onChange, buscavel = true }) {
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);
  const gatilhoRef = useRef(null);
  const painelRef = useRef(null);

  const fechar = React.useCallback(() => setAberto(false), []);
  const { pos } = usePosicaoAncorada({
    aberto, gatilhoRef, painelRef, largura: LARGURA_PAINEL, aoFechar: fechar,
  });

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
    <>
      <button
        ref={gatilhoRef}
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[12px] font-medium transition-colors ${
          ativo ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
      >
        {label}
        {ativo && <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">{selecionado.size}</span>}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${aberto ? "rotate-180" : ""}`} />
      </button>

      {aberto && createPortal(
        <div
          ref={painelRef}
          style={{ position: "fixed", top: pos.top, left: pos.left, width: LARGURA_PAINEL }}
          className="z-50 rounded-md border border-border bg-popover text-popover-foreground shadow-md"
        >
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
        </div>,
        document.body
      )}
    </>
  );
}
