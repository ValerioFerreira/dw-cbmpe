import React from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ChevronRight, Calendar, BarChart3, Table2
} from "lucide-react";
import { useCbmpe } from "@/lib/cbmpe-context";
import {
  CATEGORIAS, getCaminho, getSubordinados, fmtNumero, fmtMoeda
} from "@/lib/cbmpe";
import EmptyState from "@/components/ui/empty-state";
import SectionCard from "@/components/ui/section-card";
import efetivoLista from "@/data/real/efetivo_lista.json";
import viaturasLista from "@/data/real/viaturas_lista.json";

const QTD_MODULOS_PLACEHOLDER = 4;
const TAMANHO_PAGINA = 25;

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

// Colunas do painel "Verificar dados completos" — inclui dado sensível
// LGPD (raça/cor, PCD, licenças de saúde), decisão explícita do usuário
// (ver DW_GOVERNANCA.md). Só aparecem quando o sub-objeto "completo" tem
// dado real — até o windmill-neon.py atualizado rodar, ficam vazias.
const COLUNAS_COMPLETAS = [
  ["racaCor", "Raça/Cor"],
  ["pcd", "PCD"],
  ["telefone1", "Telefone 1"],
  ["telefone2", "Telefone 2"],
  ["tempoServicoAnos", "Tempo de Serviço (anos)"],
  ["tempoObmAtualDias", "Tempo na Unidade (dias)"],
  ["omeAnteriorSp", "Unidade Anterior"],
  ["orgao", "Órgão"],
  ["horarioEspecial", "Horário Especial"],
  ["readaptado", "Readaptado"],
  ["acumuloCargos", "Acúmulo de Cargos"],
  ["le", "LE"],
  ["ltip", "LTIP"],
  ["afastamentoSup90Dias", "Afastamento > 90 dias"],
  ["suplementoPessoalNumeroAno", "Suplemento Pessoal (Nº/Ano)"],
  ["dataSuplementoPessoal", "Data do Suplemento Pessoal"],
  ["aniversario", "Aniversário Hoje"],
  ["dataMovimentacaoSp", "Última Movimentação"],
  ["dataIngresso", "Data de Ingresso"],
  ["dataUltimaPromocao", "Data da Última Promoção"],
  ["pcnh", "Promoção PCNH"],
];

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

// Tabela de Efetivo — unidade + toda a subárvore de subordinadas, com
// filtros e paginação. Campos e critério de exposição confirmados com o
// usuário (ver DW_PLANEJAMENTO.md/DW_GOVERNANCA.md).
function TabelaEfetivo({ unidade, unidades }) {
  const navigate = useNavigate();
  const [buscaNome, setBuscaNome] = React.useState("");
  const [buscaMatricula, setBuscaMatricula] = React.useState("");
  const [filtroPosto, setFiltroPosto] = React.useState("");
  const [filtroSexo, setFiltroSexo] = React.useState("");
  const [pagina, setPagina] = React.useState(1);
  const [mostrarCompleto, setMostrarCompleto] = React.useState(false);

  const registrosBase = React.useMemo(() => {
    if (!unidade) return [];
    const siglas = [unidade.sigla, ...getSubordinados(unidades, unidade.id).map((u) => u.sigla)];
    return siglas.flatMap((sigla) =>
      (efetivoLista.por_unidade[sigla] || []).map((r) => ({ ...r, ome: sigla }))
    );
  }, [unidade, unidades]);

  const opcoesPosto = React.useMemo(
    () => [...new Set(registrosBase.map((r) => r.postoGrad).filter(Boolean))],
    [registrosBase]
  );
  const opcoesSexo = React.useMemo(
    () => [...new Set(registrosBase.map((r) => r.sexo).filter(Boolean))],
    [registrosBase]
  );
  const opcoesNome = React.useMemo(
    () => [...new Set(registrosBase.flatMap((r) => [r.nome, r.nomeGuerra].filter(Boolean)))],
    [registrosBase]
  );
  const opcoesMatricula = React.useMemo(
    () => [...new Set(registrosBase.map((r) => r.matricula).filter(Boolean))],
    [registrosBase]
  );

  const registrosFiltrados = React.useMemo(() => {
    const nomeQ = buscaNome.trim().toUpperCase();
    const matQ = buscaMatricula.trim().toUpperCase();
    return registrosBase.filter((r) => {
      if (filtroPosto && r.postoGrad !== filtroPosto) return false;
      if (filtroSexo && r.sexo !== filtroSexo) return false;
      if (nomeQ && !`${r.nome || ""} ${r.nomeGuerra || ""}`.toUpperCase().includes(nomeQ)) return false;
      if (matQ && !(r.matricula || "").toUpperCase().includes(matQ)) return false;
      return true;
    });
  }, [registrosBase, filtroPosto, filtroSexo, buscaNome, buscaMatricula]);

  React.useEffect(() => {
    setPagina(1);
  }, [filtroPosto, filtroSexo, buscaNome, buscaMatricula]);

  if (registrosBase.length === 0) return null;

  const totalPaginas = Math.max(1, Math.ceil(registrosFiltrados.length / TAMANHO_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const registrosPagina = registrosFiltrados.slice(
    (paginaAtual - 1) * TAMANHO_PAGINA,
    paginaAtual * TAMANHO_PAGINA
  );

  function abrirDetalhe(registro) {
    navigate(`/em-construcao/${encodeURIComponent(registro.matricula ?? "registro")}`, {
      state: { titulo: "Dados do Militar" },
    });
  }

  return (
    <SectionCard
      titulo="Militares da Unidade"
      subtitulo={`${registrosFiltrados.length} de ${registrosBase.length} registros (unidade + subordinadas)`}
      semPadding
    >
      <div className="flex flex-wrap gap-2 border-b border-border p-3">
        <input
          list="efetivo-nomes"
          value={buscaNome}
          onChange={(e) => setBuscaNome(e.target.value)}
          placeholder="Buscar por nome ou nome de guerra"
          className="h-8 min-w-[220px] flex-1 rounded-md border border-input bg-background px-2.5 text-[12px] outline-none focus:border-primary"
        />
        <datalist id="efetivo-nomes">
          {opcoesNome.map((n) => <option key={n} value={n} />)}
        </datalist>

        <input
          list="efetivo-matriculas"
          value={buscaMatricula}
          onChange={(e) => setBuscaMatricula(e.target.value)}
          placeholder="Buscar por matrícula"
          className="h-8 min-w-[140px] rounded-md border border-input bg-background px-2.5 text-[12px] outline-none focus:border-primary"
        />
        <datalist id="efetivo-matriculas">
          {opcoesMatricula.map((m) => <option key={m} value={m} />)}
        </datalist>

        <select
          value={filtroPosto}
          onChange={(e) => setFiltroPosto(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-[12px] outline-none focus:border-primary"
        >
          <option value="">Posto/Graduação (todos)</option>
          {opcoesPosto.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>

        <select
          value={filtroSexo}
          onChange={(e) => setFiltroSexo(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-[12px] outline-none focus:border-primary"
        >
          <option value="">Sexo (todos)</option>
          {opcoesSexo.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <button
          type="button"
          onClick={() => setMostrarCompleto((v) => !v)}
          className="ml-auto h-8 rounded-md border border-input bg-background px-3 text-[12px] font-medium text-foreground transition-colors hover:bg-muted"
        >
          {mostrarCompleto ? "Ocultar" : "Verificar"} dados completos
        </button>
      </div>

      <div className="max-h-[32rem] overflow-y-auto overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead className="sticky top-0 bg-card">
            <tr className="border-b border-border text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="p-2.5 text-left">Posto/Graduação</th>
              <th className="p-2.5 text-left">Matrícula</th>
              <th className="p-2.5 text-left">Nome completo</th>
              <th className="p-2.5 text-left">Sexo</th>
              <th className="p-2.5 text-left">Idade</th>
              <th className="p-2.5 text-left">OME</th>
              {mostrarCompleto && COLUNAS_COMPLETAS.map(([campo, rotulo]) => (
                <th key={campo} className="p-2.5 text-left">{rotulo}</th>
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
                <td className="whitespace-nowrap p-2.5">
                  <div className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {isOficial(r.postoGrad) ? "Posto" : "Graduação"}
                  </div>
                  <div>{r.postoGrad || "—"}</div>
                </td>
                <td className="whitespace-nowrap p-2.5">{r.matricula || "—"}</td>
                <td className="p-2.5"><NomeComGuerra nome={r.nome} nomeGuerra={r.nomeGuerra} /></td>
                <td className="whitespace-nowrap p-2.5">{r.sexo || "—"}</td>
                <td className="whitespace-nowrap p-2.5">{r.idade ?? "—"}</td>
                <td className="whitespace-nowrap p-2.5">{r.ome || "—"}</td>
                {mostrarCompleto && COLUNAS_COMPLETAS.map(([campo]) => (
                  <td key={campo} className="whitespace-nowrap p-2.5">
                    {fmtCampoCompleto(r.completo?.[campo])}
                  </td>
                ))}
              </tr>
            ))}
            {registrosPagina.length === 0 && (
              <tr>
                <td colSpan={6 + (mostrarCompleto ? COLUNAS_COMPLETAS.length : 0)} className="p-4 text-center text-[12px] text-muted-foreground">
                  Nenhum militar encontrado com esses filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between border-t border-border p-3 text-[12px] text-muted-foreground">
          <span>Página {paginaAtual} de {totalPaginas}</span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={paginaAtual <= 1}
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
              className="rounded-md border border-input px-2.5 py-1 disabled:opacity-40"
            >
              Anterior
            </button>
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
      )}
    </SectionCard>
  );
}

// Tabela de Viaturas — só a própria unidade (não foi pedido virar subárvore).
function TabelaViaturas({ sigla }) {
  const navigate = useNavigate();
  const registros = viaturasLista.por_unidade[sigla] || [];
  if (registros.length === 0) return null;

  function abrirDetalhe(registro) {
    navigate(`/em-construcao/${encodeURIComponent(registro.placa ?? "registro")}`, {
      state: { titulo: "Dados da Viatura" },
    });
  }

  return (
    <SectionCard titulo="Viaturas da Unidade" subtitulo={`${registros.length} registros`} semPadding>
      <div className="max-h-96 overflow-y-auto overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse text-left">
          <thead className="sticky top-0 bg-card">
            <tr className="border-b border-border text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="p-2.5 text-left">Placa</th>
              <th className="p-2.5 text-left">Modelo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {registros.map((registro, i) => (
              <tr
                key={i}
                onClick={() => abrirDetalhe(registro)}
                className="cursor-pointer text-foreground/80 hover:bg-muted/40"
              >
                <td className="whitespace-nowrap p-2.5">{registro.placa || "—"}</td>
                <td className="whitespace-nowrap p-2.5">{registro.modelo || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

export default function Indicador() {
  const { id } = useParams();
  const { indicadores, unidades, porId, loading } = useCbmpe();
  const [mostrarTabela, setMostrarTabela] = React.useState(false);

  const ind = indicadores.find((i) => i.id === id);
  const unidade = ind ? porId[ind.unidade_id] : null;
  const caminho = ind ? getCaminho(unidades, ind.unidade_id) : [];

  if (loading && !ind) return <div className="h-96 animate-pulse rounded-xl bg-muted/40" />;

  if (!ind) {
    return (
      <EmptyState
        icon={BarChart3}
        titulo="Indicador não encontrado"
        acao={<Link to="/" className="text-[13px] font-medium text-primary hover:underline">Voltar ao início</Link>}
      />
    );
  }

  const cat = CATEGORIAS[ind.categoria];
  const temTabelaDetalhe = ind.nome === "Efetivo" || ind.nome === "Viaturas";

  return (
    <div className="space-y-5 animate-fade-in">
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
        <span className="text-foreground">{ind.nome}</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/8 text-primary">
          <BarChart3 className="h-6 w-6" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">{ind.nome}</h1>
            <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">{cat?.label}</span>
          </div>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{unidade?.nome}</p>
          <p className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Calendar className="h-3 w-3" /> {ind.descricao || "Indicador operacional"}
          </p>
        </div>
      </div>

      {/* Hero valor */}
      <div className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {ind.nome === "Efetivo" ? "Efetivo Atual / Previsto" : ind.nome}
          </p>
          {ind.nome === "Materiais" || ind.nome === "Atividades Específicas" ? (
            <p className="mt-2 font-display text-[22px] font-semibold tracking-tight text-foreground">Em construção</p>
          ) : (
            <p className="mt-2 flex flex-wrap items-baseline gap-x-2">
              <span className="font-display text-[30px] font-semibold tracking-tight text-foreground leading-none">
                {ind.nome === "Finanças" ? fmtMoeda(ind.valor) : fmtNumero(ind.valor)}
              </span>
              {ind.nome === "Efetivo" && (
                <>
                  <span className="text-muted-foreground">/</span>
                  <span className="text-muted-foreground">{ind.meta != null ? fmtNumero(ind.meta) : "—"}</span>
                </>
              )}
              {ind.unidade_medida && ind.unidade_medida !== "%" && ind.unidade_medida !== "R$" && (
                <span className="text-[13px] text-muted-foreground">{ind.unidade_medida}</span>
              )}
            </p>
          )}
        </div>

        {temTabelaDetalhe && (
          <button
            type="button"
            onClick={() => setMostrarTabela((v) => !v)}
            className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-md border border-input bg-background px-3 py-1.5 text-[12px] font-medium text-foreground transition-colors hover:bg-muted sm:self-center"
          >
            <Table2 className="h-3.5 w-3.5" />
            {mostrarTabela ? "Ocultar" : "Exibir"} tabela com detalhes {ind.nome === "Efetivo" ? "do efetivo" : "das viaturas"}
          </button>
        )}
      </div>

      {mostrarTabela && ind.nome === "Efetivo" && <TabelaEfetivo unidade={unidade} unidades={unidades} />}
      {mostrarTabela && ind.nome === "Viaturas" && <TabelaViaturas sigla={unidade?.sigla} />}

      {/* Módulos futuros deste indicador (placeholders — ainda sem dado/dashboard real) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: QTD_MODULOS_PLACEHOLDER }, (_, i) => i + 1).map((n) => (
          <Link
            key={n}
            to={`/em-construcao/${ind.id}-modulo-${n}`}
            className="group flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card p-4 text-center transition-all hover:-translate-y-0.5 hover:border-input hover:shadow-sm"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
              <BarChart3 className="h-4 w-4" />
            </div>
            <p className="text-[13px] font-semibold text-foreground">{ind.nome} Módulo {n}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
