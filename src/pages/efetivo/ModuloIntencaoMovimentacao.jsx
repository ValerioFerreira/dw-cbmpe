import React, { useMemo, useState } from "react";
import { fmtNumero } from "@/lib/cbmpe";
import SectionCard from "@/components/ui/section-card";
import KpiCard from "@/components/ui/kpi-card";
import PanelGrafico from "@/components/charts/PanelGrafico";
import EmptyState from "@/components/ui/empty-state";
import MultiSelectFiltro from "@/components/ui/multi-select-filtro";
import { ShieldAlert, DatabaseZap } from "lucide-react";
import { usePainelDw } from "@/lib/usePainelDw";

// Painel 09 — Intenção de Movimentação (pedidos de transferência e as atendidas).
//
// Fonte: DW (marts.painel_cim_pedido / painel_cim_atendido, a partir das
// planilhas CIM carregadas no flow dw_diario), via GET /dados/painel/
// movimentacao. Cada linha é uma solicitação, SEM matrícula nem nome
// (DW_GOVERNANCA.md); agregações e filtros são feitos aqui.
//
// As consultas dos cards "Distribuição das solicitações" (top 10 OMEs pela soma
// das três opções) e "Origem das solicitações" (por OME atual do solicitante)
// são as do Metabase, enviadas pelo usuário em 2026-09-29, com os filtros
// Categoria e Motivo. Os filtros valem para as solicitações; as transferências
// atendidas aparecem sem filtro.
//
// Sem drill-down para a tabela de Efetivo: as siglas de OME das planilhas vêm
// sem espaço ("1ºGB"), diferente do organograma ("1º GB"), e o grão é outro —
// a planilha inclui militares já na reserva (posto "RR").
const SEM_DADOS = { pedidos: [], atendidos: [] };
const VAZIO = new Set();

const contar = (linhas, campo) => {
  const mapa = new Map();
  linhas.forEach((l) => {
    const v = l[campo];
    if (v == null) return;
    mapa.set(v, (mapa.get(v) || 0) + 1);
  });
  return [...mapa.entries()].map(([label, valor]) => ({ label, valor })).sort((a, b) => b.valor - a.valor);
};

const OPCOES = [["opcao_1", "1ª opção"], ["opcao_2", "2ª opção"], ["opcao_3", "3ª opção"]];

// Top N OMEs pela soma das três opções, com a quebra por opção (ordem do Metabase).
function distribuicaoPorOpcao(pedidos, limite) {
  const por = new Map();
  pedidos.forEach((p) => OPCOES.forEach(([campo, rotulo]) => {
    const ome = p[campo];
    if (ome == null) return;
    if (!por.has(ome)) por.set(ome, { label: ome, "1ª opção": 0, "2ª opção": 0, "3ª opção": 0, total: 0 });
    const linha = por.get(ome);
    linha[rotulo] += 1;
    linha.total += 1;
  }));
  return [...por.values()].sort((a, b) => b.total - a.total).slice(0, limite);
}

export default function ModuloIntencaoMovimentacao({ escopoTotal }) {
  const dw = usePainelDw("movimentacao", SEM_DADOS, escopoTotal);
  const [categorias, setCategorias] = useState(VAZIO);
  const [motivos, setMotivos] = useState(VAZIO);

  const opcoesCategoria = useMemo(() => [...new Set(dw.pedidos.map((p) => p.categoria).filter(Boolean))].sort(), [dw]);
  const opcoesMotivo = useMemo(() => [...new Set(dw.pedidos.map((p) => p.motivo).filter(Boolean))].sort(), [dw]);

  const pedidos = useMemo(
    () => dw.pedidos.filter((p) => (!categorias.size || categorias.has(p.categoria)) && (!motivos.size || motivos.has(p.motivo))),
    [dw, categorias, motivos]
  );

  const opcao1Data = useMemo(() => contar(pedidos, "opcao_1"), [pedidos]);
  const top5Data = useMemo(() => distribuicaoPorOpcao(pedidos, 5).map(({ label, total }) => ({ label, valor: total })), [pedidos]);
  const distribuicaoData = useMemo(() => distribuicaoPorOpcao(pedidos, 10), [pedidos]);
  const origemData = useMemo(() => contar(pedidos, "ome_atual"), [pedidos]);
  const postoPedidosData = useMemo(() => contar(pedidos, "posto_grad"), [pedidos]);
  const omeAtendidosData = useMemo(() => contar(dw.atendidos, "ome_atual"), [dw]);
  const postoAtendidosData = useMemo(() => contar(dw.atendidos, "posto_grad"), [dw]);

  // Fonte inteiramente agregada no nível da corporação, sem quebra por unidade
  // que dê para restringir à unidade sendo visualizada — só faz sentido na
  // visão total (Comando Geral); para qualquer outra unidade seria dado fora da
  // competência dela. O servidor também só entrega a quem vê o Efetivo de todas.
  if (!escopoTotal) {
    return (
      <EmptyState
        icon={ShieldAlert}
        titulo="Disponível apenas para o Comando Geral"
        descricao="Este painel usa uma fonte agregada no nível da corporação inteira, sem quebra por unidade — não é possível restringi-lo à unidade sendo visualizada."
      />
    );
  }

  if (dw.pedidos.length === 0 && dw.atendidos.length === 0) {
    return (
      <EmptyState
        icon={DatabaseZap}
        titulo="Sem dados de Intenção de Movimentação"
        descricao="Este painel é lido do DW pelo servidor do app (login SGU). Entre com a conta SGU e confirme que o backend alcança o DW e que as planilhas CIM foram carregadas."
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <MultiSelectFiltro label="Categoria" valores={opcoesCategoria} selecionado={categorias} onChange={setCategorias} />
        <MultiSelectFiltro label="Motivo" valores={opcoesMotivo} selecionado={motivos} onChange={setMotivos} />
        <span className="text-[11px] text-muted-foreground">Os filtros valem para as solicitações.</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard nome="Total de Solicitações" valor={fmtNumero(pedidos.length)} destaque />
        <KpiCard nome="Transferências Atendidas" valor={fmtNumero(dw.atendidos.length)} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard titulo="Distribuição das OMEs solicitadas como 1ª opção">
          <PanelGrafico tipo="bar" data={opcao1Data} xKey="label" yKeys={["valor"]} altura={280} />
        </SectionCard>
        <SectionCard titulo="As 5 OMEs mais solicitadas em todas as opções">
          <PanelGrafico tipo="bar" data={top5Data} xKey="label" yKeys={["valor"]} altura={280} />
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard titulo="Distribuição das solicitações" subtitulo="As 10 OMEs mais pedidas, por opção (1ª, 2ª e 3ª).">
          <PanelGrafico
            tipo="hbar" data={distribuicaoData} xKey="label" yKeys={["1ª opção", "2ª opção", "3ª opção"]}
            stacked legenda altura={320}
          />
        </SectionCard>
        <SectionCard titulo="Origem das solicitações" subtitulo="Unidade atual do solicitante.">
          <PanelGrafico tipo="bar" data={origemData} xKey="label" yKeys={["valor"]} altura={280} />
        </SectionCard>
      </div>

      <SectionCard titulo="Solicitações por Posto e Graduação">
        <PanelGrafico tipo="bar" data={postoPedidosData} xKey="label" yKeys={["valor"]} altura={260} />
      </SectionCard>

      <SectionCard titulo="Distribuição de Militares Transferidos por OME">
        <PanelGrafico tipo="bar" data={omeAtendidosData} xKey="label" yKeys={["valor"]} altura={280} />
      </SectionCard>

      <SectionCard titulo="Militares Transferidos por Posto e Graduação">
        <PanelGrafico tipo="bar" data={postoAtendidosData} xKey="label" yKeys={["valor"]} altura={260} />
      </SectionCard>
    </div>
  );
}
