import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Truck, Users, MapPin, CalendarDays, Search, X, TriangleAlert } from "lucide-react";
import SectionCard from "@/components/ui/section-card";
import EmptyState from "@/components/ui/empty-state";
import MultiSelectFiltro from "@/components/ui/multi-select-filtro";
import FiltroData, { formatarData } from "@/components/ui/filtro-data";
import GeoMarcadores from "@/components/charts/GeoMarcadores";
import { fmtNumero } from "@/lib/cbmpe";
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

  const aberto = postoAberto ? porPosto.find((p) => p.id === postoAberto) : null;

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
              <p className="mt-2 text-[11px] text-muted-foreground">
                {fmtNumero(semPosto.length)} lançamento(s) sem posto de serviço com coordenada —
                não aparecem no mapa.
              </p>
            )}
          </SectionCard>

          {aberto && <DetalheDoPosto posto={aberto} aoFechar={() => setPostoAberto(null)} />}
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

function DetalheDoPosto({ posto, aoFechar }) {
  return (
    <SectionCard
      titulo={posto.nome}
      subtitulo={[posto.ome, posto.municipio, posto.bairro, posto.ais ? `AIS ${posto.ais}` : null]
        .filter(Boolean).join(" · ")}
      acoes={
        <button type="button" onClick={aoFechar}
          className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" /> fechar
        </button>
      }
    >
      {/* Um card por lançamento, lado a lado. Antes era uma coluna de blocos
          largos, e um posto com dez lançamentos virava uma página inteira de
          rolagem — o que se quer ver aqui é a escala do dia de uma vez. */}
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {posto.lancamentos.map((l) => (
          <CardLancamento key={l.id} lancamento={l} />
        ))}
      </div>
    </SectionCard>
  );
}

function CardLancamento({ lancamento: l }) {
  return (
    <div className="rounded-lg border border-border p-2.5">
      <div className="mb-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px]">
        <span className="font-semibold text-foreground">{l.tipoServico || "Serviço não informado"}</span>
        {l.turno && (
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {l.turno}
          </span>
        )}
      </div>

      {/* "Viatura" no singular: o lançamento do mapa de força tem uma só. O
          array continua porque a fonte permite mais de uma linha por
          lançamento, e esconder a segunda seria mentir sobre o dado. */}
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Viatura
      </p>
      {l.viaturas.length === 0 && (
        <p className="text-[11px] text-muted-foreground">sem viatura neste lançamento</p>
      )}
      {l.viaturas.map((v, i) => {
        const rotulo = `${v.acronimo || "?"}-${v.numero || "?"}`;
        // Sem placa = viatura que o mapa de força lançou e a Frota não
        // conhece (1,0% do volume). Mostra sem link, em vez de sumir com ela.
        return v.placa ? (
          <Link
            key={`${l.id}-${i}`}
            to={`/viatura/${v.placa}`}
            className="flex items-center justify-between gap-2 rounded px-1 py-0.5 text-[11px] hover:bg-primary/10"
          >
            <span className="font-medium text-foreground">{rotulo}</span>
            <span className="text-muted-foreground">{v.placa}</span>
          </Link>
        ) : (
          <div key={`${l.id}-${i}`}
            className="flex items-center justify-between gap-2 px-1 py-0.5 text-[11px]">
            <span className="font-medium text-foreground">{rotulo}</span>
            <span className="text-[10px] text-muted-foreground">sem cadastro na Frota</span>
          </div>
        );
      })}

      <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Guarnição ({fmtNumero(l.guarnicao.length)})
      </p>
      {l.guarnicao.map((m, i) => (
        <Link
          key={`${l.id}-m-${i}`}
          to={`/militar/${m.matricula}`}
          className="flex items-baseline justify-between gap-2 rounded px-1 py-0.5 text-[11px] hover:bg-primary/10"
          title={m.funcao || ""}
        >
          <span className="truncate text-foreground">
            <span className="text-muted-foreground">{m.postoGrad} </span>
            {m.nomeGuerra || m.matricula}
          </span>
          <span className="shrink-0 truncate text-[10px] text-muted-foreground" style={{ maxWidth: "45%" }}>
            {m.funcao}
          </span>
        </Link>
      ))}
    </div>
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
