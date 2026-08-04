import React from "react";
import { Link } from "react-router-dom";
import { Search, ChevronRight, Home, FileDown, Menu, Network } from "lucide-react";
import ThemeToggle from "./ThemeToggle";

export default function Topbar({ caminho = [], onOpenSearch, onOpenMobileNav, titulo }) {
  return (
    <div className="no-print glass sticky top-0 z-30 flex flex-col border-b border-border">
      <header className="flex h-16 items-center gap-2 px-3 lg:h-20 lg:gap-4 lg:px-5">
        <button
          onClick={onOpenMobileNav}
          aria-label="Abrir menu"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex flex-1 items-center gap-3 overflow-hidden">
          {caminho.length > 0 && (
            <nav className="hidden items-center gap-1.5 text-[13px] lg:flex">
              <Link to="/organograma" className="text-muted-foreground transition-colors hover:text-foreground">
                <Home className="h-3.5 w-3.5" />
              </Link>
              {caminho.map((c, i) => (
                <React.Fragment key={c.id || i}>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                  {i === caminho.length - 1 ? (
                    <span className="font-medium text-foreground">{c.sigla || c.nome}</span>
                  ) : (
                    <Link
                      to={c.to || `/diretoria/${c.id}`}
                      className="text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {c.sigla || c.nome}
                    </Link>
                  )}
                </React.Fragment>
              ))}
            </nav>
          )}
        </div>

        <button
          onClick={onOpenSearch}
          aria-label="Buscar unidades, dashboards..."
          className="hidden shrink-0 items-center gap-2 rounded-full border-2 border-primary/25 bg-card px-4 py-2.5 text-primary shadow-sm transition-all hover:border-primary/50 hover:shadow-md lg:flex lg:w-full lg:max-w-md lg:justify-start"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="truncate text-[13px] text-muted-foreground">Buscar unidades, dashboards...</span>
        </button>

        <div className="flex flex-1 items-center justify-end gap-1.5 lg:gap-2.5">
          {titulo && <span className="hidden text-[13px] font-medium text-muted-foreground lg:inline">{titulo}</span>}
          <Link
            to="/organograma"
            aria-label="Ir para o Organograma"
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
          >
            <Network className="h-4 w-4" />
            <span>Organograma</span>
          </Link>
          <ThemeToggle />
          <button
            onClick={() => window.print()}
            aria-label="Gerar PDF desta página"
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-2.5 text-[12px] font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 lg:px-3.5 lg:py-2.5"
          >
            <FileDown className="h-3.5 w-3.5 shrink-0" />
            <span className="lg:hidden">PDF</span>
            <span className="hidden lg:inline">Gerar PDF desta página</span>
          </button>
        </div>
      </header>

      <button
        onClick={onOpenSearch}
        aria-label="Buscar unidades, dashboards..."
        className="mx-3 mb-2.5 flex h-10 items-center gap-2 rounded-full border-2 border-primary/25 bg-card px-4 text-primary shadow-sm transition-colors hover:border-primary/50 lg:hidden"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="truncate text-[13px] text-muted-foreground">Buscar unidades, dashboards...</span>
      </button>
    </div>
  );
}
