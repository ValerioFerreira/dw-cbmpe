import React from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { ChevronRight, Wallet, ShieldAlert, Download } from "lucide-react";
import { useCbmpe } from "@/lib/cbmpe-context";
import { useAcessoUsuario } from "@/lib/useAcessoUsuario";
import { getCaminho, getSubordinados, fmtNumero } from "@/lib/cbmpe";
import {
  siglasPermitidas, lancamentosDoEscopo, rotuloMesLancamento, fmtMoedaCentavos, exportarLancamentosExcel,
} from "@/lib/financasDashboard";
import { usePainelDw } from "@/lib/usePainelDw";
import EmptyState from "@/components/ui/empty-state";
import SectionCard from "@/components/ui/section-card";
import ScrollDuplo from "@/components/ui/scroll-duplo";
import { FiltroColuna, passaFiltro, valorFiltro, filtrosIniciaisDaUrl } from "@/components/ui/filtro-coluna";
import { useLarguras, useLarguraContainer, ColGroup, AlcaResize, CELULA_TRUNCADA } from "@/components/ui/tabela-colunas";

const TAMANHOS_PAGINA = [10, 20, 50];
const SEM_DADOS = { lancamentos: [] };

const alerta = (r) => [
  r.pago_maior_liquidado && "Pago > liquidado",
  r.liquidado_maior_empenhado && "Liquidado > empenhado",
  r.pago_maior_empenhado && "Pago > empenhado",
].filter(Boolean).join("; ");

const dinheiro = (campo) => ({
  bruto: (r) => r[campo] ?? null,
  especial: (r) => (r[campo] == null ? "—" : fmtMoedaCentavos(r[campo])),
  alinhar: "right",
});

// Mesmas colunas da planilha exportada (exportarLancamentosExcel), na mesma ordem. O ofício só
// aparece quando o backend o entrega — o snapshot público não o traz.
const COLUNAS_BASE = [
  { chave: "bloco", rotulo: "Bloco", filtravel: true, largura: 120, bruto: (r) => r.bloco ?? null },
  { chave: "item", rotulo: "Item", filtravel: true, largura: 220, bruto: (r) => r.item ?? null },
  { chave: "empenho", rotulo: "Empenho", filtravel: true, largura: 130, bruto: (r) => r.empenho ?? null },
  { chave: "ome", rotulo: "OME", filtravel: true, largura: 110, bruto: (r) => r.unidade || null },
  { chave: "destino", rotulo: "Destino", filtravel: true, largura: 160, bruto: (r) => r.destino || null },
  { chave: "enquadramento", rotulo: "Enquadramento", filtravel: true, largura: 170, bruto: (r) => r.enquadramento || null },
  { chave: "situacao", rotulo: "Situação", filtravel: true, largura: 120, bruto: (r) => r.situacao || null },
  { chave: "tipo", rotulo: "Tipo de gasto", filtravel: true, largura: 150, bruto: (r) => r.tipo || null },
  { chave: "natureza", rotulo: "Natureza", filtravel: true, largura: 150, bruto: (r) => r.natureza || null },
  { chave: "mes", rotulo: "Mês", filtravel: true, largura: 90, bruto: (r) => rotuloMesLancamento(r.mes) || null },
  { chave: "valor", rotulo: "Empenhado", filtravel: false, largura: 130, ...dinheiro("valor") },
  { chave: "valor_liquidado", rotulo: "Liquidado", filtravel: false, largura: 130, ...dinheiro("valor_liquidado") },
  { chave: "valor_pago", rotulo: "Pago", filtravel: false, largura: 130, ...dinheiro("valor_pago") },
  { chave: "alerta", rotulo: "Alerta", filtravel: true, largura: 190, bruto: (r) => alerta(r) || null },
];
const COLUNA_OFICIO = {
  chave: "oficio", rotulo: "Ofício", filtravel: true, largura: 140,
  bruto: (r) => (r.oficio ? String(r.oficio).split("\n")[0] : null),
};

function renderCelula(coluna, registro) {
  if (coluna.especial) return coluna.especial(registro);
  const b = coluna.bruto(registro);
  return b === null || b === undefined || b === "" ? "—" : String(b);
}

function sanitizarNomeArquivo(nome) {
  return String(nome).replace(/[\\/:*?"<>|]/g, "-").trim();
}

// Lista completa dos lançamentos de Finanças da unidade (e das vinculadas), com filtro por coluna e
// download em Excel — a mesma lógica de EfetivoDetalhe e ViaturaDetalhe. O resumo por situação fica
// na página inicial do indicador (ResumoFinancas); a planilha sai daqui, respeitando os filtros.
export default function FinancasDetalhe() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { indicadores, unidades, porId, loading } = useCbmpe();
  const { permiteIndicador } = useAcessoUsuario();

  const ind = indicadores.find((i) => i.id === id);
  const unidade = ind ? porId[ind.unidade_id] : null;
  const caminho = ind ? getCaminho(unidades, ind.unidade_id) : [];

  const painel = usePainelDw("df", SEM_DADOS);
  const permitidas = React.useMemo(() => siglasPermitidas(unidade, unidades), [unidade, unidades]);
  const escopoTotal = unidade?.sigla === "COMANDO GERAL";
  const registrosBase = React.useMemo(
    () => lancamentosDoEscopo(painel.lancamentos, permitidas, escopoTotal),
    [painel, permitidas, escopoTotal]
  );
  const comOficio = React.useMemo(() => registrosBase.some((r) => r.oficio), [registrosBase]);
  const COLUNAS = React.useMemo(() => (comOficio ? [COLUNAS_BASE[0], COLUNA_OFICIO, ...COLUNAS_BASE.slice(1)] : COLUNAS_BASE), [comOficio]);
  const colunasFiltraveis = React.useMemo(() => COLUNAS.filter((c) => c.filtravel), [COLUNAS]);

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
  }, [unidade?.id, searchParamsStr, registrosBase]);

  const valoresPorColuna = React.useMemo(() => {
    const mapa = {};
    colunasFiltraveis.forEach((alvo) => {
      const outras = colunasFiltraveis.filter((c) => c.chave !== alvo.chave);
      const base = registrosBase.filter((r) => outras.every((c) => passaFiltro(valorFiltro(c, r), filtros[c.chave])));
      const unicos = [...new Set(base.map((r) => valorFiltro(alvo, r)))];
      mapa[alvo.chave] = unicos.sort((a, b) => a.localeCompare(b, "pt-BR"));
    });
    return mapa;
  }, [registrosBase, filtros, colunasFiltraveis]);

  const registrosFiltrados = React.useMemo(
    () => registrosBase.filter((r) => colunasFiltraveis.every((c) => passaFiltro(valorFiltro(c, r), filtros[c.chave]))),
    [registrosBase, filtros, colunasFiltraveis]
  );

  const filtroAtivo = Object.values(filtros).some((v) => v !== undefined);
  const temSubordinadas = unidade ? getSubordinados(unidades, unidade.id).length > 0 : false;

  React.useEffect(() => {
    setPagina(1);
  }, [filtros, tamanhoPagina]);

  if (loading && !ind) return <div className="h-96 animate-pulse rounded-xl bg-muted/40" />;

  if (!ind || ind.nome !== "Finanças") {
    return (
      <EmptyState
        icon={Wallet}
        titulo="Indicador de Finanças não encontrado"
        acao={<Link to="/organograma" className="text-[13px] font-medium text-primary hover:underline">Voltar ao início</Link>}
      />
    );
  }

  if (!permiteIndicador(ind, unidade?.sigla)) {
    return (
      <EmptyState
        icon={ShieldAlert}
        titulo="Acesso restrito"
        descricao="Seu usuário não tem permissão para ver os dados de finanças desta unidade."
        acao={<Link to="/organograma" className="text-[13px] font-medium text-primary hover:underline">Voltar ao organograma</Link>}
      />
    );
  }

  const totalPaginas = Math.max(1, Math.ceil(registrosFiltrados.length / tamanhoPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const registrosPagina = registrosFiltrados.slice((paginaAtual - 1) * tamanhoPagina, paginaAtual * tamanhoPagina);

  function exportarExcel() {
    const nomeUnidade = sanitizarNomeArquivo(unidade?.sigla || unidade?.nome || "Unidade");
    exportarLancamentosExcel(registrosFiltrados, `Finanças - ${nomeUnidade}.xlsx`);
  }

  return (
    <div className="space-y-3 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <Link to="/organograma" className="hover:text-foreground">Organograma</Link>
        <ChevronRight className="h-3 w-3" />
        {caminho.map((c) => (
          <span key={c.id} className="inline-flex items-center gap-1.5">
            <Link to={`/diretoria/${c.id}`} className="hover:text-foreground">{c.sigla || c.nome}</Link>
            <ChevronRight className="h-3 w-3" />
          </span>
        ))}
        <Link to={`/indicador/${ind.id}`} className="hover:text-foreground">Finanças</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">Detalhamento</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/8 text-primary">
            <Wallet className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">Lançamentos da OME</h1>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {unidade?.nome}{temSubordinadas ? " + unidades vinculadas" : ""}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={exportarExcel}
          disabled={!registrosFiltrados.length}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" /> Exportar Excel
        </button>
      </div>

      <SectionCard semPadding>
        <div className="flex items-baseline gap-2 border-b border-border px-4 py-3">
          <span className="font-display text-xl font-semibold tracking-tight text-foreground tabular-nums">
            Total: {fmtNumero(registrosBase.length)}
          </span>
          {filtroAtivo && (
            <span className="font-display text-xl font-semibold tracking-tight text-foreground tabular-nums">
              / Filtrados: {fmtNumero(registrosFiltrados.length)}
            </span>
          )}
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
                <tr key={`${r.empenho ?? ""}-${i}`} className="text-foreground/80 transition-colors odd:bg-card even:bg-muted/60 hover:bg-primary/10">
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
                    Nenhum lançamento encontrado com esses filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </ScrollDuplo>
        </div>
      </SectionCard>

      {/* Paginação — fora da tabela, centralizada embaixo. */}
      <div className="flex flex-col items-center gap-2 pt-1 sm:flex-row sm:justify-center sm:gap-6">
        <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <span>Exibir</span>
          {TAMANHOS_PAGINA.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setTamanhoPagina(n)}
              className={`h-6 min-w-[1.75rem] rounded-md px-1.5 text-[12px] font-medium transition-colors ${
                tamanhoPagina === n
                  ? "bg-primary text-primary-foreground"
                  : "border border-input bg-background text-foreground hover:bg-muted"
              }`}
            >
              {n}
            </button>
          ))}
          <span>registros</span>
        </div>
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <button
            type="button"
            disabled={paginaAtual <= 1}
            onClick={() => setPagina((p) => Math.max(1, p - 1))}
            className="rounded-md border border-input px-2.5 py-1 disabled:opacity-40"
          >
            Anterior
          </button>
          <span>Página {paginaAtual} de {totalPaginas}</span>
          <button
            type="button"
            disabled={paginaAtual >= totalPaginas}
            onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
            className="rounded-md border border-input px-2.5 py-1 disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
}
