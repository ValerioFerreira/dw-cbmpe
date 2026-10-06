import React from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { ChevronRight, Car, ShieldAlert, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { useCbmpe } from "@/lib/cbmpe-context";
import { useAcessoUsuario } from "@/lib/useAcessoUsuario";
import { getCaminho, getSubordinados, fmtNumero } from "@/lib/cbmpe";
import { siglaDeDados } from "@/data/organograma";
import EmptyState from "@/components/ui/empty-state";
import SectionCard from "@/components/ui/section-card";
import ScrollDuplo from "@/components/ui/scroll-duplo";
import BadgeSituacao from "@/components/ui/badge-situacao";
import { FiltroColuna, passaFiltro, valorFiltro, filtrosIniciaisDaUrl } from "@/components/ui/filtro-coluna";
import { useLarguras, useLarguraContainer, ColGroup, AlcaResize, CELULA_TRUNCADA } from "@/components/ui/tabela-colunas";
import { registrosViaturas } from "@/lib/viaturasDashboard";

const TAMANHOS_PAGINA = [10, 20, 50];

function fmtSimNao(v) {
  if (v === null || v === undefined) return "—";
  return v ? "Sim" : "Não";
}

// Ordem pedida pelo usuário (2026-08-18): Nome, OME, Placa, Patrimônio,
// Modelo, Ano, Situação (com badge colorido). As colunas a partir de "Tipo"
// foram acrescentadas pra sustentar o drill-down do Dashboard de Viaturas
// (ver linkViaturaTabela em viaturasDashboard.js) — vêm de
// relação de viaturas do DW (os mesmos registros do dashboard).
const COLUNAS = [
  { chave: "nome", rotulo: "Nome", filtravel: true, largura: 160, bruto: (r) => r.nome || null },
  { chave: "ome", rotulo: "OME", filtravel: true, largura: 120, bruto: (r) => r.ome || null },
  { chave: "placa", rotulo: "Placa", filtravel: true, largura: 110, bruto: (r) => r.placa || null },
  { chave: "patrimonio", rotulo: "Patrimônio", filtravel: true, largura: 120, bruto: (r) => r.patrimonio || null },
  { chave: "modelo", rotulo: "Modelo", filtravel: true, largura: 220, bruto: (r) => r.modelo || null },
  { chave: "ano", rotulo: "Ano", filtravel: true, largura: 85, bruto: (r) => r.ano ?? null },
  {
    chave: "situacao", rotulo: "Situação", filtravel: true, largura: 210,
    bruto: (r) => r.situacao || null,
    especial: (r) => <BadgeSituacao situacao={r.situacao} />,
  },
  { chave: "tipoAcronym", rotulo: "Tipo", filtravel: true, largura: 100, bruto: (r) => r.tipoAcronym || null },
  { chave: "destinacao", rotulo: "Destinação", filtravel: true, largura: 130, bruto: (r) => r.destinacao || null },
  { chave: "posse", rotulo: "Posse", filtravel: true, largura: 100, bruto: (r) => r.posse || null },
  { chave: "combustivel", rotulo: "Combustível", filtravel: true, largura: 110, bruto: (r) => r.combustivel || null },
  {
    chave: "rastreado", rotulo: "Rastreado?", filtravel: true, largura: 100,
    bruto: (r) => (r.rastreado ?? null),
    especial: (r) => fmtSimNao(r.rastreado),
  },
  { chave: "categoriaHabilitacao", rotulo: "Categoria de Habilitação", filtravel: true, largura: 170, bruto: (r) => r.categoriaHabilitacao || null },
  { chave: "condutores", rotulo: "Condutores", filtravel: true, largura: 100, bruto: (r) => r.condutores ?? null },
];

function renderCelula(coluna, registro) {
  if (coluna.especial) return coluna.especial(registro);
  const b = coluna.bruto(registro);
  return b === null || b === undefined || b === "" ? "—" : String(b);
}

function valorExportacao(coluna, registro) {
  const b = coluna.bruto(registro);
  if (typeof b === "boolean") return b ? "Sim" : "Não";
  return b === null || b === undefined ? "" : b;
}

function sanitizarNomeArquivo(nome) {
  return String(nome).replace(/[\\/:*?"<>|]/g, "-").trim();
}

export default function ViaturaDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { indicadores, unidades, porId, loading } = useCbmpe();
  const { permiteIndicador } = useAcessoUsuario();

  const ind = indicadores.find((i) => i.id === id);
  const unidade = ind ? porId[ind.unidade_id] : null;
  const caminho = ind ? getCaminho(unidades, ind.unidade_id) : [];

  const [filtros, setFiltros] = React.useState({});
  const [pagina, setPagina] = React.useState(1);
  const [tamanhoPagina, setTamanhoPagina] = React.useState(20);
  const { larguras, iniciarResize, larguraTotal } = useLarguras(COLUNAS);
  const [containerRef, larguraDisponivel] = useLarguraContainer();

  // Unidade + toda a subárvore de subordinadas — mesmo princípio já usado
  // no Efetivo (corrige unidades como COMANDO GERAL/SUBCOMANDO GERAL, que
  // não têm viatura própria, só nas subordinadas).
  //
  // Regras de situação (pedido do usuário, 2026-08-18): viaturas
  // "Descarregada" são omitidas da tabela; "Devolvida" é exibida como
  // "Ativa". A transformação vem de registrosViaturas() (viaturasDashboard.js),
  // a mesma base do dashboard — pra valer também no filtro, no badge e na
  // exportação, e o dashboard nunca mostrar um total que esta tabela não bate.
  // Os registros vêm do DW já recortados pelo perfil no servidor.
  const registrosBase = React.useMemo(() => {
    if (!unidade) return [];
    const siglas = new Set(
      [unidade.sigla, ...getSubordinados(unidades, unidade.id).map((u) => u.sigla)].map(siglaDeDados)
    );
    return registrosViaturas()
      .filter((r) => siglas.has(r.sigla))
      .map((r) => ({ ...r, ome: r.sigla }));
  }, [unidade, unidades]);

  // Semeia os filtros a partir da URL quando a navegação veio de um clique
  // de drill-down num módulo do dashboard (ver linkViaturaTabela) — mesmo
  // mecanismo do EfetivoDetalhe (filtrosIniciaisDaUrl, agora compartilhado
  // em filtro-coluna.jsx).
  const searchParamsStr = searchParams.toString();
  React.useEffect(() => {
    setFiltros(filtrosIniciaisDaUrl(searchParams, COLUNAS, registrosBase));
    setPagina(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unidade?.id, searchParamsStr, registrosBase]);

  const colunasFiltraveis = React.useMemo(() => COLUNAS.filter((c) => c.filtravel), []);

  const valoresPorColuna = React.useMemo(() => {
    const mapa = {};
    colunasFiltraveis.forEach((alvo) => {
      const outras = colunasFiltraveis.filter((c) => c.chave !== alvo.chave);
      const base = registrosBase.filter((r) => outras.every((c) => passaFiltro(valorFiltro(c, r), filtros[c.chave])));
      const unicos = [...new Set(base.map((r) => valorFiltro(alvo, r)))];
      mapa[alvo.chave] = alvo.chave === "ano" || alvo.chave === "condutores"
        ? unicos.sort((a, b) => (a === "—" ? 1 : b === "—" ? -1 : Number(b) - Number(a)))
        : unicos.sort((a, b) => a.localeCompare(b, "pt-BR"));
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

  if (!ind || ind.nome !== "Viaturas") {
    return (
      <EmptyState
        icon={Car}
        titulo="Indicador de Viaturas não encontrado"
        acao={<Link to="/organograma" className="text-[13px] font-medium text-primary hover:underline">Voltar ao início</Link>}
      />
    );
  }

  if (!permiteIndicador(ind, unidade?.sigla)) {
    return (
      <EmptyState
        icon={ShieldAlert}
        titulo="Acesso restrito"
        descricao="Seu usuário não tem permissão para ver os dados de viaturas desta unidade."
        acao={<Link to="/organograma" className="text-[13px] font-medium text-primary hover:underline">Voltar ao organograma</Link>}
      />
    );
  }

  const totalPaginas = Math.max(1, Math.ceil(registrosFiltrados.length / tamanhoPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const registrosPagina = registrosFiltrados.slice(
    (paginaAtual - 1) * tamanhoPagina,
    paginaAtual * tamanhoPagina
  );

  function abrirDetalhe(registro) {
    const placa = (registro.placa || "").trim();
    if (!placa) return; // sem placa cadastrada na fonte (ex. embarcação/reboque) — sem ficha pra abrir
    navigate(`/viatura/${encodeURIComponent(placa)}`);
  }

  function exportarExcel() {
    const linhas = registrosFiltrados.map((r) =>
      Object.fromEntries(COLUNAS.map((c) => [c.rotulo, valorExportacao(c, r)]))
    );
    const planilha = XLSX.utils.json_to_sheet(linhas);
    const livro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(livro, planilha, "Viaturas");
    const nomeUnidade = sanitizarNomeArquivo(unidade?.sigla || unidade?.nome || "Unidade");
    XLSX.writeFile(livro, `Viaturas - ${nomeUnidade}.xlsx`);
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
        <Link to={`/indicador/${ind.id}`} className="hover:text-foreground">Viaturas</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">Detalhamento</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/8 text-primary">
            <Car className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">Viaturas da OME</h1>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {unidade?.nome}{temSubordinadas ? " + unidades vinculadas" : ""}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={exportarExcel}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[12px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
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
                <tr
                  key={`${r.placa}-${i}`}
                  onClick={() => abrirDetalhe(r)}
                  className="cursor-pointer text-foreground/80 transition-colors odd:bg-card even:bg-muted/60 hover:bg-primary/10"
                >
                  {COLUNAS.map((c) => (
                    <td
                      key={c.chave}
                      title={c.chave === "situacao" ? (r.situacao || undefined) : (String(valorExportacao(c, r)) || undefined)}
                      className={`px-2.5 py-2 ${CELULA_TRUNCADA}`}
                    >
                      {renderCelula(c, r)}
                    </td>
                  ))}
                </tr>
              ))}
              {registrosPagina.length === 0 && (
                <tr>
                  <td colSpan={COLUNAS.length} className="p-4 text-center text-[12px] text-muted-foreground">
                    Nenhuma viatura encontrada com esses filtros.
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
