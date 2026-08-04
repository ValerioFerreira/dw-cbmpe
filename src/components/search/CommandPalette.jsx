import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, Network, LayoutDashboard, ChevronRight, Building2, FileBarChart, Bell
} from "lucide-react";
import { useCbmpe } from "@/lib/cbmpe-context";
import { CORES_TIPO, CATEGORIAS } from "@/lib/cbmpe";

export default function CommandPalette({ open, onClose }) {
  const { unidades, dashboards, alertas, porId } = useCbmpe();
  const [q, setQ] = useState("");
  const [indice, setIndice] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      setQ("");
      setIndice(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const resultados = useMemo(() => {
    const termo = q.trim().toLowerCase();
    if (!termo) {
      return {
        unidades: unidades.slice(0, 5),
        dashboards: dashboards.slice(0, 4),
        alertas: alertas.slice(0, 3),
      };
    }
    return {
      unidades: unidades.filter((u) =>
        (u.nome + " " + (u.sigla || "")).toLowerCase().includes(termo)).slice(0, 6),
      dashboards: dashboards.filter((d) =>
        (d.nome + " " + (d.descricao || "")).toLowerCase().includes(termo)).slice(0, 5),
      alertas: alertas.filter((a) => a.titulo.toLowerCase().includes(termo)).slice(0, 3),
    };
  }, [q, unidades, dashboards, alertas]);

  const flat = [
    ...resultados.unidades.map((u) => ({ tipo: "unidade", id: u.id, label: u.nome, sub: u.sigla, item: u })),
    ...resultados.dashboards.map((d) => ({ tipo: "dashboard", id: d.id, label: d.nome, sub: d.unidade_id, item: d })),
    ...resultados.alertas.map((a) => ({ tipo: "alerta", id: a.id, label: a.titulo, sub: a.severidade, item: a })),
  ];

  function selecionar(i) {
    const r = flat[i];
    if (!r) return;
    if (r.tipo === "unidade") navigate(`/diretoria/${r.id}`);
    else if (r.tipo === "dashboard") navigate(`/dashboard/${r.id}`);
    else navigate(`/diretoria/${r.item.unidade_id || ""}`);
    onClose();
  }

  function onKeyDown(e) {
    if (e.key === "ArrowDown") { e.preventDefault(); setIndice((i) => Math.min(i + 1, flat.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIndice((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); selecionar(indice); }
    else if (e.key === "Escape") onClose();
  }

  if (!open) return null;

  const nomeUnidade = (id) => porId[id]?.sigla || porId[id]?.nome || "—";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-foreground/20 backdrop-blur-sm pt-[12vh] px-4 animate-fade-in" onClick={onClose}>
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setIndice(0); }}
            onKeyDown={onKeyDown}
            placeholder="Buscar unidades, dashboards, indicadores, alertas..."
            className="flex-1 bg-transparent py-4 text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded border border-border bg-muted px-1.5 text-[10px] text-muted-foreground">ESC</kbd>
        </div>

        <div className="max-h-[52vh] overflow-y-auto scrollbar-thin p-2">
          {resultados.unidades.length > 0 && (
            <GrupoRotulo icon={Building2} label="Unidades Organizacionais" />
          )}
          {resultados.unidades.map((u, i) => (
            <ItemPaleta
              key={u.id} ativo={indice === i}
              onMouseEnter={() => setIndice(i)} onClick={() => selecionar(i)}
              icon={Network} cor={CORES_TIPO[u.tipo]?.dot}
              titulo={u.nome} sub={u.sigla ? `${u.sigla} · ${CORES_TIPO[u.tipo]?.label || u.tipo}` : CORES_TIPO[u.tipo]?.label}
            />
          ))}

          {resultados.dashboards.length > 0 && (
            <GrupoRotulo icon={LayoutDashboard} label="Dashboards" />
          )}
          {resultados.dashboards.map((d, i) => {
            const gi = resultados.unidades.length + i;
            return (
              <ItemPaleta
                key={d.id} ativo={indice === gi}
                onMouseEnter={() => setIndice(gi)} onClick={() => selecionar(gi)}
                icon={FileBarChart}
                titulo={d.nome} sub={`${nomeUnidade(d.unidade_id)} · ${CATEGORIAS[d.categoria]?.label || ""}`}
              />
            );
          })}

          {resultados.alertas.length > 0 && (
            <GrupoRotulo icon={Bell} label="Alertas" />
          )}
          {resultados.alertas.map((a, i) => {
            const gi = resultados.unidades.length + resultados.dashboards.length + i;
            return (
              <ItemPaleta
                key={a.id} ativo={indice === gi}
                onMouseEnter={() => setIndice(gi)} onClick={() => selecionar(gi)}
                icon={Bell} cor="bg-destructive"
                titulo={a.titulo} sub={a.severidade}
              />
            );
          })}

          {flat.length === 0 && (
            <div className="px-4 py-10 text-center text-[13px] text-muted-foreground">
              Nenhum resultado para "{q}"
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><kbd className="rounded border border-border bg-muted px-1">↑↓</kbd> navegar</span>
          <span className="flex items-center gap-1"><kbd className="rounded border border-border bg-muted px-1">↵</kbd> abrir</span>
          <span className="flex items-center gap-1"><kbd className="rounded border border-border bg-muted px-1">ESC</kbd> fechar</span>
        </div>
      </div>
    </div>
  );
}

function GrupoRotulo({ icon: Icon, label }) {
  return (
    <p className="mb-1 mt-3 flex items-center gap-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground first:mt-1">
      <Icon className="h-3 w-3" /> {label}
    </p>
  );
}

function ItemPaleta({ ativo, onMouseEnter, onClick, icon: Icon, cor, titulo, sub }) {
  return (
    <button
      onMouseEnter={onMouseEnter} onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
        ativo ? "bg-primary/8" : "hover:bg-muted"
      }`}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card">
        {cor ? <span className={`h-2 w-2 rounded-full ${cor}`} /> : <Icon className="h-4 w-4 text-muted-foreground" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`truncate text-[13px] font-medium ${ativo ? "text-primary" : "text-foreground"}`}>{titulo}</p>
        {sub && <p className="truncate text-[11px] text-muted-foreground">{sub}</p>}
      </div>
      <ChevronRight className={`h-4 w-4 shrink-0 ${ativo ? "text-primary" : "text-muted-foreground/40"}`} />
    </button>
  );
}