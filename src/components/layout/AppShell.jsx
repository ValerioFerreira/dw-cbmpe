import React, { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import CommandPalette from "@/components/search/CommandPalette";
import LobGuard from "./LobGuard";
import AvisoSnapshot from "./AvisoSnapshot";
import { useCbmpe } from "@/lib/cbmpe-context";
import { getCaminho } from "@/lib/cbmpe";

export default function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { unidades } = useCbmpe();
  const location = useLocation();

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // breadcrumbs a partir da URL
  const match = location.pathname.match(/^\/diretoria\/(.+)$/);
  const unidadeId = match ? match[1] : null;
  const caminho = unidadeId ? getCaminho(unidades, unidadeId) : [];

  const breadcrumbs = caminho.map((c, i) => ({
    id: c.id, nome: c.nome, sigla: c.sigla, to: i < caminho.length - 1 ? `/diretoria/${c.id}` : null,
  }));

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((v) => !v)}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar
          caminho={breadcrumbs}
          onOpenSearch={() => setSearchOpen(true)}
          onOpenMobileNav={() => setMobileNavOpen(true)}
        />
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="mx-auto w-full max-w-[1900px] px-4 py-5 sm:px-6 sm:py-7 lg:px-12">
            <LobGuard />
            <AvisoSnapshot />
            <Outlet />
          </div>
        </main>
      </div>
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}