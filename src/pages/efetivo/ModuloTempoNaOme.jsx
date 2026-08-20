import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fmtNumero } from "@/lib/cbmpe";
import { linkEfetivoTabela } from "@/lib/efetivoDashboard";
import SectionCard from "@/components/ui/section-card";
import PanelGrafico from "@/components/charts/PanelGrafico";
import MultiSelectFiltro from "@/components/ui/multi-select-filtro";
import efetivoLista from "@/data/real/efetivo_lista.json";

// Painel 08 do handoff — 3 de 4 quadrantes prontos (carreira_extra.json,
// campo tempoOmeAnos, bate exato com o print). O 4º (tabela nominal) estava
// bloqueado por decisão de PII; o usuário confirmou em 2026-08-19 que pode
// mostrar matrícula/nome de guerra ("o app tem login"). Nota técnica: o
// login atual (src/lib/authClient.js) é um protótipo em localStorage, não
// uma barreira real de servidor — o mesmo risco de exposição já existe hoje
// na tabela de Efetivo (nome completo/matrícula já aparecem lá sem gate),
// então esta tabela não introduz uma categoria nova de exposição, só reduz
// pra Posto/OME/Tempo o que já é visível em outro lugar do app.
//
// A tabela usa efetivo_lista.json (não carreira_extra.json, que não tem
// matrícula/nome — foi deliberadamente extraído sem PII) — mesma população
// (2.658 ativos), só uma fonte diferente pros mesmos militares.
const PRACAS_ORDEM = ["Subten", "1ºSgt", "2ºSgt", "3ºSgt", "Cb", "Sd"];
const OFICIAIS_ORDEM = ["Cel", "Ten Cel", "Maj QOC", "Maj QOA", "Cap QOA", "1ºTen QOC", "1ºTen QOA", "2ºTen QOC", "2ºTen QOA"];

function bucketTempoOme(anos) {
  const f = Math.floor(anos);
  if (f <= 0) return "0-1";
  if (f >= 6) return "7+";
  return String(f + 1);
}
const TEMPO_OME_ORDER = ["0-1", "2", "3", "4", "5", "6", "7+"];

// Linhas achatadas de efetivo_lista.json (só os campos usados aqui) — OME
// respeita omeExibicao (adidos aparecem com "ADIDO", não "COMANDO GERAL").
const LINHAS_EFETIVO = (() => {
  const linhas = [];
  for (const [sigla, arr] of Object.entries(efetivoLista.por_unidade || {})) {
    for (const r of arr) {
      const dias = r.completo?.tempoObmAtualDias;
      linhas.push({
        matricula: r.matricula,
        postoGrad: r.postoGrad,
        nomeGuerra: r.nomeGuerra,
        ome: r.omeExibicao || sigla,
        tempoOmeAnos: dias != null ? dias / 365 : null,
      });
    }
  }
  return linhas;
})();

function paramsAtuais({ postos, omes }) {
  const p = {};
  if (postos.size) p.postoGrad = [...postos];
  if (omes.size) p.ome = [...omes];
  return p;
}

export default function ModuloTempoNaOme({ indId, carreira, permitidas }) {
  const navigate = useNavigate();
  const [postos, setPostos] = useState(new Set());
  const [omes, setOmes] = useState(new Set());
  const filtrosPostos = useMemo(() => [...new Set(carreira.map((r) => r.posto))].sort(), [carreira]);
  const filtrosOmes = useMemo(() => [...new Set(carreira.map((r) => r.ome))].sort(), [carreira]);

  const filtrados = useMemo(
    () => carreira.filter((r) =>
      (postos.size === 0 || postos.has(r.posto)) &&
      (omes.size === 0 || omes.has(r.ome))
    ),
    [carreira, postos, omes]
  );

  // LINHAS_EFETIVO vem direto de efetivo_lista.json (não do prop `carreira`,
  // já escopado em EfetivoDashboard.jsx) — precisa do próprio filtro de
  // escopo aqui (mesma sigla real de `ome`/`omeExibicao`, sem tradução).
  const linhasTabela = useMemo(
    () => LINHAS_EFETIVO.filter((r) =>
      (postos.size === 0 || postos.has(r.postoGrad)) &&
      (omes.size === 0 || omes.has(r.ome)) &&
      (!permitidas || permitidas.has(r.ome))
    ),
    [postos, omes, permitidas]
  );

  const filtroAtivo = postos.size > 0 || omes.size > 0;
  const base = paramsAtuais({ postos, omes });

  function irParaTabela(paramsExtra) {
    navigate(linkEfetivoTabela(indId, { ...base, ...paramsExtra }));
  }

  const distribuicaoData = useMemo(() => {
    const buckets = new Map(TEMPO_OME_ORDER.map((k) => [k, 0]));
    filtrados.forEach((r) => {
      if (r.tempoOmeAnos === null || r.tempoOmeAnos === undefined) return;
      const k = bucketTempoOme(r.tempoOmeAnos);
      buckets.set(k, (buckets.get(k) || 0) + 1);
    });
    return TEMPO_OME_ORDER.map((label) => ({ label, valor: buckets.get(label) }));
  }, [filtrados]);

  function mediaPorPosto(lista) {
    return lista.map((posto) => {
      const rows = filtrados.filter((r) => r.posto === posto && r.tempoOmeAnos !== null && r.tempoOmeAnos !== undefined);
      const media = rows.length ? Math.trunc(rows.reduce((s, r) => s + r.tempoOmeAnos, 0) / rows.length) : 0;
      return { label: posto, valor: media };
    });
  }
  const mediaPracasData = useMemo(() => mediaPorPosto(PRACAS_ORDEM), [filtrados]);
  const mediaOficiaisData = useMemo(() => mediaPorPosto(OFICIAIS_ORDEM), [filtrados]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <MultiSelectFiltro label="Patente" valores={filtrosPostos} selecionado={postos} onChange={setPostos} />
        <MultiSelectFiltro label="OME" valores={filtrosOmes} selecionado={omes} onChange={setOmes} />
        {filtroAtivo && (
          <button
            onClick={() => { setPostos(new Set()); setOmes(new Set()); }}
            className="text-[12px] font-medium text-muted-foreground hover:text-foreground"
          >
            Limpar filtros
          </button>
        )}
        {filtroAtivo && (
          <span className="text-[12px] text-muted-foreground">{fmtNumero(filtrados.length)} de {fmtNumero(carreira.length)} militares</span>
        )}
      </div>

      <SectionCard titulo="Distribuição por tempo na OME atual">
        <PanelGrafico
          tipo="bar" data={distribuicaoData} xKey="label" yKeys={["valor"]} altura={260}
          aoClicarBarra={(d) => {
            const idx = TEMPO_OME_ORDER.indexOf(d.label);
            const max = d.label === "7+" ? 100 : idx;
            irParaTabela({ tempoObmAtualDias: { min: idx * 365, max: (max + 1) * 365 - 1 } });
          }}
        />
      </SectionCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard titulo="Tempo médio de permanência em OMEs - Praças">
          <PanelGrafico tipo="bar" data={mediaPracasData} xKey="label" yKeys={["valor"]} altura={260} aoClicarBarra={(d) => irParaTabela({ postoGrad: d.label })} />
        </SectionCard>
        <SectionCard titulo="Tempo médio de permanência em OMEs - Oficiais" subtitulo="Lista literal do card original — Cap QOC tem 0 militares hoje.">
          <PanelGrafico tipo="bar" data={mediaOficiaisData} xKey="label" yKeys={["valor"]} altura={260} aoClicarBarra={(d) => irParaTabela({ postoGrad: d.label })} />
        </SectionCard>
      </div>

      <SectionCard titulo="Informações dos militares" subtitulo={`${fmtNumero(linhasTabela.length)} militares — clique numa linha para ver a ficha`}>
        <div className="max-h-[28rem] overflow-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-border">
                <th className="p-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Matrícula</th>
                <th className="p-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Posto/Graduação</th>
                <th className="p-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Nome de Guerra</th>
                <th className="p-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">OME</th>
                <th className="p-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tempo na OME atual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {linhasTabela.map((r) => (
                <tr
                  key={r.matricula}
                  onClick={() => navigate(`/militar/${encodeURIComponent(r.matricula)}`)}
                  className="cursor-pointer text-foreground/80 hover:bg-muted/40"
                >
                  <td className="p-2.5">{r.matricula}</td>
                  <td className="p-2.5">{r.postoGrad}</td>
                  <td className="p-2.5">{r.nomeGuerra || "—"}</td>
                  <td className="p-2.5">{r.ome}</td>
                  <td className="p-2.5 text-right tabular-nums">{r.tempoOmeAnos != null ? `${r.tempoOmeAnos.toFixed(1)} anos` : "—"}</td>
                </tr>
              ))}
              {linhasTabela.length === 0 && (
                <tr><td colSpan={5} className="p-4 text-center text-[12px] text-muted-foreground">Nenhum militar encontrado com esses filtros.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
