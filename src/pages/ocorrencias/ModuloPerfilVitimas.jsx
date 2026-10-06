import React, { useMemo, useState } from "react";
import { filtrarPorEscopoOcorrencias, faixaEtaria, ORDEM_FAIXA_ETARIA } from "@/lib/ocorrenciasDashboard";
import SectionCard from "@/components/ui/section-card";
import DonutChart from "@/components/charts/DonutChart";
import PanelGrafico from "@/components/charts/PanelGrafico";
import MultiSelectFiltro from "@/components/ui/multi-select-filtro";
import FiltrosOcorrencias from "./FiltrosOcorrencias";
import { useFiltrosOcorrencias } from "@/lib/useFiltrosOcorrencias";
import AguardandoCredencial from "./AguardandoCredencial";
import CardPendente from "./CardPendente";

// Aba "Perfil de vítimas" (8ª de 9, dado de saúde — LGPD art. 11) —
// status_ocorrencias.md: 🟢 confirmed nos 5 quadrantes. Schema real de
// roe_aph_ocorrencias confirmado em 2026-09-23 (genero/idade/
// idade_em_meses, além de entregue_vivo/status_deficiencia já usados) —
// "Divisão por gênero" e faixa etária saem do pendente.
//
// Minimização LGPD: `aphEstatistica` nunca carrega nome, CPF, telefone ou
// endereço de vítima — só os campos já agregáveis (genero, idade solta sem
// nenhum outro identificador, cvi/entregueVivo/deficiencia), mesma regra do
// extrator de Vacinação.
export default function ModuloPerfilVitimas({ aphEstatistica, permitidas, bloqueado, pendencias }) {
  const filtros = useFiltrosOcorrencias();
  const [generos, setGeneros] = useState(new Set());
  const [faixas, setFaixas] = useState(new Set());
  const doEscopoTotal = useMemo(() => filtrarPorEscopoOcorrencias(aphEstatistica, permitidas), [aphEstatistica, permitidas]);
  const doEscopo = useMemo(
    () => doEscopoTotal.filter((a) => filtros.passaOme(a)
      && (generos.size === 0 || generos.has(a.genero))
      && (faixas.size === 0 || faixas.has(faixaEtaria(a.idade, a.idadeEmMeses)))),
    [doEscopoTotal, filtros.passaOme, generos, faixas]
  );
  const opcoesGenero = useMemo(() => [...new Set(doEscopoTotal.map((a) => a.genero).filter(Boolean))].sort(), [doEscopoTotal]);

  // status_deficiencia é categórico ("Sim"/"Não"/"Não identificado"), não
  // booleano — corrigido em 2026-09-23 (a primeira versão tratava qualquer
  // valor não-nulo, inclusive "Não", como truthy, então 100% das vítimas
  // apareciam como "Com deficiência").
  const porDeficiencia = useMemo(() => {
    const m = new Map();
    doEscopo.forEach((a) => {
      if (!a.deficiencia) return;
      m.set(a.deficiencia, (m.get(a.deficiencia) || 0) + 1);
    });
    return [...m.entries()].map(([label, valor]) => ({ label, valor })).sort((a, b) => b.valor - a.valor);
  }, [doEscopo]);

  const porGenero = useMemo(() => {
    const m = new Map();
    doEscopo.forEach((a) => {
      if (!a.genero) return;
      m.set(a.genero, (m.get(a.genero) || 0) + 1);
    });
    return [...m.entries()].map(([label, valor]) => ({ label, valor })).sort((a, b) => b.valor - a.valor);
  }, [doEscopo]);

  const porFaixaEtaria = useMemo(() => {
    const m = new Map();
    doEscopo.forEach((a) => {
      const faixa = faixaEtaria(a.idade, a.idadeEmMeses);
      if (!faixa) return;
      m.set(faixa, (m.get(faixa) || 0) + 1);
    });
    return ORDEM_FAIXA_ETARIA.filter((f) => m.has(f)).map((label) => ({ label, valor: m.get(label) }));
  }, [doEscopo]);

  if (bloqueado) return <AguardandoCredencial />;

  return (
    <div className="space-y-5">
      <FiltrosOcorrencias
        filtros={{ ...filtros, ativo: filtros.ativo || generos.size > 0 || faixas.size > 0,
          limpar: () => { filtros.limpar(); setGeneros(new Set()); setFaixas(new Set()); } }}
        base={doEscopoTotal} semPeriodo semCidade
      >
        <MultiSelectFiltro label="Gênero" valores={opcoesGenero} selecionado={generos} onChange={setGeneros} buscavel={false} />
        <MultiSelectFiltro label="Faixa etária" valores={ORDEM_FAIXA_ETARIA} selecionado={faixas} onChange={setFaixas} buscavel={false} />
      </FiltrosOcorrencias>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* max-w-md no card inteiro (não só no donut): mesmo fix já aplicado
            em ModuloVacinacaoExecucao.jsx ("Representatividade das marcas")
            — sem isso, o card fica com largura cheia da coluna e o donut
            pequeno "boiando" no meio de fundo vazio. */}
        <div className="mx-auto w-full max-w-md">
          <SectionCard titulo="Vítimas com deficiência">
            {porDeficiencia.length > 0 ? (
              <DonutChart data={porDeficiencia} rotuloTotal="Vítimas" altura={200} />
            ) : (
              <CardPendente
                titulo="Sem registros com o campo preenchido"
                motivo="Coluna roe_aph_ocorrencias.status_deficiencia extraída, mas nenhuma linha do escopo atual tem valor."
              />
            )}
          </SectionCard>
        </div>
        <div className="mx-auto w-full max-w-md">
          <SectionCard titulo="Divisão por gênero">
            {porGenero.length > 0 ? (
              <DonutChart data={porGenero} rotuloTotal="Vítimas" altura={200} />
            ) : (
              <CardPendente titulo="Sem registros no escopo" motivo="Nenhuma vítima com gênero preenchido na OME/filtro selecionado." />
            )}
          </SectionCard>
        </div>
      </div>

      <SectionCard titulo="Faixa etária" subtitulo="'Menor de 1 ano' vem direto de idade_em_meses (sinal de bebê da origem); as demais faixas, de idade em anos">
        {porFaixaEtaria.length > 0 ? (
          <PanelGrafico tipo="hbar" data={porFaixaEtaria} xKey="label" yKeys={["valor"]} altura={Math.max(240, porFaixaEtaria.length * 32)} />
        ) : (
          <CardPendente titulo="Sem registros no escopo" motivo="Nenhuma vítima com idade preenchida na OME/filtro selecionado." />
        )}
      </SectionCard>

      <SectionCard titulo="Demais quadrantes">
        <CardPendente titulo="Aguardando confirmação" motivo={pendencias?.perfil_vitimas_sexo_idade || "Gênero e faixa etária já cobertos acima — os quadrantes restantes de Perfil de Vítimas (status_ocorrencias.md cita 5 no total) ainda não foram identificados por nome."} />
      </SectionCard>
    </div>
  );
}
