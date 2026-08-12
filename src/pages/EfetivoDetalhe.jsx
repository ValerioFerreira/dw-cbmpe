import React from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ChevronRight, Users, Filter, ArrowLeft } from "lucide-react";
import { useCbmpe } from "@/lib/cbmpe-context";
import { getCaminho, getSubordinados, fmtNumero } from "@/lib/cbmpe";
import { Checkbox } from "@/components/ui/checkbox";
import EmptyState from "@/components/ui/empty-state";
import SectionCard from "@/components/ui/section-card";
import efetivoLista from "@/data/real/efetivo_lista.json";

const LARGURA_PAINEL_FILTRO = 256;

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

function passaFiltro(valor, selecionado) {
  if (!selecionado) return true;
  return selecionado.has(valor);
}

// Valor de uma coluna pro filtro (checkboxes de valor único) — booleans
// viram "Sim"/"Não" (mesma convenção de fmtCampoCompleto) em vez de
// "true"/"false" cru, ausência vira "—".
function valorFiltro(coluna, r) {
  const b = coluna.bruto(r);
  if (typeof b === "boolean") return b ? "Sim" : "Não";
  return b === null || b === undefined || b === "" ? "—" : String(b);
}

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

// Dropdown de filtro de uma coluna — ícone de funil + painel com busca,
// "Selecionar tudo"/"Limpar seleção" e lista de checkboxes. Posicionado
// manualmente (via getBoundingClientRect do botão + portal), em vez de um
// Popover/floating-ui automático — dentro desta tabela (cabeçalho sticky
// + rolagem horizontal e vertical) o cálculo automático de posição
// aparecia deslocado para a direita, às vezes fora da viewport; o cálculo
// manual garante o balão sempre logo abaixo do funil, com clamp pra nunca
// estourar a borda direita da tela.
function FiltroColuna({ valoresDisponiveis, selecionado, onChange }) {
  const [busca, setBusca] = React.useState("");
  const [aberto, setAberto] = React.useState(false);
  const [pos, setPos] = React.useState({ top: 0, left: 0 });
  const botaoRef = React.useRef(null);
  const painelRef = React.useRef(null);

  function calcularPosicao() {
    if (!botaoRef.current) return;
    // `html { zoom: 1.25 }` (src/index.css) reescala a página inteira. Um
    // elemento "position: fixed" dentro do <html> zoomado interpreta seu
    // left/top NO ESPAÇO LOCAL (pré-zoom), mas getBoundingClientRect()/
    // innerWidth sempre devolvem pixels reais (pós-zoom) — sem dividir
    // pelo zoom aqui, o balão saía deslocado (o motivo original do bug
    // relatado: aparecia bem mais à direita/embaixo do que devia).
    const zoom = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
    const r = botaoRef.current.getBoundingClientRect();
    const larguraViewport = window.innerWidth / zoom;
    const left = Math.min(
      Math.max(8, r.left / zoom),
      larguraViewport - LARGURA_PAINEL_FILTRO - 8
    );
    setPos({ top: r.bottom / zoom + 4, left });
  }

  function alternarAberto() {
    if (!aberto) calcularPosicao();
    setAberto((v) => !v);
  }

  React.useEffect(() => {
    if (!aberto) return;
    function aoClicarFora(e) {
      if (painelRef.current?.contains(e.target) || botaoRef.current?.contains(e.target)) return;
      setAberto(false);
    }
    function aoRolarOuRedimensionar() {
      calcularPosicao();
    }
    document.addEventListener("mousedown", aoClicarFora);
    window.addEventListener("scroll", aoRolarOuRedimensionar, true);
    window.addEventListener("resize", aoRolarOuRedimensionar);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      window.removeEventListener("scroll", aoRolarOuRedimensionar, true);
      window.removeEventListener("resize", aoRolarOuRedimensionar);
    };
  }, [aberto]);

  const visiveis = React.useMemo(() => {
    const q = busca.trim().toLowerCase();
    return q ? valoresDisponiveis.filter((v) => v.toLowerCase().includes(q)) : valoresDisponiveis;
  }, [valoresDisponiveis, busca]);

  function alternar(v) {
    const base = selecionado ? new Set(selecionado) : new Set(valoresDisponiveis);
    if (base.has(v)) base.delete(v); else base.add(v);
    onChange(base);
  }

  const ativo = selecionado !== undefined;

  return (
    <>
      <button
        ref={botaoRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); alternarAberto(); }}
        aria-label="Filtrar coluna"
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded transition-colors ${
          ativo ? "text-primary" : "text-muted-foreground/50 hover:text-foreground"
        }`}
      >
        <Filter className="h-3 w-3" fill={ativo ? "currentColor" : "none"} />
      </button>
      {aberto && createPortal(
        <div
          ref={painelRef}
          onClick={(e) => e.stopPropagation()}
          style={{ position: "fixed", top: pos.top, left: pos.left, width: LARGURA_PAINEL_FILTRO }}
          className="z-50 rounded-md border border-border bg-popover text-popover-foreground shadow-md normal-case tracking-normal"
        >
          <div className="border-b border-border p-2">
            <input
              autoFocus
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar valor"
              className="h-7 w-full rounded-md border border-input bg-background px-2 text-[12px] outline-none focus:border-primary"
            />
          </div>
          <div className="flex gap-3 border-b border-border p-2 text-[11px] font-medium text-primary">
            <button type="button" onClick={() => onChange(undefined)}>Selecionar tudo</button>
            <button type="button" onClick={() => onChange(new Set())}>Limpar seleção</button>
          </div>
          <div className="max-h-56 overflow-y-auto p-1">
            {visiveis.map((v) => (
              <label key={v} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[12px] hover:bg-muted/60">
                <Checkbox
                  checked={selecionado ? selecionado.has(v) : true}
                  onCheckedChange={() => alternar(v)}
                />
                <span className="truncate">{v}</span>
              </label>
            ))}
            {visiveis.length === 0 && (
              <p className="px-2 py-3 text-center text-[11px] text-muted-foreground">Nenhum valor encontrado.</p>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

// Cabeçalho de uma coluna: rótulo clicável (seleciona a coluna pros
// agregadores), funil de filtro (só nas principais) e seletor de tipo.
function CabecalhoColuna({ coluna, selecionada, onSelecionar, tipo, onTipo, filtro }) {
  return (
    <th className={`p-2.5 text-left align-bottom ${selecionada ? "bg-primary/10" : ""}`}>
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
  const { indicadores, unidades, porId, loading } = useCbmpe();

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
    const siglas = [unidade.sigla, ...getSubordinados(unidades, unidade.id).map((u) => u.sigla)];
    return siglas.flatMap((sigla) =>
      (efetivoLista.por_unidade[sigla] || []).map((r) => ({ ...r, ome: sigla }))
    );
  }, [unidade, unidades]);

  // Reseta filtros/seleção ao trocar de unidade (navegação pelo breadcrumb).
  React.useEffect(() => {
    setFiltros({});
    setColunaSelecionada(null);
    setPagina(1);
  }, [unidade?.id]);

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
        <span className="text-foreground">Detalhamento</span>
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
              {unidade?.nome}{temSubordinadas ? " + unidades vinculadas" : ""}
            </p>
          </div>
        </div>
        <Link
          to={`/indicador/${ind.id}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao indicador
        </Link>
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
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-border text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
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
                  className="cursor-pointer text-foreground/80 hover:bg-muted/40"
                >
                  {colunasVisiveis.map((c) => (
                    <td
                      key={c.chave}
                      className={`p-2.5 ${c.quebrar ? "" : "whitespace-nowrap"} ${colunaSelecionada === c.chave ? "bg-primary/5" : ""}`}
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
