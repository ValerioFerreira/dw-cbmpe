import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, ChevronRight, Home, FileDown, Menu, Network, LogOut, UserRound } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import { useAuth } from "@/lib/AuthContext";

export default function Topbar({ caminho = [], onOpenSearch, onOpenMobileNav, titulo }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleSair = () => {
    logout(false);
    navigate("/login");
  };

  const nomeExibido = user?.full_name || user?.id;

  return (
    <div className="no-print glass sticky top-0 z-30 flex flex-col border-b border-border">
      {/* ===================== Desktop ===================== */}
      {/* Três zonas flexíveis (flex-1 min-w-0), não grid-cols com track "auto"
          — a busca tinha largura fixa (w-80/xl:w-96) fora de uma coluna
          "auto" que ignorava o espaço realmente disponível; com o zoom
          global de 1.25 (index.css) + Sidebar ocupando espaço à esquerda, a
          coluna de ações (Tema/PDF/Sair, todas shrink-0) ficava espremida
          num track bem menor que seu conteúdo e vazava por cima da busca em
          larguras de notebook (~1280-1440px). Cada zona agora reparte o
          espaço igualmente e pode encolher de verdade. */}
      <header className="hidden h-20 items-center gap-2 px-5 lg:flex">
        {/* Esquerda: breadcrumb + bem-vindo */}
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
          {caminho.length > 0 && (
            <nav className="flex min-w-0 items-center gap-1.5 text-[13px]">
              <Link to="/organograma" className="shrink-0 text-muted-foreground transition-colors hover:text-foreground">
                <Home className="h-3.5 w-3.5" />
              </Link>
              {caminho.map((c, i) => (
                <React.Fragment key={c.id || i}>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                  {i === caminho.length - 1 ? (
                    <span className="truncate font-medium text-foreground">{c.sigla || c.nome}</span>
                  ) : (
                    <Link
                      to={c.to || `/diretoria/${c.id}`}
                      className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {c.sigla || c.nome}
                    </Link>
                  )}
                </React.Fragment>
              ))}
            </nav>
          )}

          {nomeExibido && (
            <div className="hidden shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 xl:flex">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <UserRound className="h-3.5 w-3.5" />
              </span>
              <span className="whitespace-nowrap text-[12px] text-muted-foreground">
                Bem-vindo, <span className="font-semibold text-foreground">{nomeExibido}</span>
              </span>
            </div>
          )}
        </div>

        {/* Centro: busca */}
        <div className="flex min-w-0 flex-1 justify-center px-2">
          <button
            onClick={onOpenSearch}
            aria-label="Buscar unidades, dashboards..."
            className="flex w-full min-w-0 max-w-xs items-center gap-2 rounded-full border-2 border-primary/25 bg-card px-4 py-2.5 text-primary shadow-sm transition-all hover:border-primary/50 hover:shadow-md 2xl:max-w-sm"
          >
            <Search className="h-4 w-4 shrink-0" />
            <span className="truncate text-[13px] text-muted-foreground">Buscar unidades, dashboards...</span>
          </button>
        </div>

        {/* Direita: ações */}
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          {titulo && <span className="hidden truncate text-[13px] font-medium text-muted-foreground 2xl:inline">{titulo}</span>}
          <ThemeToggle />
          <button
            onClick={() => window.print()}
            aria-label="Gerar PDF desta página"
            title="Gerar PDF desta página"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary text-[12px] font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 xl:w-auto xl:px-3"
          >
            <FileDown className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden whitespace-nowrap xl:inline">
              <span className="2xl:hidden">Gerar PDF</span>
              <span className="hidden 2xl:inline">Gerar PDF desta página</span>
            </span>
          </button>
          <button
            onClick={handleSair}
            aria-label="Sair"
            title="Sair"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border bg-card text-[12px] font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive xl:w-auto xl:px-3.5"
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden whitespace-nowrap xl:inline">Sair</span>
          </button>
        </div>
      </header>

      {/* ===================== Mobile ===================== */}
      <div className="flex flex-col gap-2 px-3 py-2 lg:hidden">
        {/* Linha única de ações: Org., Claro/Escuro, PDF, Usuário, Sair
            (o botão de menu abre a árvore de estrutura no drawer lateral). */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onOpenMobileNav}
            aria-label="Abrir menu"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Menu className="h-5 w-5" />
          </button>

          <Link
            to="/organograma"
            aria-label="Ir para o Organograma"
            className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg border border-border bg-card px-2 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Network className="h-4 w-4 shrink-0" />
            <span>Org.</span>
          </Link>

          <ThemeToggle />

          <button
            onClick={() => window.print()}
            aria-label="Gerar PDF desta página"
            title="Gerar PDF desta página"
            className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg bg-primary px-2 text-[12px] font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            <FileDown className="h-3.5 w-3.5 shrink-0" />
            <span>PDF</span>
          </button>

          {nomeExibido && (
            <span className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <UserRound className="h-3.5 w-3.5" />
              </span>
              <span className="truncate text-[12px] font-semibold text-foreground">{nomeExibido}</span>
            </span>
          )}

          <button
            onClick={handleSair}
            aria-label="Sair"
            title="Sair"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-4 w-4 shrink-0" />
          </button>
        </div>

        {/* Caixa de pesquisa logo abaixo */}
        <button
          onClick={onOpenSearch}
          aria-label="Buscar unidades, dashboards..."
          className="flex h-10 items-center gap-2 rounded-full border-2 border-primary/25 bg-card px-4 text-primary shadow-sm transition-colors hover:border-primary/50"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="truncate text-[13px] text-muted-foreground">Buscar unidades, dashboards...</span>
        </button>
      </div>
    </div>
  );
}
