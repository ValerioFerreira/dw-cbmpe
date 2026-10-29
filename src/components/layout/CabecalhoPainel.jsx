import React from "react";
import { Link } from "react-router-dom";
import { ChevronRight, ArrowLeft } from "lucide-react";

// Breadcrumb + título + "voltar" das páginas de Mapa de Força e Ocorrências, nas
// duas entradas (unidade ou "CBMPE - Geral") — ver usePainelOperacional.
// `trilha`: [{ rotulo, para? }] depois da unidade (o último item fica sem link).
export default function CabecalhoPainel({ geral, caminho, trilha, titulo, subtitulo, voltarPara }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-muted-foreground">
        <Link to="/organograma" className="hover:text-foreground">Organograma</Link>
        <ChevronRight className="h-3 w-3" />
        {geral ? (
          <span className="inline-flex items-center gap-1.5">
            <span>CBMPE - Geral</span>
            <ChevronRight className="h-3 w-3" />
          </span>
        ) : (
          caminho.map((c) => (
            <span key={c.id} className="inline-flex items-center gap-1.5">
              <Link to={`/diretoria/${c.id}`} className="hover:text-foreground">{c.sigla || c.nome}</Link>
              <ChevronRight className="h-3 w-3" />
            </span>
          ))
        )}
        {trilha.map((t, i) => (
          <span key={t.rotulo} className="inline-flex items-center gap-1.5">
            {t.para && i < trilha.length - 1
              ? <Link to={t.para} className="hover:text-foreground">{t.rotulo}</Link>
              : <span className="text-foreground">{t.rotulo}</span>}
            {i < trilha.length - 1 && <ChevronRight className="h-3 w-3" />}
          </span>
        ))}
      </div>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">{titulo}</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{subtitulo}</p>
        </div>
        <Link
          to={voltarPara}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[12px] text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> voltar
        </Link>
      </div>
    </>
  );
}
