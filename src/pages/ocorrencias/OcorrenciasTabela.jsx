import React from "react";
import { useParams, useSearchParams, Link, useNavigate } from "react-router-dom";
import { ShieldAlert, Download, Siren, X } from "lucide-react";
import { fmtNumero } from "@/lib/cbmpe";
import { usePainelOperacional } from "@/lib/usePainelOperacional";
import { usePainelDw } from "@/lib/usePainelDw";
import { filtrarPorEscopoOcorrencias } from "@/lib/ocorrenciasDashboard";
import { derivarOcorrencia } from "@/lib/ocorrenciasTabela";
import { passaPeriodo } from "@/lib/dashboardHelpers";
import EmptyState from "@/components/ui/empty-state";
import SectionCard from "@/components/ui/section-card";
import ScrollDuplo from "@/components/ui/scroll-duplo";
import CabecalhoPainel from "@/components/layout/CabecalhoPainel";
import { FiltroColuna, passaFiltro, valorFiltro, filtrosIniciaisDaUrl } from "@/components/ui/filtro-coluna";
import { useLarguras, useLarguraContainer, ColGroup, AlcaResize, CELULA_TRUNCADA } from "@/components/ui/tabela-colunas";

const TAMANHOS_PAGINA = [10, 20, 50];
const SEM_DADOS = { ocorrencias: [] };

// Uma linha por ocorrência do ROE (marts.painel_roe_ocorrencia). Sem rua, número nem
// coordenada: o bairro basta para a leitura gerencial (mesmo cuidado do painel CVI).
// As chaves são as que a aba Geolocalização põe na URL ao clicar — ver
// linkOcorrenciasTabela em src/lib/ocorrenciasTabela.js.
const COLUNAS = [
  { chave: "protocolo", rotulo: "Ocorrência", filtravel: false, largura: 100, bruto: (r) => r.roeId },
  { chave: "data", rotulo: "Data e hora", filtravel: false, largura: 170,
    bruto: (r) => r.data, especial: (r) => (r.data ? `${r.data.slice(8, 10)}/${r.data.slice(5, 7)}/${r.data.slice(0, 4)} ${r.data.slice(11, 16)}` : "—") },
  { chave: "mes", rotulo: "Mês", filtravel: true, largura: 80, bruto: (r) => r.mes },
  { chave: "diaSemana", rotulo: "Dia da semana", filtravel: true, largura: 120, bruto: (r) => r.diaSemana },
  { chave: "hora", rotulo: "Hora", filtravel: true, largura: 70, bruto: (r) => r.hora },
  { chave: "natureza", rotulo: "Natureza", filtravel: true, largura: 190, bruto: (r) => r.natureza },
  { chave: "grupo", rotulo: "Grupo", filtravel: true, largura: 200, bruto: (r) => r.grupo },
  { chave: "subgrupo", rotulo: "Subgrupo", filtravel: true, largura: 200, bruto: (r) => r.subgrupo },
  { chave: "diretoria", rotulo: "Diretoria", filtravel: true, largura: 100, bruto: (r) => r.diretoria },
  { chave: "ome", rotulo: "OME", filtravel: true, largura: 90, bruto: (r) => r.ome },
  { chave: "cidade", rotulo: "Município", filtravel: true, largura: 150, bruto: (r) => r.cidade },
  { chave: "bairro", rotulo: "Bairro", filtravel: true, largura: 160, bruto: (r) => r.bairro },
  { chave: "local", rotulo: "Local", filtravel: true, largura: 220, bruto: (r) => r.local },
  { chave: "status", rotulo: "Situação do relatório", filtravel: true, largura: 170, bruto: (r) => r.statusRelatorio },
  { chave: "atendida", rotulo: "Atendida", filtravel: true, largura: 90, bruto: (r) => r.atendida },
  { chave: "motivo", rotulo: "Motivo do não atendimento", filtravel: true, largura: 200, bruto: (r) => r.motivoNaoAtendimento },
  { chave: "feridas", rotulo: "Vítimas feridas", filtravel: true, largura: 110, alinhar: "right", bruto: (r) => r.vitimasFeridas },
  { chave: "fatais", rotulo: "Vítimas fatais", filtravel: true, largura: 110, alinhar: "right", bruto: (r) => r.vitimasFatais },
  { chave: "ilesas", rotulo: "Vítimas ilesas", filtravel: true, largura: 110, alinhar: "right", bruto: (r) => r.vitimasIlesas },
  { chave: "desaparecidas", rotulo: "Desaparecidas", filtravel: true, largura: 110, alinhar: "right", bruto: (r) => r.vitimasDesaparecidas },
];
const COLUNAS_FILTRAVEIS = COLUNAS.filter((c) => c.filtravel);

function renderCelula(coluna, registro) {
  if (coluna.especial) return coluna.especial(registro);
  const b = coluna.bruto(registro);
  return b === null || b === undefined || b === "" ? "—" : String(b);
}

const fmtData = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "…");

// Detalhamento de Ocorrências: /ocorrencias/:id/tabela — a planilha do indicador, aberta
// pelo botão do quadro de valor (OcorrenciasPagina) e pelos cliques da aba Geolocalização.
// Mesma mecânica das tabelas de Efetivo, Viaturas, Finanças e CVI (filtro por coluna,
// drill-down pela URL, Excel). O período chega como `de`/`ate` e vira um recorte fixo,
// que pode ser removido.
export default function OcorrenciasTabela() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const ctx = usePainelOperacional(id, "Ocorrências");
  const painel = usePainelDw("ocorrencias", SEM_DADOS, ctx.permitido);

  const de = searchParams.get("de");
  const ate = searchParams.get("ate");
  const registrosBase = React.useMemo(
    () => filtrarPorEscopoOcorrencias(painel.ocorrencias || [], ctx.permitidas)
      .filter((r) => passaPeriodo(r.data, { de, ate }))
      .map(derivarOcorrencia)
      .sort((a, b) => String(b.data).localeCompare(String(a.data))),
    [painel, ctx.permitidas, de, ate]
  );

  const [filtros, setFiltros] = React.useState({});
  const [pagina, setPagina] = React.useState(1);
  const [tamanhoPagina, setTamanhoPagina] = React.useState(20);
  const { larguras, iniciarResize, larguraTotal } = useLarguras(COLUNAS);
  const [containerRef, larguraDisponivel] = useLarguraContainer();

  const searchParamsStr = searchParams.toString();
  React.useEffect(() => {
    setFiltros(filtrosIniciaisDaUrl(searchParams, COLUNAS, registrosBase));
    setPagina(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, searchParamsStr, registrosBase]);

  const valoresPorColuna = React.useMemo(() => {
    const mapa = {};
    COLUNAS_FILTRAVEIS.forEach((alvo) => {
      const outras = COLUNAS_FILTRAVEIS.filter((c) => c.chave !== alvo.chave);
      const base = registrosBase.filter((r) => outras.every((c) => passaFiltro(valorFiltro(c, r), filtros[c.chave])));
      mapa[alvo.chave] = [...new Set(base.map((r) => valorFiltro(alvo, r)))].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
    });
    return mapa;
  }, [registrosBase, filtros]);

  const registrosFiltrados = React.useMemo(
    () => registrosBase.filter((r) => COLUNAS_FILTRAVEIS.every((c) => passaFiltro(valorFiltro(c, r), filtros[c.chave]))),
    [registrosBase, filtros]
  );
  const filtroAtivo = Object.values(filtros).some((v) => v !== undefined);

  React.useEffect(() => { setPagina(1); }, [filtros, tamanhoPagina]);

  if (ctx.loading && !ctx.encontrado) return <div className="h-96 animate-pulse rounded-xl bg-muted/40" />;
  if (!ctx.encontrado || !ctx.permitido) {
    return (
      <EmptyState
        icon={ShieldAlert}
        titulo={ctx.encontrado ? "Acesso restrito" : "Painel não encontrado"}
        descricao="A visão da corporação inteira fica no atalho do CBMPE - Geral, no organograma."
        acao={<Link to="/organograma" className="text-[13px] font-medium text-primary hover:underline">Voltar ao organograma</Link>}
      />
    );
  }

  const base = `/ocorrencias/${id}`;
  const totalPaginas = Math.max(1, Math.ceil(registrosFiltrados.length / tamanhoPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const registrosPagina = registrosFiltrados.slice((paginaAtual - 1) * tamanhoPagina, paginaAtual * tamanhoPagina);
  const carregando = !painel.ocorrencias?.length;

  function removerPeriodo() {
    const sp = new URLSearchParams(searchParams);
    sp.delete("de");
    sp.delete("ate");
    navigate(`?${sp.toString()}`, { replace: true });
  }

  async function exportarExcel() {
    const XLSX = await import("xlsx");
    const linhas = registrosFiltrados.map((r) => Object.fromEntries(COLUNAS.map((c) => {
      const b = c.chave === "data" ? renderCelula(c, r) : c.bruto(r);
      return [c.rotulo, b ?? ""];
    })));
    const planilha = XLSX.utils.json_to_sheet(linhas);
    const livro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(livro, planilha, "Ocorrências");
    XLSX.writeFile(livro, `Ocorrências - ${(ctx.geral ? "CBMPE" : ctx.unidade?.sigla || "Unidade").replace(/[\\/:*?"<>|]/g, "-")}.xlsx`);
  }

  return (
    <div className="space-y-3 animate-fade-in">
      <CabecalhoPainel
        geral={ctx.geral}
        caminho={ctx.caminho}
        trilha={[{ rotulo: "Ocorrências", para: base }, { rotulo: "Detalhamento" }]}
        titulo="Ocorrências"
        subtitulo={ctx.subtitulo}
        voltarPara={base}
      />

      <div className="flex flex-wrap items-center gap-2">
        {(de || ate) && (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1 text-[12px] text-foreground">
            Período: {fmtData(de)} a {fmtData(ate)}
            <button type="button" onClick={removerPeriodo} aria-label="Remover período" className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        )}
        <button
          type="button"
          onClick={exportarExcel}
          disabled={!registrosFiltrados.length}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" /> Exportar Excel
        </button>
      </div>

      <SectionCard semPadding>
        <div className="flex flex-wrap items-baseline gap-x-2 border-b border-border px-4 py-3">
          <Siren className="h-4 w-4 self-center text-primary" />
          <span className="font-display text-xl font-semibold tracking-tight text-foreground tabular-nums">
            Total: {carregando ? "…" : fmtNumero(registrosBase.length)}
          </span>
          {filtroAtivo && (
            <span className="font-display text-xl font-semibold tracking-tight text-foreground tabular-nums">
              / Filtrados: {fmtNumero(registrosFiltrados.length)}
            </span>
          )}
          <span className="text-[12px] text-muted-foreground">ocorrências</span>
        </div>

        <div ref={containerRef}>
          <ScrollDuplo maxHeight="36rem">
            <table className="table-fixed border-collapse text-left" style={{ width: Math.max(larguraTotal, larguraDisponivel) }}>
              <ColGroup colunas={COLUNAS} larguras={larguras} />
              <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
                <tr className="border-b-2 border-primary/25 text-[10.5px] font-bold uppercase tracking-wide text-foreground/70">
                  {COLUNAS.map((c) => (
                    <th key={c.chave} className="relative overflow-hidden px-2.5 py-2 text-left align-middle">
                      <div className="flex min-w-0 items-center gap-1">
                        <span className="truncate">{c.rotulo}</span>
                        {c.filtravel && (
                          <span className="shrink-0">
                            <FiltroColuna
                              valoresDisponiveis={valoresPorColuna[c.chave] || []}
                              selecionado={filtros[c.chave]}
                              onChange={(next) => setFiltros((prev) => ({ ...prev, [c.chave]: next }))}
                            />
                          </span>
                        )}
                      </div>
                      <AlcaResize onMouseDown={(e) => iniciarResize(c.chave, e)} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {registrosPagina.map((r, i) => (
                  <tr key={`${r.roeId ?? r.data}-${i}`} className="text-foreground/80 transition-colors odd:bg-card even:bg-muted/60 hover:bg-primary/10">
                    {COLUNAS.map((c) => (
                      <td
                        key={c.chave}
                        title={String(c.bruto(r) ?? "") || undefined}
                        className={`px-2.5 py-2 ${CELULA_TRUNCADA} ${c.alinhar === "right" ? "text-right tabular-nums" : ""}`}
                      >
                        {renderCelula(c, r)}
                      </td>
                    ))}
                  </tr>
                ))}
                {registrosPagina.length === 0 && (
                  <tr>
                    <td colSpan={COLUNAS.length} className="p-4 text-center text-[12px] text-muted-foreground">
                      {carregando ? "Carregando ocorrências…" : "Nenhum registro encontrado com esses filtros."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </ScrollDuplo>
        </div>
      </SectionCard>

      <div className="flex flex-col items-center gap-2 pt-1 sm:flex-row sm:justify-center sm:gap-6">
        <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <span>Exibir</span>
          {TAMANHOS_PAGINA.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setTamanhoPagina(n)}
              className={`h-6 min-w-[1.75rem] rounded-md px-1.5 text-[12px] font-medium transition-colors ${
                tamanhoPagina === n ? "bg-primary text-primary-foreground" : "border border-input bg-background text-foreground hover:bg-muted"
              }`}
            >
              {n}
            </button>
          ))}
          <span>registros</span>
        </div>
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <button type="button" disabled={paginaAtual <= 1} onClick={() => setPagina((p) => Math.max(1, p - 1))}
            className="rounded-md border border-input px-2.5 py-1 disabled:opacity-40">Anterior</button>
          <span>Página {paginaAtual} de {totalPaginas}</span>
          <button type="button" disabled={paginaAtual >= totalPaginas} onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
            className="rounded-md border border-input px-2.5 py-1 disabled:opacity-40">Próxima</button>
        </div>
      </div>
    </div>
  );
}
