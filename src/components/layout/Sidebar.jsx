import React, { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Network, Clock, ChevronRight, ChevronDown, ChevronLeft,
  Bell, X
} from "lucide-react";
import { useCbmpe } from "@/lib/cbmpe-context";

function NoArvore({ unidade, porId, nivel = 0, onNavigate }) {
  const [aberto, setAberto] = useState(nivel < 1);
  const filhos = unidade.filhos || [];
  const temFilhos = filhos.length > 0;

  return (
    <div>
      <div
        className="group flex items-center gap-1 rounded-md pr-2 transition-colors hover:bg-white/10"
        style={{ paddingLeft: nivel * 12 + 6 }}
      >
        <button
          onClick={(e) => { e.stopPropagation(); if (temFilhos) setAberto(!aberto); }}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded text-white/50 hover:text-white sm:h-6 sm:w-6 ${temFilhos ? "" : "opacity-0"}`}
        >
          {temFilhos && (aberto ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />)}
        </button>
        <button
          onClick={() => onNavigate(unidade.id)}
          className="flex flex-1 items-center gap-2 py-2 text-left sm:py-1.5"
        >
          <span className="truncate text-[13px] font-medium text-white/80 group-hover:text-white">
            {unidade.sigla || unidade.nome}
          </span>
        </button>
      </div>
      {temFilhos && aberto && (
        <div className="animate-fade-in">
          {filhos.map((f) => (
            <NoArvore key={f.id} unidade={f} porId={porId} nivel={nivel + 1} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({ collapsed, onToggleCollapse, mobileOpen = false, onCloseMobile }) {
  const { raizes, porId, recentes } = useCbmpe();
  const navigate = useNavigate();
  const recUnidades = recentes.map((id) => porId[id]).filter(Boolean);

  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : true
  );
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    const atualizar = () => setIsDesktop(mql.matches);
    mql.addEventListener("change", atualizar);
    window.addEventListener("resize", atualizar);
    return () => {
      mql.removeEventListener("change", atualizar);
      window.removeEventListener("resize", atualizar);
    };
  }, []);

  const recolhido = isDesktop && collapsed;

  // A posição/largura/transformação são resolvidas em JS (em vez de variantes
  // responsivas do Tailwind) para evitar ambiguidade de cascata entre a regra
  // base e a regra lg: quando ambas casam com a mesma especificidade.
  const posicaoClasse = isDesktop ? "relative" : "fixed inset-y-0 left-0";
  const larguraClasse = isDesktop ? (recolhido ? "w-[68px]" : "w-[264px]") : "w-[280px]";
  const transformClasse = isDesktop || mobileOpen ? "translate-x-0" : "-translate-x-full";

  const irPara = (id) => navigate(`/diretoria/${id}`);

  return (
    <>
      {mobileOpen && !isDesktop && (
        <div
          onClick={onCloseMobile}
          aria-hidden="true"
          className="fixed inset-0 z-30 bg-black/50"
        />
      )}
      <aside
        className={`no-print z-40 flex h-screen shrink-0 flex-col bg-[#970706] text-white transition-[transform,width] duration-300 ${posicaoClasse} ${larguraClasse} ${transformClasse}`}
      >
        {/* Logo */}
        <div className={`flex h-16 items-center gap-2.5 px-4 ${recolhido ? "justify-center" : ""}`}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/95 p-1 shadow-sm ring-1 ring-white/40">
            <img src="/brasao-cbmpe.png" alt="Brasão do CBMPE" className="h-full w-full object-contain" />
          </div>
          {!recolhido && (
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-[13px] font-semibold tracking-tight text-white">CBMPE</p>
              <p className="truncate text-[11px] font-normal text-white/60">Painel de Controle</p>
            </div>
          )}
          {/* Fechar (mobile/tablet) */}
          {!isDesktop && (
            <button
              onClick={onCloseMobile}
              aria-label="Fechar menu"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          )}
          {/* Recolher (desktop) */}
          {isDesktop && !recolhido && (
            <button
              onClick={onToggleCollapse}
              aria-label="Recolher menu"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
        </div>
        {isDesktop && recolhido && (
          <button
            onClick={onToggleCollapse}
            aria-label="Expandir menu"
            className="mx-auto mb-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}

        <div className="flex-1 overflow-y-auto scrollbar-thin px-2 py-3">
          {/* Main nav */}
          <nav className="space-y-0.5">
            <NavItem to="/organograma" icon={Network} label="Organograma" collapsed={recolhido} />
          </nav>

          {!recolhido && (
            <>
              <SectionLabel>Estrutura</SectionLabel>
              <div className="space-y-0.5">
                {raizes.map((r) => (
                  <NoArvore key={r.id} unidade={r} porId={porId} nivel={0} onNavigate={irPara} />
                ))}
              </div>
            </>
          )}

          {!recolhido && recUnidades.length > 0 && (
            <>
              <SectionLabel>
                <Clock className="h-3 w-3" /> Recentes
              </SectionLabel>
              <div className="space-y-0.5">
                {recUnidades.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => irPara(u.id)}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-[13px] text-white/70 transition-colors hover:bg-white/10 hover:text-white sm:py-1.5"
                  >
                    <Clock className="h-3 w-3 text-white/50" />
                    <span className="truncate">{u.sigla || u.nome}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {!recolhido && (
          <div className="border-t border-white/10 px-4 py-3">
            <button className="flex w-full items-center gap-2 text-[12px] text-white/70 hover:text-white">
              <Bell className="h-3.5 w-3.5" />
              <span>Central de Alertas</span>
            </button>
          </div>
        )}
      </aside>
    </>
  );
}

function NavItem({ to, icon: Icon, label, collapsed }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors sm:py-2 ${
          isActive
            ? "bg-white/15 text-white"
            : "text-white/70 hover:bg-white/10 hover:text-white"
        }`
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span>{label}</span>}
    </NavLink>
  );
}

function SectionLabel({ children }) {
  return (
    <p className="mb-1.5 mt-5 flex items-center gap-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/50">
      {children}
    </p>
  );
}
