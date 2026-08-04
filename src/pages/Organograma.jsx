import React, { useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Star, TrendingUp } from "lucide-react";
import { useCbmpe } from "@/lib/cbmpe-context";

// Layout fixo do organograma — replica fielmente a árvore validada pelo
// Comandante Geral no protótipo de referência (Power BI CBMPE - Organograma
// Interativo). Os nomes/cargos vêm dos dados (src/data/organograma.js); só a
// disposição visual dos blocos é fixa, pois reflete a estrutura oficial do CBMPE.
const ASSESSORIAS_COMANDO = ["GCG", "AECI", "CPO", "CCS", "CI"];
const ASSESSORIAS_SUBCOMANDO = ["GSG", "AJG", "CPP"];

const DGO_GRUPOS = [
  { diretoria: "DIM", filhos: ["GBAPH", "GBI", "GBS", "GBMar", "CAT/RMR"] },
  { diretoria: "DINTER I", filhos: ["1º GB", "2º GB", "6º GB", "7º GB", "CAT/ZM", "CAT/AG"] },
  { diretoria: "DINTER II", filhos: ["3º GB", "4º GB", "5º GB", "9º GB", "CAT/SE"] },
  { diretoria: "DIESP", filhos: [] },
];

const DGA_COLUNAS_EMPILHADAS = [
  ["DGP", "DVP", "DJD", "DPLAG"],
  ["DF", "DAS", "DTIC"],
];
const DGA_GRUPOS = [
  { diretoria: "DLOG", filhos: ["CMAN", "CINT", "CEAO"] },
  { diretoria: "DEIP", filhos: ["ABMG", "CEFD"] },
];

const KPIS_ATALHO = ["Efetivo", "Viaturas", "Materiais", "Finanças"];

export default function Organograma() {
  const { unidades, indicadores, loading } = useCbmpe();
  const navigate = useNavigate();

  const bySigla = useMemo(() => {
    const map = {};
    unidades.forEach((u) => { map[u.sigla] = u; });
    return map;
  }, [unidades]);

  const kpisComandoGeral = useMemo(() => {
    const cg = bySigla["COMANDO GERAL"];
    if (!cg) return {};
    const mapa = {};
    indicadores.filter((i) => i.unidade_id === cg.id).forEach((i) => { mapa[i.nome] = i; });
    return mapa;
  }, [indicadores, bySigla]);

  const goto = (sigla) => {
    const u = bySigla[sigla];
    if (u) navigate(`/diretoria/${u.id}`);
  };

  if (loading && unidades.length === 0) {
    return <div className="h-96 animate-pulse rounded-xl bg-muted/40" />;
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Sem min-width forçado: o organograma empilha naturalmente no mobile,
          igual à referência (index.html). O scroll horizontal só existe como
          rede de segurança para telas muito estreitas. */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card p-3 scrollbar-thin sm:p-6">
        <div className="mx-auto flex w-full max-w-[1520px] flex-col items-center gap-6 py-2 sm:gap-8">
          {/* ===== Comando Geral ===== */}
          <div className="flex w-full flex-col items-center">
            <div className="w-full max-w-md rounded-xl rounded-b-none border-2 border-amber-300 bg-gradient-to-br from-amber-500 via-amber-600 to-orange-700 p-3 text-center shadow-[0_8px_30px_-6px_rgba(217,119,6,0.35)]">
              <p className="text-base font-black uppercase tracking-wider text-white">CBMPE - Geral</p>
            </div>
            <div className="grid w-full max-w-md grid-cols-2 gap-2 rounded-xl rounded-t-none border border-t-0 border-border bg-muted/30 p-2 sm:grid-cols-4">
              {KPIS_ATALHO.map((nome) => {
                const kpi = kpisComandoGeral[nome];
                return (
                  <Link
                    key={nome}
                    to={kpi ? `/indicador/${kpi.id}` : "#"}
                    className="flex min-h-[2.75rem] items-center justify-center rounded-lg border border-border bg-card px-2 text-center text-xs font-bold text-foreground transition-colors hover:border-amber-500"
                  >
                    {nome}
                  </Link>
                );
              })}
            </div>

            <NoEstrela unidade={bySigla["COMANDO GERAL"]} tom="amber" onClick={() => goto("COMANDO GERAL")} />

            <LinhaAssessorias
              siglas={ASSESSORIAS_COMANDO}
              bySigla={bySigla}
              goto={goto}
              gridCols="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
              maxWidth="max-w-2xl"
              accent="amber"
            />
          </div>

          {/* ===== Subcomando Geral ===== */}
          <div className="flex w-full flex-col items-center">
            <NoEstrela unidade={bySigla["SUBCOMANDO GERAL"]} tom="yellow" onClick={() => goto("SUBCOMANDO GERAL")} />
            <LinhaAssessorias
              siglas={ASSESSORIAS_SUBCOMANDO}
              bySigla={bySigla}
              goto={goto}
              gridCols="grid-cols-3"
              maxWidth="max-w-md"
              accent="yellow"
            />
          </div>

          {/* ===== DGO x DGA ===== */}
          <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
            <div className="flex flex-col items-center rounded-2xl border border-border bg-muted/30 p-3 sm:p-4">
              <CardDiretoria unidade={bySigla["DGO"]} onClick={() => goto("DGO")} tamanho="lg" />
              <div className="mt-4 grid w-full grid-cols-2 gap-3 lg:grid-cols-4">
                {DGO_GRUPOS.map((g) => (
                  <GrupoDiretoria key={g.diretoria} grupo={g} bySigla={bySigla} goto={goto} />
                ))}
              </div>
            </div>

            <div className="flex flex-col items-center rounded-2xl border border-border bg-muted/30 p-3 sm:p-4">
              <CardDiretoria unidade={bySigla["DGA"]} onClick={() => goto("DGA")} tamanho="lg" />
              <div className="mt-4 grid w-full grid-cols-2 gap-2 lg:grid-cols-4">
                {DGA_COLUNAS_EMPILHADAS.map((col, idx) => (
                  <ColunaEmpilhada key={idx} siglas={col} bySigla={bySigla} goto={goto} />
                ))}
                {DGA_GRUPOS.map((g) => (
                  <GrupoDiretoria key={g.diretoria} grupo={g} bySigla={bySigla} goto={goto} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NoEstrela({ unidade, tom, onClick }) {
  if (!unidade) return null;
  const isAmber = tom === "amber";
  return (
    <button
      onClick={onClick}
      className={`relative z-10 mt-8 w-72 rounded-xl border-2 bg-gradient-to-br p-4 text-center transition-transform hover:-translate-y-1 hover:scale-[1.02] ${
        isAmber
          ? "border-amber-300 from-amber-500 via-amber-600 to-orange-700 shadow-[0_8px_30px_-6px_rgba(217,119,6,0.35)]"
          : "border-yellow-300 from-yellow-500 via-yellow-600 to-amber-700 shadow-[0_8px_30px_-6px_rgba(202,138,4,0.35)]"
      }`}
    >
      <div className="flex items-center justify-center gap-2">
        <Star className={`h-4 w-4 fill-current ${isAmber ? "text-amber-200" : "text-yellow-200"}`} />
        <p className="whitespace-nowrap text-lg font-black uppercase tracking-wider text-white">{unidade.nome}</p>
        <Star className={`h-4 w-4 fill-current ${isAmber ? "text-amber-200" : "text-yellow-200"}`} />
      </div>
      <p className={`mt-0.5 text-[11px] tracking-widest ${isAmber ? "text-amber-200" : "text-yellow-200"}`}>{unidade.responsavel} - {unidade.cargo}</p>
      <div className={`mt-2 inline-flex items-center gap-1 rounded-full bg-black/20 px-3 py-1 text-[10px] font-semibold ${isAmber ? "text-amber-100" : "text-yellow-100"}`}>
        <TrendingUp className="h-3 w-3" /> Detalhar
      </div>
    </button>
  );
}

function LinhaAssessorias({ siglas, bySigla, goto, gridCols, maxWidth, accent }) {
  const hoverBorder = accent === "yellow" ? "hover:border-yellow-500" : "hover:border-amber-500";
  return (
    <div className={`grid w-full ${maxWidth} ${gridCols} gap-2 rounded-xl rounded-t-none border border-t-0 border-border bg-muted/30 p-2`}>
      {siglas.map((sigla) => {
        const u = bySigla[sigla];
        if (!u) return null;
        return (
          <button
            key={sigla}
            onClick={() => goto(sigla)}
            className={`rounded-lg border border-border bg-card p-2 text-center transition-colors ${hoverBorder}`}
          >
            <p className="text-xs font-bold text-foreground">{sigla}</p>
            <p className="text-[9px] text-muted-foreground">{u.responsavel} - {u.cargo}</p>
          </button>
        );
      })}
    </div>
  );
}

function CardDiretoria({ unidade, onClick, tamanho = "col", tom = "solid" }) {
  if (!unidade) return null;
  const bg = tom === "solid" ? "bg-yellow-600" : tom === "soft90" ? "bg-yellow-600/90" : "bg-yellow-600/80";
  const isLg = tamanho === "lg";
  return (
    <button
      onClick={onClick}
      className={`${isLg ? "w-64 p-3" : "w-full p-2"} rounded-xl border-2 border-yellow-400 text-center shadow-md transition-transform hover:-translate-y-0.5 ${bg}`}
    >
      <p className={`font-black uppercase tracking-wider text-white ${isLg ? "text-base" : "text-xs"}`}>{unidade.sigla}</p>
      <p className={`text-yellow-100 ${isLg ? "mt-0.5 text-[10px] tracking-widest" : "text-[8px]"}`}>{unidade.responsavel} - {unidade.cargo}</p>
    </button>
  );
}

function ColunaEmpilhada({ siglas, bySigla, goto }) {
  return (
    <div className="space-y-2">
      {siglas.map((sigla) => {
        const u = bySigla[sigla];
        if (!u) return null;
        return <CardDiretoria key={sigla} unidade={u} onClick={() => goto(sigla)} tamanho="col" tom="soft80" />;
      })}
    </div>
  );
}

function GrupoDiretoria({ grupo, bySigla, goto }) {
  const u = bySigla[grupo.diretoria];
  if (!u) return null;
  return (
    <div className="flex flex-col items-center rounded-xl border border-border bg-muted/30 p-2">
      <CardDiretoria unidade={u} onClick={() => goto(grupo.diretoria)} tamanho="col" tom="soft90" />
      {grupo.filhos.length > 0 && (
        <div className="mt-2 w-full space-y-1.5">
          {grupo.filhos.map((sigla) => {
            const f = bySigla[sigla];
            if (!f) return null;
            return (
              <button
                key={sigla}
                onClick={() => goto(sigla)}
                className="w-full rounded border border-border bg-card p-1.5 text-center transition-colors hover:border-yellow-400"
              >
                <p className="text-[10px] font-bold text-foreground">{sigla}</p>
                <p className="text-[7px] text-muted-foreground">{f.responsavel} - {f.cargo}</p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
