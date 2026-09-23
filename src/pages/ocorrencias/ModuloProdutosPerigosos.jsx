import React, { useMemo } from "react";
import { fmtNumero } from "@/lib/cbmpe";
import { filtrarPorEscopoOcorrencias, serieCampoOcorrencias } from "@/lib/ocorrenciasDashboard";
import SectionCard from "@/components/ui/section-card";
import KpiCard from "@/components/ui/kpi-card";
import DonutChart from "@/components/charts/DonutChart";
import AguardandoCredencial from "./AguardandoCredencial";
import CardPendente from "./CardPendente";

const NATUREZA_PP = "Produtos Perigosos";

// Aba "Produtos Perigosos" (6ª de 9) — a única com pendência 🟠 explícita
// mesmo DEPOIS de resolvida a credencial: status_ocorrencias.md marca
// "Total por produto" como suspeita de erro de qualidade de dado (656 de
// 672 produtos com contagem exatamente 20, rótulos "X (ver Y)" — parece
// lista de referência/sinônimo, não ocorrência real). Por isso este card
// NUNCA é extraído automaticamente, mesmo com credencial — precisa de
// confirmação com quem administra roe_prod_perigosos_ocorrencias primeiro
// (ver PENDENCIAS-PAINEIS-CORPORATIVOS.md, pergunta 3).
//
// "Finalizadas"/"Aguardando finalização"/"Total de vítimas" vêm de
// roe_basico_ocorrencias (mesmo padrão das outras abas). "Evolução
// histórica" usa o diagnóstico que Igor escreveu e decidiu não rodar (SQL
// literal em extract_dashboard_ocorrencias.py) — mostrado aqui como as 3
// contagens brutas, sem tentar decidir sozinho como plotar a linha do
// tempo (essa decisão é do Valério com Igor, ver status_ocorrencias.md).
export default function ModuloProdutosPerigosos({ ocorrencias, produtosPerigosos, produtosPerigososDiagnostico, permitidas, bloqueado, pendencias }) {
  const doEscopo = useMemo(() => filtrarPorEscopoOcorrencias(ocorrencias, permitidas), [ocorrencias, permitidas]);
  const filtrados = useMemo(() => doEscopo.filter((o) => o.natureza === NATUREZA_PP), [doEscopo]);
  const finalizadas = useMemo(() => filtrados.filter((o) => o.finalizado), [filtrados]);
  const aguardando = useMemo(() => filtrados.filter((o) => !o.finalizado), [filtrados]);
  const totalVitimas = useMemo(
    () => finalizadas.reduce((a, o) => a + o.vitimasFeridas + o.vitimasFatais + o.vitimasIlesas + o.vitimasDesaparecidas, 0),
    [finalizadas]
  );

  // Perfil dos Botijões de GLP: só as linhas que de fato são sobre GLP têm
  // `perfilBotijaoGlp` preenchido (o campo vem nulo pra qualquer outro
  // produto perigoso) — serieCampoOcorrencias já descarta nulo por padrão.
  const ppEscopo = useMemo(() => filtrarPorEscopoOcorrencias(produtosPerigosos || [], permitidas), [produtosPerigosos, permitidas]);
  const porPerfilGlp = useMemo(() => serieCampoOcorrencias(ppEscopo, "perfilBotijaoGlp"), [ppEscopo]);

  if (bloqueado) return <AguardandoCredencial />;

  return (
    <div className="space-y-5">
      {/* sm:grid-cols-3 (não -4): só 3 cards aqui — 4 colunas deixava a
          última vazia (mesmo ajuste feito em ModuloAph.jsx). */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <KpiCard nome="Finalizadas" valor={fmtNumero(finalizadas.length)} destaque />
        <KpiCard nome="Aguardando finalização" valor={fmtNumero(aguardando.length)} />
        <KpiCard nome="Total de vítimas" valor={fmtNumero(totalVitimas)} />
      </div>

      <SectionCard titulo="Evolução histórica" subtitulo="Diagnóstico registrado por Igor, não rodado (status_ocorrencias.md) — decisão de exibição pendente">
        {produtosPerigososDiagnostico ? (
          <div className="grid grid-cols-3 gap-3">
            <KpiCard nome="Sem match na básico" valor={fmtNumero(produtosPerigososDiagnostico.semMatchNaBasico)} />
            <KpiCard nome="Match, mas data nula" valor={fmtNumero(produtosPerigososDiagnostico.matchMasDataNula)} />
            <KpiCard nome="Com data" valor={fmtNumero(produtosPerigososDiagnostico.comData)} />
          </div>
        ) : (
          <CardPendente
            titulo="Diagnóstico ainda não rodado"
            motivo="Query pronta em extract_dashboard_ocorrencias.py (extrair_diagnostico_produtos_perigosos) — falta credencial para rodar."
          />
        )}
      </SectionCard>

      <SectionCard titulo="Total por produto" subtitulo="🟠 pending — suspeita de erro de qualidade de dado, não extraído mesmo com credencial">
        <CardPendente titulo="Bloqueado por qualidade de dado, não por credencial" motivo={pendencias?.produtos_perigosos_total_por_produto} />
      </SectionCard>

      <SectionCard titulo="Perfil dos Botijões de GLP" subtitulo="Só as ocorrências de vazamento/incidente com botijão GLP têm este campo preenchido">
        {porPerfilGlp.length > 0 ? (
          <DonutChart data={porPerfilGlp} rotuloTotal="Botijões" altura={200} />
        ) : (
          <CardPendente titulo="Sem registros no escopo" motivo="Nenhuma linha de Produtos Perigosos com perfil de botijão GLP preenchido na OME/filtro selecionado." />
        )}
      </SectionCard>
    </div>
  );
}
