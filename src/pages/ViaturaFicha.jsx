import React from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ChevronLeft, Car, Gauge, Fuel, Info } from "lucide-react";
import SectionCard from "@/components/ui/section-card";
import EmptyState from "@/components/ui/empty-state";
import BadgeSituacao from "@/components/ui/badge-situacao";
import viaturasDetalhe from "@/data/real/viaturas_detalhe.json";

function fmtSimNao(v) {
  if (v === null || v === undefined) return "—";
  return v ? "Sim" : "Não";
}

function fmtMoeda(v) {
  if (v === null || v === undefined) return "—";
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtData(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

function fmtKm(v) {
  if (v === null || v === undefined) return "—";
  return `${Number(v).toLocaleString("pt-BR")} Km`;
}

function Campo({ rotulo, valor, nota }) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2">
      <p className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {rotulo}
        {nota && (
          <span title={nota}>
            <Info className="h-2.5 w-2.5 text-muted-foreground/60" />
          </span>
        )}
      </p>
      <p className="mt-0.5 truncate text-[13px] font-medium text-foreground">{valor ?? "—"}</p>
    </div>
  );
}

function Widget({ icone: Icone, rotulo, valor, sub }) {
  return (
    <div className="flex-1 rounded-xl border border-border bg-card px-4 py-3">
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icone className="h-3.5 w-3.5" /> {rotulo}
      </p>
      <p className="mt-1 font-display text-[20px] font-semibold tracking-tight text-foreground">{valor}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default function ViaturaFicha() {
  const { placa } = useParams();
  const navigate = useNavigate();
  const ficha = viaturasDetalhe.por_placa?.[placa];

  return (
    <div className="space-y-3 animate-fade-in">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> Voltar
      </button>

      {!ficha ? (
        <EmptyState
          icon={Car}
          titulo="Detalhamento pendente de sincronização"
          descricao={`A ficha completa da viatura ${placa} depende de uma extensão da sincronização Frota → Neon que ainda não foi publicada/rodada (ver DW_PLANEJAMENTO.md).`}
          acao={<Link to="/organograma" className="text-[13px] font-medium text-primary hover:underline">Voltar ao organograma</Link>}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/8 text-primary">
              <Car className="h-6 w-6" />
            </div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">{ficha.nome || placa}</h1>
              <BadgeSituacao situacao={ficha.situacao} />
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Widget icone={Gauge} rotulo="Odômetro" valor={fmtKm(ficha.odometro)} />
            <Widget
              icone={Fuel}
              rotulo="Último Abastecimento"
              valor={fmtMoeda(ficha.ultimoAbastecimentoValor)}
              sub={fmtData(ficha.ultimoAbastecimentoData)}
            />
          </div>

          <SectionCard titulo="Resumo">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <Campo rotulo="OME" valor={ficha.ome} />
              <Campo rotulo="Posse" valor={ficha.posse} />
              <Campo rotulo="Tipo" valor={ficha.tipoAcronym} />
              <Campo rotulo="Nº de Ordem" valor={ficha.numeroOrdem} />
              <Campo rotulo="Tipo de Combustível" valor={ficha.combustivel} />
              <Campo rotulo="Ano" valor={ficha.ano} />
              <Campo rotulo="Marca" valor={ficha.marca} />
              <Campo rotulo="Placa" valor={placa} />
              <Campo rotulo="Modelo" valor={ficha.modelo} />
            </div>
          </SectionCard>

          <SectionCard titulo="Outros">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <Campo rotulo="Nº do Patrimônio" valor={ficha.patrimonio} />
              <Campo rotulo="Renavam" valor={ficha.renavam} />
              <Campo rotulo="Destinação" valor={ficha.destinacao} />
              <Campo rotulo="Rastreado?" valor={fmtSimNao(ficha.rastreado)} />
              <Campo rotulo="Chassis" valor={ficha.chassis} />
              <Campo rotulo="Caracterizado?" valor={fmtSimNao(ficha.caracterizado)} />
              <Campo rotulo="Condutores" valor="—" />
              <Campo rotulo="Categoria de Habilitação" valor={ficha.categoriaHabilitacao} />
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}
