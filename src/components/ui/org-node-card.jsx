import React from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Users } from "lucide-react";
import { CORES_TIPO, contarSubordinados } from "@/lib/cbmpe";
import { useCbmpe } from "@/lib/cbmpe-context";

export default function OrgNodeCard({ unidade, variant = "card" }) {
  const navigate = useNavigate();
  const { unidades } = useCbmpe();
  const cor = CORES_TIPO[unidade.tipo] || CORES_TIPO.diretoria;
  const filhos = contarSubordinados(unidades, unidade.id);

  if (variant === "compact") {
    return (
      <button
        onClick={() => navigate(`/diretoria/${unidade.id}`)}
        className="group flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-all hover:border-input hover:shadow-sm"
      >
        <span className="h-9 w-1.5 shrink-0 rounded-full bg-primary" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-foreground">{unidade.nome}</p>
          <p className="text-[11px] text-muted-foreground">{unidade.sigla} · {cor.label}</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
      </button>
    );
  }

  return (
    <div
      onClick={() => navigate(`/diretoria/${unidade.id}`)}
      className="group relative cursor-pointer overflow-hidden rounded-xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-input hover:shadow-md"
    >
      <span className="absolute left-0 top-0 h-full w-1 bg-primary" />
      <div className="flex items-start justify-between gap-2 pl-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{cor.label}</p>
          <h3 className="mt-1 truncate text-[14px] font-semibold text-foreground">{unidade.nome}</h3>
          {unidade.sigla && <p className="mt-0.5 text-[12px] text-muted-foreground">{unidade.sigla}</p>}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-4 pl-2 text-[11px] text-muted-foreground">
        {unidade.efetivo && (
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3" /> {unidade.efetivo.toLocaleString("pt-BR")}
          </span>
        )}
        {filhos > 0 && <span>{filhos} vinculada{filhos > 1 ? "s" : ""}</span>}
        <span className="ml-auto inline-flex items-center gap-1 font-medium text-foreground opacity-0 transition-opacity group-hover:opacity-100">
          Acessar <ChevronRight className="h-3 w-3" />
        </span>
      </div>
    </div>
  );
}