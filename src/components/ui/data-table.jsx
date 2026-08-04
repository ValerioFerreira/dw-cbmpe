import React, { useMemo, useState } from "react";
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Download, ChevronLeft, ChevronRight } from "lucide-react";

export default function DataTable({ colunas, dados, buscavel = true, exportavel = true, paginaTamanho = 8 }) {
  const [busca, setBusca] = useState("");
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [pagina, setPagina] = useState(0);

  const filtrados = useMemo(() => {
    if (!busca) return dados;
    const t = busca.toLowerCase();
    return dados.filter((r) =>
      colunas.some((c) => String(r[c.key] ?? "").toLowerCase().includes(t))
    );
  }, [busca, dados, colunas]);

  const ordenados = useMemo(() => {
    if (!sortKey) return filtrados;
    return [...filtrados].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number") return sortDir === "asc" ? av - bv : bv - av;
      return sortDir === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }, [filtrados, sortKey, sortDir]);

  const totalPaginas = Math.ceil(ordenados.length / paginaTamanho);
  const paginaAtual = Math.min(pagina, Math.max(0, totalPaginas - 1));
  const visiveis = ordenados.slice(paginaAtual * paginaTamanho, (paginaAtual + 1) * paginaTamanho);

  function toggleSort(k) {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("asc"); }
  }

  function exportar() {
    const headers = colunas.map((c) => c.label || c.key).join(",");
    const rows = ordenados.map((r) =>
      colunas.map((c) => `"${String(r[c.key] ?? "").replace(/"/g, '""')}"`).join(",")
    );
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "exportacao.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {(buscavel || exportavel) && (
        <div className="flex items-center gap-3 border-b border-border px-4 py-2.5">
          {buscavel && (
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={busca}
                onChange={(e) => { setBusca(e.target.value); setPagina(0); }}
                placeholder="Filtrar..."
                className="w-full rounded-lg border border-border bg-muted/30 py-1.5 pl-8 pr-3 text-[12px] outline-none focus:border-input focus:bg-card"
              />
            </div>
          )}
          {exportavel && (
            <button
              onClick={exportar}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Download className="h-3.5 w-3.5" /> Exportar
            </button>
          )}
        </div>
      )}

      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {colunas.map((c) => (
                <th
                  key={c.key}
                  onClick={() => c.sortable !== false && toggleSort(c.key)}
                  className={`px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground ${c.sortable !== false ? "cursor-pointer select-none" : ""} ${c.align === "right" ? "text-right" : ""}`}
                >
                  <span className="inline-flex items-center gap-1">
                    {c.label || c.key}
                    {c.sortable !== false && (
                      sortKey === c.key
                        ? (sortDir === "asc" ? <ArrowUp className="h-3 w-3 text-foreground" /> : <ArrowDown className="h-3 w-3 text-foreground" />)
                        : <ArrowUpDown className="h-3 w-3 text-muted-foreground/40" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visiveis.map((r, i) => (
              <tr key={i} className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/30">
                {colunas.map((c) => (
                  <td key={c.key} className={`px-4 py-3 ${c.align === "right" ? "text-right tabular-nums" : ""} ${c.mono ? "font-mono text-[12px]" : ""} ${c.destaque ? "font-medium text-foreground" : "text-foreground/80"}`}>
                    {c.render ? c.render(r) : r[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {visiveis.length === 0 && (
        <div className="px-4 py-10 text-center text-[12px] text-muted-foreground">Nenhum registro encontrado.</div>
      )}

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-[12px] text-muted-foreground">
          <span>{ordenados.length} registros</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPagina((p) => Math.max(0, p - 1))} disabled={paginaAtual === 0}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card disabled:opacity-40 hover:bg-muted">
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="px-2 tabular-nums">{paginaAtual + 1} / {totalPaginas}</span>
            <button onClick={() => setPagina((p) => Math.min(totalPaginas - 1, p + 1))} disabled={paginaAtual >= totalPaginas - 1}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card disabled:opacity-40 hover:bg-muted">
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}