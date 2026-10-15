import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Truck, Users, MapPin, CalendarDays, Search, X, TriangleAlert } from "lucide-react";
import SectionCard from "@/components/ui/section-card";
import EmptyState from "@/components/ui/empty-state";
import MultiSelectFiltro from "@/components/ui/multi-select-filtro";
import FiltroData, { formatarData } from "@/components/ui/filtro-data";
import GeoMarcadores from "@/components/charts/GeoMarcadores";
import { fmtNumero } from "@/lib/cbmpe";
import { fetchMapaForcaContatos } from "@/lib/dadosClient";
import municipios from "@/data/real/efetivo_dashboard/municipios_pe.json";
import {
  carregarIndice, carregarDia, filtrarLancamentos, agruparPorPosto,
  opcoesDeFiltro, totais,
} from "@/lib/mapaForca";

// Painel de Mapa de Força — quais viaturas estão ativadas em cada seção de
// bombeiros, num dia, com a guarnição de cada uma.
//
// O grão é o posto de serviço (a seção), mais fino que a OME, que é o que o
// mapa de força usa de verdade. O balão leva à viatura (/viatura/:placa) e ao
// militar (/militar/:matricula) — as duas rotas já existiam.
//
// Escopo por unidade: o painel é o mesmo em toda a subárvore da DGO, filtrado
// pela OME da unidade que está sendo vista, como os Dashboards Pessoais de
// Efetivo e Viaturas já fazem.

const VAZIO = new Set();

export default function ModuloMapaForca({ permitidas, unidade }) {
  const [indice, setIndice] = useState(null);
  const [dia, setDia] = useState(null);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(true);

  const [omes, setOmes] = useState(VAZIO);
  const [postosSel, setPostosSel] = useState(VAZIO);
  const [tipos, setTipos] = useState(VAZIO);
  const [numeros, setNumeros] = useState(VAZIO);
  const [matricula, setMatricula] = useState("");
  const [postoAberto, setPostoAberto] = useState(null);

  useEffect(() => {
    let vivo = true;
    carregarIndice()
      .then((i) => {
        if (!vivo) return;
        setIndice(i);
        setDia(i.datas[i.datas.length - 1] || null);
      })
      .catch((e) => vivo && setErro(e.message));
    return () => { vivo = false; };
  }, []);

  useEffect(() => {
    if (!dia) return;
    let vivo = true;
    setCarregando(true);
    carregarDia(dia)
      .then((d) => { if (vivo) { setDados(d); setErro(null); } })
      .catch((e) => vivo && setErro(e.message))
      .finally(() => vivo && setCarregando(false));
    return () => { vivo = false; };
  }, [dia]);

  // Trocar de dia invalida o posto aberto: o mesmo posto pode não ter
  // lançamento no dia novo, e o painel ficaria mostrando dado do dia anterior.
  useEffect(() => { setPostoAberto(null); }, [dia]);

  const postos = indice?.postos || {};

  // No escopo da unidade, mas ANTES dos filtros da tela — é sobre este
  // conjunto que as opções dos filtros são calculadas, para não oferecer um
  // tipo de viatura que não existe na unidade.
  const noEscopo = useMemo(
    () => filtrarLancamentos(dados?.lancamentos, {
      permitidas,
      filtros: { omes: VAZIO, postosSel: VAZIO, tipos: VAZIO, numeros: VAZIO, matricula: "" },
      postos,
    }),
    [dados, permitidas, postos]
  );

  const opcoes = useMemo(() => opcoesDeFiltro(noEscopo, postos), [noEscopo, postos]);

  // Subfiltros. Seção depende da OME escolhida; número de ordem depende do
  // tipo de viatura. É o que o pedido chama de "subfiltro" — a lista de baixo
  // encolhe conforme a de cima.
  const postosDisponiveis = useMemo(
    () => opcoes.postos.filter((p) => !omes.size || omes.has(p.ome)),
    [opcoes.postos, omes]
  );
  const numerosDisponiveis = useMemo(() => {
    const alvo = tipos.size ? Array.from(tipos) : Array.from(opcoes.numerosPorTipo.keys());
    const set = new Set();
    alvo.forEach((t) => (opcoes.numerosPorTipo.get(t) || VAZIO).forEach((n) => set.add(n)));
    return Array.from(set).sort((a, b) => String(a).localeCompare(String(b), "pt-BR", { numeric: true }));
  }, [opcoes.numerosPorTipo, tipos]);

  const filtrados = useMemo(
    () => filtrarLancamentos(noEscopo, {
      permitidas: null,
      filtros: { omes, postosSel, tipos, numeros, matricula },
      postos,
    }),
    [noEscopo, omes, postosSel, tipos, numeros, matricula, postos]
  );

  const { porPosto, semPosto } = useMemo(
    () => agruparPorPosto(filtrados, postos), [filtrados, postos]
  );
  const resumo = useMemo(() => totais(filtrados), [filtrados]);
  const postosSemCoordenada = useMemo(() => {
    const por = new Map();
    semPosto.forEach((l) => {
      const id = l.posto ?? "—";
      if (!por.has(id)) por.set(id, { id, nome: postos[id]?.nome || `posto ${id}`, ome: l.ome, militares: 0 });
      por.get(id).militares += l.guarnicao.length;
    });
    return Array.from(por.values());
  }, [semPosto, postos]);

  const aberto = postoAberto ? porPosto.find((p) => p.id === postoAberto) : null;

  // O detalhe abre ABAIXO do mapa, fora da tela de quem clicou: leva a tela até ele.
  const detalheRef = React.useRef(null);
  useEffect(() => {
    if (postoAberto && detalheRef.current) {
      detalheRef.current.scrollIntoView({ block: "start" });
    }
  }, [postoAberto]);

  if (erro) {
    return (
      <EmptyState
        icon={TriangleAlert}
        titulo="Não foi possível carregar o mapa de força"
        descricao={erro}
      />
    );
  }

  if (!indice || (carregando && !dados)) {
    return <div className="h-96 animate-pulse rounded-xl bg-muted/40" />;
  }

  const semNadaNoEscopo = noEscopo.length === 0;

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <FiltroData valor={dia} datas={indice.datas} onChange={setDia} />

        <MultiSelectFiltro label="OME" valores={opcoes.omes} selecionado={omes}
          onChange={(v) => { setOmes(v); setPostosSel(VAZIO); }} />
        <MultiSelectFiltro label="Seção"
          valores={postosDisponiveis.map((p) => p.nome)}
          selecionado={new Set(Array.from(postosSel).map((id) => postos[id]?.nome).filter(Boolean))}
          onChange={(nomes) => setPostosSel(new Set(
            postosDisponiveis.filter((p) => nomes.has(p.nome)).map((p) => p.id)
          ))} />
        <MultiSelectFiltro label="Tipo de viatura" valores={opcoes.tipos} selecionado={tipos}
          onChange={(v) => { setTipos(v); setNumeros(VAZIO); }} />
        <MultiSelectFiltro label="Nº de ordem" valores={numerosDisponiveis} selecionado={numeros}
          onChange={setNumeros} />

        <BuscaMilitar valor={matricula} onChange={setMatricula} opcoes={opcoes.militares} />

        {(omes.size || postosSel.size || tipos.size || numeros.size || matricula) ? (
          <button
            type="button"
            onClick={() => { setOmes(VAZIO); setPostosSel(VAZIO); setTipos(VAZIO); setNumeros(VAZIO); setMatricula(""); }}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-2 text-[12px] text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" /> limpar
          </button>
        ) : null}
      </div>

      {semNadaNoEscopo ? (
        <EmptyState
          icon={MapPin}
          titulo="Sem mapa de força nesta unidade"
          descricao={`Em ${formatarData(dia)} não houve lançamento em ${unidade?.sigla || "esta unidade"} nem nas subordinadas. O mapa de força é lançado pelas unidades operacionais (Grupamentos, GBAPH, GBS, GBMar e CATs) — numa unidade administrativa este painel fica vazio por natureza.`}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi icone={MapPin} rotulo="Unidades com lançamentos" valor={porPosto.length} />
            <Kpi icone={Truck} rotulo="Viaturas ativadas" valor={resumo.viaturas} />
            <Kpi icone={Users} rotulo="Militares escalados" valor={resumo.militares} />
            <Kpi icone={CalendarDays} rotulo="Lançamentos" valor={resumo.lancamentos} />
          </div>

          <SectionCard>
            <GeoMarcadores
              municipios={municipios}
              pontos={porPosto}
              aoClicarPonto={(p) => setPostoAberto(p.id === postoAberto ? null : p.id)}
            />
            {semPosto.length > 0 && (
              <div className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px]">
                <p className="mb-1 flex items-center gap-1.5 font-semibold text-foreground">
                  <TriangleAlert className="h-3.5 w-3.5 text-amber-600" />
                  {fmtNumero(postosSemCoordenada.length)} posto(s) sem coordenada — {fmtNumero(semPosto.length)} lançamento(s)
                  fora do mapa:
                </p>
                <ul className="list-inside list-disc text-muted-foreground">
                  {postosSemCoordenada.map((x) => (
                    <li key={x.id}>{x.nome} ({x.ome}) — {fmtNumero(x.militares)} militar(es)</li>
                  ))}
                </ul>
              </div>
            )}
          </SectionCard>

          {aberto && (
            <div ref={detalheRef} className="scroll-mt-4">
              <DetalheDoPosto posto={aberto} dia={dia} aoFechar={() => setPostoAberto(null)} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Kpi({ icone: Icone, rotulo, valor }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icone className="h-3.5 w-3.5" /> {rotulo}
      </div>
      <p className="mt-1 font-display text-[22px] font-semibold tracking-tight text-foreground">
        {fmtNumero(valor)}
      </p>
    </div>
  );
}

// Ordem dos turnos no detalhe do posto: 1º, 2º, 3º, depois os regimes de 12h e 24h e, por fim, o que não
// tiver turno informado. O dado traz "3º TURNO" e "3° TURNO" (grau no lugar de ordinal).
function ordemDoTurno(turno) {
  const t = String(turno || "").toUpperCase().replace("°", "º").trim();
  if (t.startsWith("1")) return 1;
  if (t.startsWith("2")) return 2;
  if (t.startsWith("3")) return 3;
  if (t === "12H") return 4;
  if (t === "24H") return 5;
  return 9;
}

// Hierarquia para ordenar a guarnição (do maior para o menor posto/graduação).
const ORDEM_POSTO = ["CEL", "TC", "MAJ", "CAP", "1º TEN", "2º TEN", "ASP", "SUBTEN", "1º SGT", "2º SGT", "3º SGT", "CB", "SD"];
function ordemDoPosto(pg) {
  const i = ORDEM_POSTO.indexOf(String(pg || "").toUpperCase().replace("°", "º").trim());
  return i === -1 ? ORDEM_POSTO.length : i;
}

const rotuloViatura = (v) => `${v.acronimo || "?"}-${v.numero || "?"}`;

function DetalheDoPosto({ posto, dia, aoFechar }) {
  // Telefone: consulta ao vivo ao SGP (ovrsgp.tb_pess.nr_cntt_proprio), só do posto aberto. Sem backend
  // (snapshot da Vercel) ou sem telefone cadastrado, a célula fica em branco.
  const [telefones, setTelefones] = useState({});
  useEffect(() => {
    let vivo = true;
    setTelefones({});
    fetchMapaForcaContatos(dia, posto.id).then((r) => vivo && setTelefones(r?.telefones || {})).catch(() => {});
    return () => { vivo = false; };
  }, [dia, posto.id]);

  // Quem está neste posto, por OME do lançamento: o posto é um lugar, e as viaturas de mais de uma
  // OME podem estar ativadas nele (ex.: GBAPH no quartel do GBS).
  const porOme = useMemo(() => {
    const m = new Map();
    posto.lancamentos.forEach((l) => {
      const k = l.ome || "—";
      const a = m.get(k) || { ome: k, lancamentos: 0, militares: 0 };
      a.lancamentos += 1;
      a.militares += l.guarnicao.length;
      m.set(k, a);
    });
    return Array.from(m.values()).sort((x, y) => y.militares - x.militares);
  }, [posto]);

  // Turnos em ordem; dentro de cada um: OME, depois viatura, depois o maior efetivo primeiro. Também
  // marca o militar que aparece em mais de um lançamento do MESMO turno (escala em dobro ou erro de lançamento).
  const turnos = useMemo(() => {
    const grupos = new Map();
    posto.lancamentos.forEach((l) => {
      const k = (l.turno || "").toUpperCase().replace("°", "º").trim() || "SEM TURNO";
      if (!grupos.has(k)) grupos.set(k, { turno: k, ordem: ordemDoTurno(l.turno), lancamentos: [] });
      grupos.get(k).lancamentos.push(l);
    });
    return Array.from(grupos.values())
      .sort((x, y) => x.ordem - y.ordem || x.turno.localeCompare(y.turno))
      .map((g) => {
        const vezes = new Map();
        g.lancamentos.forEach((l) => new Set(l.guarnicao.map((m) => m.matricula)).forEach((mt) => vezes.set(mt, (vezes.get(mt) || 0) + 1)));
        const ordenados = [...g.lancamentos].sort((x, y) => (x.ome || "").localeCompare(y.ome || "", "pt-BR")
          || (x.viaturas[0] ? rotuloViatura(x.viaturas[0]) : "￿").localeCompare(y.viaturas[0] ? rotuloViatura(y.viaturas[0]) : "￿", "pt-BR", { numeric: true })
          || y.guarnicao.length - x.guarnicao.length);
        return {
          ...g,
          lancamentos: ordenados,
          repetidos: vezes,
          militares: g.lancamentos.reduce((n, l) => n + l.guarnicao.length, 0),
          viaturas: g.lancamentos.reduce((n, l) => n + l.viaturas.length, 0),
        };
      });
  }, [posto]);

  return (
    <SectionCard
      titulo={posto.nome}
      subtitulo={[posto.ome ? `posto de ${posto.ome}` : null, posto.municipio, posto.bairro, posto.ais ? `AIS ${posto.ais}` : null]
        .filter(Boolean).join(" · ")}
      acoes={
        <button type="button" onClick={aoFechar}
          className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" /> fechar
        </button>
      }
    >
      <div className="mb-4 flex flex-wrap gap-1.5 text-[11px]">
        {porOme.map((o) => (
          <span key={o.ome} className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-foreground">
            <strong>{o.ome}</strong> · {fmtNumero(o.lancamentos)} lançamento(s) · {fmtNumero(o.militares)} militar(es)
          </span>
        ))}
      </div>

      <div className="space-y-5">
        {turnos.map((g) => (
          <section key={g.turno}>
            <header className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border pb-1.5">
              <h4 className="font-display text-[14px] font-semibold tracking-tight text-foreground">{g.turno}</h4>
              <span className="text-[11px] text-muted-foreground">
                {fmtNumero(g.lancamentos.length)} lançamento(s) · {fmtNumero(g.viaturas)} viatura(s) · {fmtNumero(g.militares)} militar(es)
              </span>
            </header>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {g.lancamentos.map((l) => (
                <CardLancamento key={l.id} lancamento={l} postoOme={posto.ome} telefones={telefones} repetidos={g.repetidos} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </SectionCard>
  );
}

function CardLancamento({ lancamento: l, postoOme, telefones, repetidos }) {
  const digitos = (v) => String(v || "").replace(/\D/g, "");
  const outraOme = l.ome && postoOme && l.ome !== postoOme;
  const guarnicao = useMemo(
    () => [...l.guarnicao].sort((x, y) => ordemDoPosto(x.postoGrad) - ordemDoPosto(y.postoGrad)
      || (x.nomeGuerra || "").localeCompare(y.nomeGuerra || "", "pt-BR")),
    [l.guarnicao]
  );
  return (
    <article className={`flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm ${outraOme ? "border-amber-500/50" : "border-border"}`}>
      {/* Cabeçalho: OME do lançamento e o serviço */}
      <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 ${outraOme ? "bg-amber-500/10" : "bg-muted/40"}`}>
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${outraOme ? "bg-amber-500/25 text-amber-800" : "bg-primary/10 text-primary"}`}
          title={outraOme ? `OME do lançamento (o posto é de ${postoOme})` : "OME do lançamento"}
        >
          {l.ome || "OME não informada"}
        </span>
        <span className="text-[12px] font-semibold leading-tight text-foreground">{l.tipoServico || "Serviço não informado"}</span>
      </div>

      <div className="space-y-2 px-3 py-2.5">
        {/* Viatura: tipo + número de ordem (ex.: ABT-12). O array existe porque a fonte permite mais de uma
            linha por lançamento; esconder a segunda seria mentir sobre o dado. */}
        <div>
          <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Truck className="h-3 w-3" /> Viatura
          </p>
          {l.viaturas.length === 0 && (
            <p className="text-[11px] italic text-muted-foreground">sem viatura neste lançamento</p>
          )}
          {l.viaturas.map((v, i) => (
            v.placa ? (
              <Link key={`${l.id}-${i}`} to={`/viatura/${v.placa}`}
                className="flex items-center justify-between gap-2 rounded-md bg-primary/5 px-2 py-1 text-[12px] hover:bg-primary/10">
                <span className="font-semibold text-foreground">{rotuloViatura(v)}</span>
                <span className="font-mono text-[11px] text-muted-foreground">{v.placa}</span>
              </Link>
            ) : (
              // Sem placa = viatura que o mapa de força lançou e a Frota não conhece (1,0% do volume).
              <div key={`${l.id}-${i}`} className="flex items-center justify-between gap-2 rounded-md bg-muted/60 px-2 py-1 text-[12px]">
                <span className="font-semibold text-foreground">{rotuloViatura(v)}</span>
                <span className="text-[10px] text-muted-foreground">sem cadastro na Frota</span>
              </div>
            )
          ))}
        </div>

        {/* Guarnição: do maior posto/graduação para o menor */}
        <div>
          <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Users className="h-3 w-3" /> Guarnição ({fmtNumero(guarnicao.length)})
          </p>
          <ul className="divide-y divide-border/60">
            {guarnicao.map((m, i) => {
              const tel = telefones[digitos(m.matricula)];
              const dobrado = (repetidos.get(m.matricula) || 0) > 1;
              return (
                <li key={`${l.id}-m-${i}`}>
                  <Link to={`/militar/${m.matricula}`} className="block rounded px-1 py-1.5 text-[11px] hover:bg-primary/10" title={m.funcao || ""}>
                    <span className="block text-foreground">
                      <span className="mr-1 inline-block min-w-[3.2rem] text-[10px] font-semibold text-muted-foreground">{m.postoGrad}</span>
                      <strong className="break-words">{m.nomeGuerra || "—"}</strong>
                    </span>
                    <span className="mt-0.5 block pl-[3.2rem] text-[10px] text-muted-foreground">
                      <span className="font-mono">mat. {m.matricula}</span>
                      {m.funcao && <span> · {m.funcao}</span>}
                    </span>
                    {tel && (
                      <span className="mt-0.5 block pl-[3.2rem] text-[10px] font-medium text-foreground">📞 {tel}</span>
                    )}
                    {dobrado && (
                      <span className="mt-0.5 block pl-[3.2rem] text-[10px] font-medium text-amber-700">
                        ⚠ também em outro lançamento deste turno
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </article>
  );
}

// Busca de militar com autocomplete. Casa por matrícula OU nome de guerra —
// quem opera o painel raramente sabe a matrícula de cabeça, e a lista de
// sugestões já está carregada com o dia.
function BuscaMilitar({ valor, onChange, opcoes }) {
  const [aberto, setAberto] = useState(false);
  const sugestoes = useMemo(() => {
    const q = valor.trim().toLowerCase();
    if (!q) return [];
    return opcoes
      .filter((o) => o.matricula.toLowerCase().includes(q) || o.nome.toLowerCase().includes(q))
      .slice(0, 8);
  }, [valor, opcoes]);

  return (
    <div className="relative">
      <div className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2">
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <input
          value={valor}
          onChange={(e) => { onChange(e.target.value); setAberto(true); }}
          onFocus={() => setAberto(true)}
          onBlur={() => setTimeout(() => setAberto(false), 120)}
          placeholder="Matrícula ou nome de guerra"
          className="w-52 bg-transparent text-[12px] text-foreground outline-none placeholder:text-muted-foreground"
        />
        {valor && (
          <button type="button" onClick={() => onChange("")} aria-label="Limpar busca">
            <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>
      {aberto && sugestoes.length > 0 && (
        <div className="absolute left-0 top-full z-40 mt-1 w-72 overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
          {sugestoes.map((s) => (
            <button
              key={s.matricula}
              type="button"
              onMouseDown={() => { onChange(s.matricula); setAberto(false); }}
              className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-[12px] hover:bg-primary/10"
            >
              <span className="truncate text-foreground">{s.nome}</span>
              <span className="shrink-0 text-[11px] text-muted-foreground">{s.matricula}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
