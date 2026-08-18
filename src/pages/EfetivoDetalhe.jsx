import React from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { ChevronRight, Users, ShieldAlert, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { useCbmpe } from "@/lib/cbmpe-context";
import { useAcessoUsuario } from "@/lib/useAcessoUsuario";
import { getCaminho, getSubordinados, fmtNumero } from "@/lib/cbmpe";
import EmptyState from "@/components/ui/empty-state";
import SectionCard from "@/components/ui/section-card";
import { FiltroColuna, passaFiltro, valorFiltro } from "@/components/ui/filtro-coluna";
import efetivoLista from "@/data/real/efetivo_lista.json";
import lotacaoFuncao from "@/data/real/lotacao_funcao.json";

const TAMANHOS_PAGINA = [10, 20, 50];

// Postos vão de Aspirante a Coronel; o resto (Subtenente a Soldado) é
// graduação — usado só pra rotular a célula de Posto/Graduação.
function isOficial(postoGrad) {
  const p = (postoGrad || "").trim();
  if (!p) return true;
  if (/sub/i.test(p)) return false;
  if (/sgt/i.test(p)) return false;
  if (/^(cb|sd|cabo|soldado)\b/i.test(p)) return false;
  return true;
}

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
    chave: "postoGrad", rotulo: "Posto/Graduação", tipoPadrao: "texto", filtravel: true,
    bruto: (r) => r.postoGrad || null,
    especial: (r) => (
      <>
        <div className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
          {isOficial(r.postoGrad) ? "Posto" : "Graduação"}
        </div>
        <div>{r.postoGrad || "—"}</div>
      </>
    ),
  },
  { chave: "matricula", rotulo: "Matrícula", tipoPadrao: "texto", filtravel: true, bruto: (r) => r.matricula || null },
  {
    chave: "nome", rotulo: "Nome completo", tipoPadrao: "texto", filtravel: true, quebrar: true,
    bruto: (r) => r.nome || null,
    especial: (r) => <NomeComGuerra nome={r.nome} nomeGuerra={r.nomeGuerra} />,
  },
  { chave: "sexo", rotulo: "Sexo", tipoPadrao: "texto", filtravel: true, bruto: (r) => r.sexo || null },
  { chave: "idade", rotulo: "Idade", tipoPadrao: "inteiro", filtravel: true, bruto: (r) => (r.idade != null ? r.idade : null) },
  { chave: "ome", rotulo: "OME", tipoPadrao: "texto", filtravel: true, bruto: (r) => r.ome || null },
  {
    chave: "funcao", rotulo: "Função", tipoPadrao: "texto", filtravel: true, quebrar: true,
    bruto: (r) => funcaoDoMilitar(r.matricula),
  },
];

// Colunas do painel "Verificar dados completos" — inclui dado sensível
// LGPD (raça/cor, PCD, licenças de saúde), decisão explícita do usuário
// (ver DW_GOVERNANCA.md). Também filtráveis, como as principais.
const COLUNAS_COMPLETAS = [
  ["racaCor", "Raça/Cor", "texto"],
  ["pcd", "PCD", "texto"],
  ["telefone1", "Telefone 1", "texto"],
  ["telefone2", "Telefone 2", "texto"],
  ["tempoServicoAnos", "Tempo de Serviço (anos)", "inteiro"],
  ["tempoObmAtualDias", "Tempo na Unidade (dias)", "inteiro"],
  ["omeAnteriorSp", "Unidade Anterior", "texto"],
  ["orgao", "Órgão", "texto"],
  ["horarioEspecial", "Horário Especial", "texto"],
  ["readaptado", "Readaptado", "texto"],
  ["acumuloCargos", "Acúmulo de Cargos", "texto"],
  ["le", "LE", "texto"],
  ["ltip", "LTIP", "texto"],
  ["afastamentoSup90Dias", "Afastamento > 90 dias", "texto"],
  ["suplementoPessoalNumeroAno", "Suplemento Pessoal (Nº/Ano)", "texto"],
  ["dataSuplementoPessoal", "Data do Suplemento Pessoal", "data"],
  ["aniversario", "Aniversário Hoje", "texto"],
  ["dataMovimentacaoSp", "Última Movimentação", "data"],
  ["dataIngresso", "Data de Ingresso", "data"],
  ["dataUltimaPromocao", "Data da Última Promoção", "data"],
  ["pcnh", "Promoção PCNH", "texto"],
].map(([campo, rotulo, tipoPadrao]) => ({
  chave: campo,
  rotulo,
  tipoPadrao,
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

// Renderiza uma célula segundo o tipo escolhido pro usuário pra essa
// coluna — "texto" (padrão) usa a renderização especial da coluna quando
// existe (ex. nome de guerra em negrito), os demais tipos reformatam o
// valor cru, ignorando a renderização especial.
function renderCelula(coluna, registro, tipo) {
  if (tipo === "data") return formatarData(coluna.bruto(registro));
  if (tipo === "inteiro") return formatarNumero(coluna.bruto(registro), 0);
  if (tipo === "decimal") return formatarNumero(coluna.bruto(registro), 2);
  if (coluna.especial) return coluna.especial(registro);
  const b = coluna.bruto(registro);
  return b === null || b === undefined || b === "" ? "—" : String(b);
}

// Valor de uma célula para exportação — sempre texto/número cru (nunca a
// JSX de renderCelula), respeitando o tipo escolhido pelo usuário pra
// aquela coluna (mesma lógica de formatação, sem negrito de nome de guerra).
function valorExportacao(coluna, registro, tipo) {
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

// Agregadores no estilo da barra de status do Google Sheets: Contagem e
// Contagem Distinta sempre que há valores; Soma/Média/Mínimo/Máximo só
// quando a coluna está tipada como número (inteiro ou decimal) — "sempre
// que possível", conforme pedido.
function calcularAgregados(registros, coluna, tipo) {
  const valores = registros.map((r) => coluna.bruto(r)).filter((v) => v !== null && v !== undefined && v !== "");
  const contagem = valores.length;
  const distintos = new Set(valores.map(String)).size;
  let soma = null, media = null, minimo = null, maximo = null;
  if (tipo === "inteiro" || tipo === "decimal") {
    const nums = valores.map(Number).filter((n) => !Number.isNaN(n));
    if (nums.length) {
      soma = nums.reduce((a, b) => a + b, 0);
      media = soma / nums.length;
      minimo = Math.min(...nums);
      maximo = Math.max(...nums);
    }
  }
  return { contagem, distintos, soma, media, minimo, maximo };
}

// Cabeçalho de uma coluna: rótulo clicável (seleciona a coluna pros
// agregadores), funil de filtro (só nas principais) e seletor de tipo.
function CabecalhoColuna({ coluna, selecionada, onSelecionar, tipo, onTipo, filtro }) {
  return (
    <th className={`px-3 py-2.5 text-left align-bottom ${selecionada ? "bg-primary/10" : ""}`}>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onSelecionar}
          title="Selecionar coluna para ver os agregadores"
          className={`text-left ${selecionada ? "text-primary" : ""}`}
        >
          {coluna.rotulo}
        </button>
        {filtro}
        <select
          value={tipo}
          onChange={(e) => onTipo(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          title="Tipo da coluna"
          className="h-4 shrink-0 rounded border-none bg-transparent text-[9px] font-normal normal-case tracking-normal text-muted-foreground/70 outline-none"
        >
          <option value="texto">Texto</option>
          <option value="data">Data</option>
          <option value="inteiro">Nº inteiro</option>
          <option value="decimal">Nº decimal</option>
        </select>
      </div>
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
  const [tiposColuna, setTiposColuna] = React.useState({});
  const [colunaSelecionada, setColunaSelecionada] = React.useState(null);
  const [pagina, setPagina] = React.useState(1);
  const [tamanhoPagina, setTamanhoPagina] = React.useState(20);

  const registrosBase = React.useMemo(() => {
    if (!unidade) return [];
    // Filtro por setor/divisão (vindo de "Setores Vinculados" na página da
    // Diretoria): só a própria unidade, restrita às matrículas que a
    // Repercussão Financeira (DIST_FUNCOES) já lançou naquela divisão —
    // nunca soma unidades subordinadas nesse modo.
    if (setor) {
      const matriculasDoSetor = new Set(lotacaoFuncao.por_unidade_divisao[unidade.sigla]?.[setor] || []);
      return (efetivoLista.por_unidade[unidade.sigla] || [])
        .filter((r) => matriculasDoSetor.has(r.matricula))
        .map((r) => ({ ...r, ome: unidade.sigla }));
    }
    const siglas = [unidade.sigla, ...getSubordinados(unidades, unidade.id).map((u) => u.sigla)];
    return siglas.flatMap((sigla) =>
      (efetivoLista.por_unidade[sigla] || []).map((r) => ({ ...r, ome: sigla }))
    );
  }, [unidade, unidades, setor]);

  // Reseta filtros/seleção ao trocar de unidade ou de setor (navegação pelo
  // breadcrumb ou por "Setores Vinculados").
  React.useEffect(() => {
    setFiltros({});
    setColunaSelecionada(null);
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
  const colunaAgregada = colunasVisiveis.find((c) => c.chave === colunaSelecionada);
  const tipoColunaAgregada = colunaAgregada ? (tiposColuna[colunaAgregada.chave] || colunaAgregada.tipoPadrao) : null;
  const agregados = colunaAgregada ? calcularAgregados(registrosFiltrados, colunaAgregada, tipoColunaAgregada) : null;

  const totalPaginas = Math.max(1, Math.ceil(registrosFiltrados.length / tamanhoPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const registrosPagina = registrosFiltrados.slice(
    (paginaAtual - 1) * tamanhoPagina,
    paginaAtual * tamanhoPagina
  );

  function abrirDetalhe(registro) {
    navigate(`/em-construcao/${encodeURIComponent(registro.matricula ?? "registro")}`, {
      state: { titulo: "Dados do Militar" },
    });
  }

  function exportarExcel() {
    const linhas = registrosFiltrados.map((r) =>
      Object.fromEntries(
        colunasVisiveis.map((c) => [c.rotulo, valorExportacao(c, r, tiposColuna[c.chave] || c.tipoPadrao)])
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

        <div className="max-h-[36rem] overflow-y-auto overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-muted/70 backdrop-blur-sm">
              <tr className="border-b-2 border-primary/25 text-[10.5px] font-bold uppercase tracking-wide text-foreground/70">
                {colunasVisiveis.map((c) => (
                  <CabecalhoColuna
                    key={c.chave}
                    coluna={c}
                    selecionada={colunaSelecionada === c.chave}
                    onSelecionar={() => setColunaSelecionada((prev) => (prev === c.chave ? null : c.chave))}
                    tipo={tiposColuna[c.chave] || c.tipoPadrao}
                    onTipo={(tipo) => setTiposColuna((prev) => ({ ...prev, [c.chave]: tipo }))}
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
            <tbody className="divide-y divide-border">
              {registrosPagina.map((r, i) => (
                <tr
                  key={`${r.matricula}-${i}`}
                  onClick={() => abrirDetalhe(r)}
                  className="cursor-pointer text-foreground/80 transition-colors even:bg-muted/25 hover:bg-primary/10"
                >
                  {colunasVisiveis.map((c) => (
                    <td
                      key={c.chave}
                      className={`px-3 py-2.5 ${c.quebrar ? "" : "whitespace-nowrap"} ${colunaSelecionada === c.chave ? "bg-primary/5" : ""}`}
                    >
                      {renderCelula(c, r, tiposColuna[c.chave] || c.tipoPadrao)}
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
        </div>

        {/* Barra de agregadores da coluna selecionada — canto inferior direito da tabela. */}
        {agregados && (
          <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 border-t border-border bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
            <span className="font-semibold text-foreground">{colunaAgregada.rotulo}</span>
            <span>Contagem: <strong className="font-medium text-foreground">{agregados.contagem}</strong></span>
            <span>Contagem distinta: <strong className="font-medium text-foreground">{agregados.distintos}</strong></span>
            {agregados.soma != null && <span>Soma: <strong className="font-medium text-foreground">{formatarNumero(agregados.soma, tipoColunaAgregada === "decimal" ? 2 : 0)}</strong></span>}
            {agregados.media != null && <span>Média: <strong className="font-medium text-foreground">{formatarNumero(agregados.media, 2)}</strong></span>}
            {agregados.minimo != null && <span>Mínimo: <strong className="font-medium text-foreground">{formatarNumero(agregados.minimo, tipoColunaAgregada === "decimal" ? 2 : 0)}</strong></span>}
            {agregados.maximo != null && <span>Máximo: <strong className="font-medium text-foreground">{formatarNumero(agregados.maximo, tipoColunaAgregada === "decimal" ? 2 : 0)}</strong></span>}
          </div>
        )}
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
