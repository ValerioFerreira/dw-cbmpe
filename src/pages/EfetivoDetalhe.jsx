import React from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { ChevronRight, Users, ShieldAlert, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { useCbmpe } from "@/lib/cbmpe-context";
import { useAcessoUsuario } from "@/lib/useAcessoUsuario";
import { getCaminho, getSubordinados, fmtNumero } from "@/lib/cbmpe";
import EmptyState from "@/components/ui/empty-state";
import SectionCard from "@/components/ui/section-card";
import ScrollDuplo from "@/components/ui/scroll-duplo";
import { FiltroColuna, passaFiltro, valorFiltro } from "@/components/ui/filtro-coluna";
import { useLarguras, ColGroup, AlcaResize, CELULA_TRUNCADA } from "@/components/ui/tabela-colunas";
import efetivoLista from "@/data/real/efetivo_lista.json";
import lotacaoFuncao from "@/data/real/lotacao_funcao.json";

const TAMANHOS_PAGINA = [10, 20, 50];

// Função ocupada por um militar, via matrícula — fonte: Repercussão
// Financeira (CPPA, aba DIST_FUNCOES), ver etl/efetivo/extract_lotacao_funcao.py.
// Cobertura parcial (planilha em preenchimento pela CPPA): retorna null
// quando o militar ainda não tem função lançada, não "sem função"
// confirmado. Acúmulo de função (mesma matrícula, múltiplas linhas) junta
// os textos com " + ".
function funcaoDoMilitar(matricula) {
  const registros = lotacaoFuncao.por_matricula[matricula];
  if (!registros || !registros.length) return null;
  return registros.map((r) => r.funcao).join(" + ");
}

function fmtCampoCompleto(valor) {
  if (valor === null || valor === undefined || valor === "") return "—";
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";
  return String(valor);
}

// Nome completo com o trecho que corresponde ao nome de guerra em negrito
// e caixa alta (a fonte já grava nome de guerra em caixa alta).
function NomeComGuerra({ nome, nomeGuerra }) {
  if (!nome) return "—";
  if (!nomeGuerra) return nome;
  const idx = nome.toUpperCase().indexOf(nomeGuerra.toUpperCase());
  if (idx === -1) return nome;
  return (
    <>
      {nome.slice(0, idx)}
      <strong className="font-bold">{nome.slice(idx, idx + nomeGuerra.length).toUpperCase()}</strong>
      {nome.slice(idx + nomeGuerra.length)}
    </>
  );
}

// Colunas principais — sempre visíveis, com filtro estilo planilha (funil
// ao lado do nome, dropdown com busca + checkboxes). "bruto" devolve o
// valor cru (null quando ausente), usado tanto pro filtro/agregadores
// quanto pra reformatação por tipo; "especial" é a renderização padrão
// (tipo "texto") quando existe algo além de mostrar o valor cru.
const COLUNAS_PRINCIPAIS = [
  {
    chave: "postoGrad", rotulo: "Posto/Graduação", tipoPadrao: "texto", filtravel: true, largura: 150,
    bruto: (r) => r.postoGrad || null,
  },
  { chave: "matricula", rotulo: "Matrícula", tipoPadrao: "texto", filtravel: true, largura: 110, bruto: (r) => r.matricula || null },
  {
    chave: "nome", rotulo: "Nome completo", tipoPadrao: "texto", filtravel: true, largura: 240,
    bruto: (r) => r.nome || null,
    especial: (r) => <NomeComGuerra nome={r.nome} nomeGuerra={r.nomeGuerra} />,
  },
  { chave: "sexo", rotulo: "Sexo", tipoPadrao: "texto", filtravel: true, largura: 80, bruto: (r) => r.sexo || null },
  { chave: "idade", rotulo: "Idade", tipoPadrao: "inteiro", filtravel: true, largura: 75, bruto: (r) => (r.idade != null ? r.idade : null) },
  { chave: "ome", rotulo: "OME", tipoPadrao: "texto", filtravel: true, largura: 120, bruto: (r) => r.ome || null },
  {
    chave: "funcao", rotulo: "Função", tipoPadrao: "texto", filtravel: true, largura: 200,
    bruto: (r) => funcaoDoMilitar(r.matricula),
  },
];

// Colunas do painel "Verificar dados completos" — inclui dado sensível
// LGPD (raça/cor, PCD, licenças de saúde), decisão explícita do usuário
// (ver DW_GOVERNANCA.md). Também filtráveis, como as principais.
const COLUNAS_COMPLETAS = [
  ["racaCor", "Raça/Cor", "texto", 120],
  ["pcd", "PCD", "texto", 90],
  ["telefone1", "Telefone 1", "texto", 120],
  ["telefone2", "Telefone 2", "texto", 120],
  ["tempoServicoAnos", "Tempo de Serviço (anos)", "inteiro", 130],
  ["tempoObmAtualDias", "Tempo na Unidade (dias)", "inteiro", 130],
  ["omeAnteriorSp", "Unidade Anterior", "texto", 150],
  ["orgao", "Órgão", "texto", 120],
  ["horarioEspecial", "Horário Especial", "texto", 120],
  ["readaptado", "Readaptado", "texto", 110],
  ["acumuloCargos", "Acúmulo de Cargos", "texto", 130],
  ["le", "LE", "texto", 80],
  ["ltip", "LTIP", "texto", 90],
  ["afastamentoSup90Dias", "Afastamento > 90 dias", "texto", 140],
  ["suplementoPessoalNumeroAno", "Suplemento Pessoal (Nº/Ano)", "texto", 160],
  ["dataSuplementoPessoal", "Data do Suplemento Pessoal", "data", 150],
  ["aniversario", "Aniversário Hoje", "texto", 120],
  ["dataMovimentacaoSp", "Última Movimentação", "data", 150],
  ["dataIngresso", "Data de Ingresso", "data", 130],
  ["dataUltimaPromocao", "Data da Última Promoção", "data", 150],
  ["pcnh", "Promoção PCNH", "texto", 120],
].map(([campo, rotulo, tipoPadrao, largura]) => ({
  chave: campo,
  rotulo,
  tipoPadrao,
  largura,
  filtravel: true,
  bruto: (r) => (r.completo ? r.completo[campo] ?? null : null),
  especial: (r) => fmtCampoCompleto(r.completo?.[campo]),
}));

// Todas as colunas (principais + dados completos) — usada pro filtro, que
// vale mesmo com o painel de dados completos escondido (filtro fica
// aplicado; só o funil daquela coluna some da vista).
const TODAS_COLUNAS = [...COLUNAS_PRINCIPAIS, ...COLUNAS_COMPLETAS];

// Formata uma data (ISO "aaaa-mm-dd" ou qualquer coisa que o Date entenda)
// sempre em dd/mm/aaaa — lê o ISO por regex pra não sofrer de fuso horário
// (new Date("aaaa-mm-dd") vira meia-noite UTC, que pode virar o dia
// anterior num fuso negativo como o do Brasil).
function formatarData(valor) {
  if (valor === null || valor === undefined || valor === "") return "—";
  const iso = typeof valor === "string" ? valor.match(/^(\d{4})-(\d{2})-(\d{2})/) : null;
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return String(valor);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function formatarNumero(valor, casas) {
  if (valor === null || valor === undefined || valor === "") return "—";
  const n = Number(valor);
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

// Renderiza uma célula segundo o tipo fixo da coluna (tipoPadrao) — "texto"
// usa a renderização especial da coluna quando existe (ex. nome de guerra
// em negrito), os demais tipos reformatam o valor cru. O usuário não define
// mais o tipo na UI: se quiser reinterpretar, exporta pro Excel e ajusta lá
// (decisão de 2026-08-18, deixa as colunas mais estreitas).
function renderCelula(coluna, registro) {
  const tipo = coluna.tipoPadrao;
  if (tipo === "data") return formatarData(coluna.bruto(registro));
  if (tipo === "inteiro") return formatarNumero(coluna.bruto(registro), 0);
  if (tipo === "decimal") return formatarNumero(coluna.bruto(registro), 2);
  if (coluna.especial) return coluna.especial(registro);
  const b = coluna.bruto(registro);
  return b === null || b === undefined || b === "" ? "—" : String(b);
}

// Valor de uma célula para exportação — sempre texto/número cru (nunca a
// JSX de renderCelula), respeitando o tipo fixo da coluna.
function valorExportacao(coluna, registro) {
  const tipo = coluna.tipoPadrao;
  const b = coluna.bruto(registro);
  if (tipo === "data") return formatarData(b);
  if (tipo === "inteiro" || tipo === "decimal") {
    if (b === null || b === undefined || b === "") return "";
    const n = Number(b);
    return Number.isNaN(n) ? "" : n;
  }
  if (typeof b === "boolean") return b ? "Sim" : "Não";
  return b === null || b === undefined ? "" : String(b);
}

function sanitizarNomeArquivo(nome) {
  return String(nome).replace(/[\\/:*?"<>|]/g, "-").trim();
}

// Cabeçalho de uma coluna: rótulo (truncado) + funil de filtro + alça de
// redimensionamento na borda direita (sem seletor de tipo, sem agregadores).
function CabecalhoColuna({ coluna, filtro, onResize }) {
  return (
    <th className="relative overflow-hidden px-2.5 py-2 text-left align-middle">
      <div className="flex min-w-0 items-center gap-1">
        <span className="truncate">{coluna.rotulo}</span>
        {filtro && <span className="shrink-0">{filtro}</span>}
      </div>
      <AlcaResize onMouseDown={(e) => onResize(coluna.chave, e)} />
    </th>
  );
}

export default function EfetivoDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setor = searchParams.get("setor") || null;
  const { indicadores, unidades, porId, loading } = useCbmpe();
  const { permiteIndicador } = useAcessoUsuario();

  const ind = indicadores.find((i) => i.id === id);
  const unidade = ind ? porId[ind.unidade_id] : null;
  const caminho = ind ? getCaminho(unidades, ind.unidade_id) : [];

  const [filtros, setFiltros] = React.useState({});
  const [pagina, setPagina] = React.useState(1);
  const [tamanhoPagina, setTamanhoPagina] = React.useState(20);
  const { larguras, iniciarResize, larguraTotal } = useLarguras(TODAS_COLUNAS);

  const registrosBase = React.useMemo(() => {
    if (!unidade) return [];
    // Filtro por setor/divisão (vindo de "Setores Vinculados" na página da
    // Diretoria): só a própria unidade, restrita às matrículas que a
    // Repercussão Financeira (DIST_FUNCOES) já lançou naquela divisão —
    // nunca soma unidades subordinadas nesse modo.
    // Militares adidos (omeExibicao preenchido, ex. "ADIDO") contam no
    // efetivo do Comando Geral mas mostram a origem real na coluna OME — só
    // o comandante geral mostra "COMANDO GERAL". Ver extract_efetivo.py.
    // Ordenação global por antiguidade (campo "ordem" = ordemHierarquica do
    // Neon), não agrupada por OME — pedido do usuário (2026-08-19). Quem não
    // tem ordem lançada (null) vai pro fim.
    const porAntiguidade = (a, b) =>
      (a.ordem ?? Number.POSITIVE_INFINITY) - (b.ordem ?? Number.POSITIVE_INFINITY);
    if (setor) {
      const matriculasDoSetor = new Set(lotacaoFuncao.por_unidade_divisao[unidade.sigla]?.[setor] || []);
      return (efetivoLista.por_unidade[unidade.sigla] || [])
        .filter((r) => matriculasDoSetor.has(r.matricula))
        .map((r) => ({ ...r, ome: r.omeExibicao || unidade.sigla }))
        .sort(porAntiguidade);
    }
    const siglas = [unidade.sigla, ...getSubordinados(unidades, unidade.id).map((u) => u.sigla)];
    return siglas
      .flatMap((sigla) =>
        (efetivoLista.por_unidade[sigla] || []).map((r) => ({ ...r, ome: r.omeExibicao || sigla }))
      )
      .sort(porAntiguidade);
  }, [unidade, unidades, setor]);

  // Reseta filtros/seleção ao trocar de unidade ou de setor (navegação pelo
  // breadcrumb ou por "Setores Vinculados").
  React.useEffect(() => {
    setFiltros({});
    setPagina(1);
  }, [unidade?.id, setor]);

  const colunasFiltraveis = React.useMemo(() => TODAS_COLUNAS.filter((c) => c.filtravel), []);

  // Valores únicos disponíveis por coluna, recalculados só quando a base
  // ou os filtros mudam (não a cada render) — com 27 colunas filtráveis
  // isso evita recalcular tudo a cada digitação/paginação/seleção.
  const valoresPorColuna = React.useMemo(() => {
    const mapa = {};
    colunasFiltraveis.forEach((alvo) => {
      const outras = colunasFiltraveis.filter((c) => c.chave !== alvo.chave);
      const base = registrosBase.filter((r) => outras.every((c) => passaFiltro(valorFiltro(c, r), filtros[c.chave])));
      const unicos = [...new Set(base.map((r) => valorFiltro(alvo, r)))];
      mapa[alvo.chave] = alvo.chave === "idade"
        ? unicos.sort((a, b) => (a === "—" ? 1 : b === "—" ? -1 : Number(a) - Number(b)))
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

  if (!ind || ind.nome !== "Efetivo") {
    return (
      <EmptyState
        icon={Users}
        titulo="Indicador de Efetivo não encontrado"
        acao={<Link to="/organograma" className="text-[13px] font-medium text-primary hover:underline">Voltar ao início</Link>}
      />
    );
  }

  if (!permiteIndicador(ind, unidade?.sigla)) {
    return (
      <EmptyState
        icon={ShieldAlert}
        titulo="Acesso restrito"
        descricao="Seu usuário não tem permissão para ver os dados de efetivo desta unidade."
        acao={<Link to="/organograma" className="text-[13px] font-medium text-primary hover:underline">Voltar ao organograma</Link>}
      />
    );
  }

  const colunasVisiveis = TODAS_COLUNAS;

  const totalPaginas = Math.max(1, Math.ceil(registrosFiltrados.length / tamanhoPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const registrosPagina = registrosFiltrados.slice(
    (paginaAtual - 1) * tamanhoPagina,
    paginaAtual * tamanhoPagina
  );

  function abrirDetalhe(registro) {
    const matricula = (registro.matricula || "").toString().trim();
    if (!matricula) return; // sem matrícula não há ficha pra abrir
    navigate(`/militar/${encodeURIComponent(matricula)}`);
  }

  function exportarExcel() {
    const linhas = registrosFiltrados.map((r) =>
      Object.fromEntries(
        colunasVisiveis.map((c) => [c.rotulo, valorExportacao(c, r)])
      )
    );
    const planilha = XLSX.utils.json_to_sheet(linhas);
    const livro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(livro, planilha, "Efetivo");
    const nomeUnidade = sanitizarNomeArquivo(unidade?.sigla || unidade?.nome || "Unidade");
    const sufixoSetor = setor ? ` - ${sanitizarNomeArquivo(setor)}` : "";
    XLSX.writeFile(livro, `Efetivo - ${nomeUnidade}${sufixoSetor}.xlsx`);
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
        <Link to={`/indicador/${ind.id}`} className="hover:text-foreground">Efetivo</Link>
        <ChevronRight className="h-3 w-3" />
        {setor ? (
          <>
            <Link to={`/efetivo/${ind.id}`} className="hover:text-foreground">Detalhamento</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground">{setor}</span>
          </>
        ) : (
          <span className="text-foreground">Detalhamento</span>
        )}
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/8 text-primary">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">Militares da OME</h1>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {setor ? `${unidade?.nome} · ${setor}` : `${unidade?.nome}${temSubordinadas ? " + unidades vinculadas" : ""}`}
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

        <ScrollDuplo maxHeight="36rem">
          <table className="table-fixed border-collapse text-left" style={{ width: larguraTotal }}>
            <ColGroup colunas={colunasVisiveis} larguras={larguras} />
            <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
              <tr className="border-b-2 border-primary/25 text-[10.5px] font-bold uppercase tracking-wide text-foreground/70">
                {colunasVisiveis.map((c) => (
                  <CabecalhoColuna
                    key={c.chave}
                    coluna={c}
                    onResize={iniciarResize}
                    filtro={c.filtravel && (
                      <FiltroColuna
                        valoresDisponiveis={valoresPorColuna[c.chave] || []}
                        selecionado={filtros[c.chave]}
                        onChange={(next) => setFiltros((prev) => ({ ...prev, [c.chave]: next }))}
                      />
                    )}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {registrosPagina.map((r, i) => (
                <tr
                  key={`${r.matricula}-${i}`}
                  onClick={() => abrirDetalhe(r)}
                  className="cursor-pointer text-foreground/80 transition-colors odd:bg-card even:bg-muted/60 hover:bg-primary/10"
                >
                  {colunasVisiveis.map((c) => (
                    <td
                      key={c.chave}
                      title={String(valorExportacao(c, r)) || undefined}
                      className={`px-2.5 py-2 ${CELULA_TRUNCADA}`}
                    >
                      {renderCelula(c, r)}
                    </td>
                  ))}
                </tr>
              ))}
              {registrosPagina.length === 0 && (
                <tr>
                  <td colSpan={colunasVisiveis.length} className="p-4 text-center text-[12px] text-muted-foreground">
                    Nenhum militar encontrado com esses filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </ScrollDuplo>
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
