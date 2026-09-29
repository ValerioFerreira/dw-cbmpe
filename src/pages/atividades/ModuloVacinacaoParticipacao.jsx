import React, { useMemo, useState } from "react";
import { Syringe } from "lucide-react";
import { fmtNumero } from "@/lib/cbmpe";
import { serieCampo } from "@/lib/vacinacaoDashboard";
import { ordenarPorAntiguidadeOme, DOBRA_GABINETE } from "@/lib/antiguidadeOme";
import KpiCard from "@/components/ui/kpi-card";
import SectionCard from "@/components/ui/section-card";
import GaugeKpi from "@/components/charts/GaugeKpi";
import EmptyState from "@/components/ui/empty-state";
import efetivoLista from "@/data/efetivoLista"; // JSON embutido ou DW (ver o módulo)

// Aba "Indicador de participação" — 4º de 4 módulos (ver
// ModuloVacinacaoVisaoGeral.jsx para o racional do painel exclusivo da
// DAS). No protótipo era só a casca com 1 exemplo estático congelado — os
// filtros não recalculavam nada porque faltava dado bruto militar×vacina×
// OME (status_dashboard_vacinacoes.md, aba 04). Agora recalcula de verdade.
//
// Lógica corrigida em 2026-09-21 (pedido do usuário, após verificação): a
// OME da própria base de Vacinação NÃO tem granularidade histórica — é 1
// valor por militar, igual em todos os eventos dele, então não serve pra
// "onde ele estava quando tomou a vacina". Em vez disso:
//   - "Militares que tomaram" = militares que ESTÃO na OME selecionada
//     HOJE (efetivo_lista.json, cruzado por matrícula) e já tomaram a
//     vacina selecionada em QUALQUER momento/OME.
//   - "Efetivo Atual (OME)" = quantos militares a OME selecionada tem hoje.
//   - O percentual (agora um "acelerômetro" de KPI, não mais um número
//     solto) mostra: dos militares que estão na OME hoje, quantos já
//     tomaram essa vacina.
// O cruzamento em si é feito no EXTRATOR (nunca no navegador — ver
// extrair_participacao_atual em extract_dashboard_vacinacoes.py), então
// `participacao` já chega como matriz agregada (vacina, OME atual) →
// contagem; aqui só se faz o lookup.
//
// OMEs do seletor vêm de efetivo_lista.json (não mais das OMEs cruas da
// Vacinação): é o universo com que "Efetivo Atual" faz sentido — pedir o
// percentual de "INATIVOS" hoje não tem denominador nessa lógica nova.
//
// Único (não multi-select): permitir escolher VÁRIAS vacinas ou OMEs ao
// mesmo tempo somaria "militares distintos" de grupos que podem se
// sobrepor (a mesma pessoa tomou 2 vacinas), inflando o numerador — por
// isso aqui é <select> de escolha única, não o MultiSelectFiltro usado nos
// outros módulos.
// Efetivo atual de uma sigla, já com COMANDO GERAL/SUBCOMANDO GERAL
// fundidos em GCG/GSG (ver DOBRA_GABINETE em antiguidadeOme.js — mesma
// fusão usada na ordenação, espelhada aqui pro card "Efetivo Atual da OME"
// não subestimar GCG/GSG em 1 pessoa).
function efetivoAtualDe(sigla) {
  const base = (efetivoLista.por_unidade[sigla] || []).length;
  const origem = Object.keys(DOBRA_GABINETE).find((k) => DOBRA_GABINETE[k] === sigla);
  const extra = origem ? (efetivoLista.por_unidade[origem] || []).length : 0;
  return base + extra;
}

export default function ModuloVacinacaoParticipacao({ unidade, eventos, participacao }) {
  const vacinas = useMemo(() => serieCampo(eventos, "vacina").map((s) => s.label), [eventos]);
  // COMANDO GERAL/SUBCOMANDO GERAL não entram como opção própria — já
  // fundidos em GCG/GSG (mesma regra de efetivoAtualDe).
  const omes = useMemo(() => {
    const siglas = new Set(Object.keys(efetivoLista.por_unidade).map((s) => DOBRA_GABINETE[s] || s));
    return ordenarPorAntiguidadeOme([...siglas]);
  }, []);

  const [vacina, setVacina] = useState(vacinas[0] || "");
  const [ome, setOme] = useState("DAS");

  const matriz = useMemo(() => {
    const m = new Map();
    participacao.forEach((p) => m.set(`${p.vacina}::${p.ome}`, p.militares));
    return m;
  }, [participacao]);

  if (unidade?.sigla !== "DAS") {
    return (
      <EmptyState
        icon={Syringe}
        titulo="Disponível apenas na Diretoria de Assistência Social"
        descricao="O Dashboard de Vacinações é um painel próprio da DAS — não é filtrado por unidade, então só aparece ao visualizar a DAS (ou, por herança de acesso, para quem tem visibilidade sobre ela)."
      />
    );
  }

  const militaresVacinados = matriz.get(`${vacina}::${ome}`) || 0;
  const efetivoAtual = efetivoAtualDe(ome);

  return (
    <div className="space-y-5">
      <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-6 rounded-xl border border-primary/20 bg-primary/5 px-5 py-3.5">
        <label className="flex items-center gap-2 text-[13px] font-medium text-foreground">
          Selecione uma vacina:
          <select
            value={vacina}
            onChange={(e) => setVacina(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-[12px] font-semibold text-foreground"
          >
            {vacinas.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-[13px] font-medium text-foreground">
          Selecione uma OME:
          <select
            value={ome}
            onChange={(e) => setOme(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-[12px] font-semibold text-foreground"
          >
            {omes.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
      </div>

      <div className="mx-auto grid max-w-2xl grid-cols-3 gap-3">
        <KpiCard nome="Vacina Selecionada" valor={vacina} compacto />
        <KpiCard nome="Efetivo Atual da OME" valor={fmtNumero(efetivoAtual)} compacto />
        <KpiCard nome="Militares que tomaram" valor={fmtNumero(militaresVacinados)} destaque compacto />
      </div>

      {/* Mesma largura máxima dos 3 cards acima (max-w-2xl) — pedido do
          usuário, antes o card do velocímetro era mais estreito (max-w-md)
          e o SVG tinha um teto próprio de 280px que também foi removido
          (GaugeKpi.jsx) pra ele de fato crescer até essa largura. */}
      <div className="mx-auto max-w-2xl">
        <SectionCard titulo="Proporção de vacinados" subtitulo={`Porcentagem do efetivo atual da OME ${ome} que já se vacinou com a vacina ${vacina}`}>
          <GaugeKpi valor={militaresVacinados} maximo={efetivoAtual} />
        </SectionCard>
      </div>
    </div>
  );
}
