import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, Minus, Maximize2 } from "lucide-react";
import { fmtNumero } from "@/lib/cbmpe";
import { projetarNoMapa, dentroDoMapa } from "@/lib/projecaoPe";
import afastarSobreposicoes, { agruparProximos } from "@/lib/antiSobreposicao";
import useZoomMapa from "@/lib/useZoomMapa";
import { insigniaNoMapa, ehGrupamento } from "@/lib/insignias";
import MolduraNoronha from "./MolduraNoronha";

// Mapa de Pernambuco com balões posicionados por lat/long — irmão do
// GeoChoropleth, que pinta município. Aqui o município é o pano de fundo (e
// responde ao hover com o próprio nome); o que interessa é o ponto, porque o
// grão do Mapa de Força é o posto de serviço, não a cidade.
//
// Sem biblioteca de mapa e sem tiles, de propósito: um Leaflet precisaria
// buscar imagem de servidor externo, e o destino deste app é a intranet, onde
// isso não existe. O SVG vem de municipios_pe.json, projetado da malha oficial
// do IBGE (etl/_geo/); a projeção está em src/lib/projecaoPe.js.
//
// Três coisas que este componente resolve e que valem o comentário:
//
// 1. ZOOM E PAN por viewBox (useZoomMapa), não por transform — assim o
//    contorno do município não engorda ao ampliar. Em troca, todo tamanho
//    fixo aqui é dividido por `escala`. A roda só dá zoom com Ctrl; sem ele a
//    página rola normalmente.
// 2. SOBREPOSIÇÃO. 70 dos 185 postos estão na Região Metropolitana, e 37
//    deles na coordenada exata do QCG. Desenhados no lugar viram uma pilha
//    ilegível. Longe, viram um balão de grupo; perto, o grupo se desfaz e os
//    brasões abrem lado a lado (antiSobreposicao.js), cada um ligado ao ponto
//    real por uma linha-guia.
// 3. FERNANDO DE NORONHA está no mapa, deslocada e ampliada — projetarNoMapa
//    resolve, MolduraNoronha rotula.

const RAIO_MIN = 5;
const RAIO_MAX = 14;
// A insígnia é o que o leitor reconhece de longe, então ela é desenhada maior
// que o círculo que serve de alvo de clique.
const FATOR_INSIGNIA = 2.1;
// Unidades do viewBox de 1000 a 1x. ~9 km no continente — abaixo disso os
// balões não cabem lado a lado e viram uma mancha.
const DISTANCIA_GRUPO = 13;
// A partir deste zoom nada mais é agrupado: quem estiver junto abre em
// balões individuais, ainda que o anti-sobreposição precise afastá-los do
// ponto exato. Ver o pedido: "mesmo que não fique milimetricamente no local
// devido, é melhor ter os dois separados".
const ZOOM_QUE_ABRE_GRUPOS = 3.2;

export default function GeoMarcadores({
  municipios, pontos, altura = 460, aoClicarPonto, valorDoPonto = (p) => p.viaturas,
  rotuloValor = "viatura(s)",
}) {
  const [hover, setHover] = useState(null);
  const [municipioAtivo, setMunicipioAtivo] = useState(null);

  const quadroBase = useMemo(() => ({
    x: municipios.minX ?? 0, y: municipios.minY ?? 0,
    w: municipios.width, h: municipios.height,
  }), [municipios]);

  const mapa = useZoomMapa(quadroBase);
  const { escala } = mapa;

  const maximo = useMemo(
    () => Math.max(1, ...pontos.map(valorDoPonto)),
    [pontos, valorDoPonto]
  );

  // Área proporcional ao valor (raiz), não raio — raio proporcional exagera
  // o grande e some com o pequeno. Dividido pela escala para o balão manter
  // o mesmo tamanho na tela conforme se dá zoom.
  const raio = React.useCallback((v) => (
    (RAIO_MIN + (RAIO_MAX - RAIO_MIN) * Math.sqrt(Math.min(v / maximo, 1))) / escala
  ), [maximo, escala]);

  // Ponto sem coordenada utilizável fica de fora do desenho — quem chama já
  // separa os "sem posto" numa lista à parte.
  const desenhaveis = useMemo(() => pontos
    .filter((p) => dentroDoMapa(p.lat, p.lon))
    .map((p) => ({ ...p, ancora: projetarNoMapa(p.lat, p.lon) })), [pontos]);

  // Primeiro agrupa o que está perto demais para caber lado a lado, depois
  // afasta o que ainda encavala. A distância de agrupamento encolhe com o
  // zoom e some de vez a partir de ZOOM_QUE_ABRE_GRUPOS — é o que torna a RMR
  // legível sem tirar nada do mapa.
  const grupos = useMemo(() => {
    const base = desenhaveis.map((p) => ({
      ...p,
      x: p.ancora.x,
      y: p.ancora.y,
      valor: valorDoPonto(p),
      // Sede de grupamento nunca é absorvida por um balão de OMEs
      // misturadas: um balão assim não tem brasão para mostrar, e o pedido é
      // que o brasão da unidade apareça na sede em QUALQUER zoom.
      fixo: !!p.sede && ehGrupamento(p.ome),
      chave: p.ome,
    }));
    if (escala >= ZOOM_QUE_ABRE_GRUPOS) {
      return base.map((p) => ({
        id: p.id, x: p.x, y: p.y, valor: p.valor, membros: [p], fixo: p.fixo,
      }));
    }
    return agruparProximos(base, DISTANCIA_GRUPO / escala);
  }, [desenhaveis, valorDoPonto, escala]);

  // A insígnia é resolvida ANTES do anti-sobreposição porque ela é maior que o
  // círculo: separar pelo raio do círculo deixaria os brasões encavalados na
  // mesma medida em que são maiores. Medido em 4,4x de zoom na RMR: 35 pares
  // de brasões sobrepostos separando pelo círculo, nenhum separando pelo
  // brasão.
  const marcadores = useMemo(() => grupos.map((g) => {
    const agrupado = g.membros.length > 1;
    // Insígnia só para grupamento e para o QCG (decisão do usuário) —
    // diretoria e centro têm insígnia na página da unidade, não aqui, senão o
    // mapa vira um mosaico de brasões. Num grupo com OMEs diferentes nenhuma
    // insígnia representa o balão.
    const omes = new Set(g.membros.map((m) => m.ome));
    const insignia = omes.size === 1
      ? insigniaNoMapa(g.membros[0].ome, agrupado ? "" : g.membros[0].nome)
      : null;
    const r = raio(g.valor);
    return { ...g, agrupado, insignia, r, rDesenho: insignia ? r * FATOR_INSIGNIA : r };
  }), [grupos, raio]);

  const baloes = useMemo(() => afastarSobreposicoes(
    marcadores.map((m) => ({ x: m.x, y: m.y, r: m.rDesenho, fixo: m.fixo })),
    { margem: 1.5 / escala, limites: quadroBase }
  ), [marcadores, escala, quadroBase]);

  // Mesma correção de deslocamento do tooltip já resolvida em GeoChoropleth:
  // `html { zoom: 1.25 }` reescala a página, e `.animate-fade-in` deixa um
  // transform residual no ancestral que quebra `position: fixed`. Daí dividir
  // pelo zoom e renderizar via portal no body.
  function mover(e, conteudo) {
    const zoom = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
    setHover({ x: e.clientX / zoom, y: e.clientY / zoom, ...conteudo });
  }

  const clicavel = typeof aoClicarPonto === "function";

  // Clique num grupo aproxima nele até o grupo se desfazer, em vez de abrir
  // um detalhe arbitrário de um dos membros.
  function aproximarNo(g) {
    if (mapa.arrastando()) return;
    mapa.enquadrar(g.membros, DISTANCIA_GRUPO);
  }

  function clicar(p) {
    // Arrastar o mapa termina em pointerup sobre um balão; sem esta guarda,
    // todo pan que acabasse em cima de um posto abriria o detalhe dele.
    if (!clicavel || mapa.arrastando()) return;
    aoClicarPonto(p);
  }

  const destaque = municipioAtivo
    ? municipios.features.find((f) => f.id === municipioAtivo)
    : null;

  const botao = "flex h-6 w-6 items-center justify-center rounded border border-border bg-card text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground disabled:opacity-40";
  const cursor = mapa.arrastandoAgora ? "grabbing" : (mapa.zoomAtivo ? "grab" : "default");

  return (
    <div className="relative rounded-lg border border-border bg-muted/20 p-2">
      <svg
        ref={mapa.svgRef}
        viewBox={`${mapa.vb.x} ${mapa.vb.y} ${mapa.vb.w} ${mapa.vb.h}`}
        style={{ width: "100%", height: altura, cursor, touchAction: "none" }}
        onPointerDown={mapa.aoPressionar}
        onPointerMove={mapa.aoMover}
        onPointerUp={mapa.aoSoltar}
        onPointerLeave={(e) => { mapa.aoSoltar(e); setHover(null); setMunicipioAtivo(null); }}
      >
        {municipios.features.map((f) => (
          <path
            key={f.id}
            d={f.d}
            fill="hsl(var(--foreground) / 0.07)"
            stroke="hsl(var(--card))"
            strokeWidth={0.4 / escala}
            onPointerMove={(e) => {
              setMunicipioAtivo(f.id);
              mover(e, { municipio: f.name });
            }}
          />
        ))}

        {/* O município sob o cursor é redesenhado por cima dos vizinhos: SVG
            não tem z-index, então destacar no lugar deixaria a borda do
            vizinho passando por cima do realce. Cresce 4% em torno do próprio
            centro (transform-box: fill-box) — o suficiente para "saltar" sem
            deslocar a leitura do mapa. */}
        {destaque && (
          <path
            d={destaque.d}
            fill="hsl(var(--primary) / 0.3)"
            stroke="hsl(var(--primary))"
            strokeWidth={0.8 / escala}
            className="pointer-events-none"
            style={{ transformBox: "fill-box", transformOrigin: "center", transform: "scale(1.04)" }}
          />
        )}

        <MolduraNoronha escala={escala} />

        {/* Linhas-guia primeiro, para ficarem atrás de todos os balões. */}
        {marcadores.map((g, i) => (baloes[i].deslocado ? (
          <line
            key={`guia-${g.id}`}
            x1={g.x} y1={g.y} x2={baloes[i].x} y2={baloes[i].y}
            stroke="hsl(var(--primary) / 0.5)"
            strokeWidth={0.5 / escala}
            className="pointer-events-none"
          />
        ) : null))}

        {marcadores.map((g, i) => {
          const v = g.valor;
          const { r, insignia, agrupado } = g;
          const b = baloes[i];
          const p = g.membros[0];
          // Grupo com origens mistas conta como aproximado: basta um membro
          // sem coordenada própria para o balão não representar um ponto exato.
          const aproximado = g.membros.some((m) => m.origemCoord !== "posto");
          const ri = g.rDesenho;
          return (
            <g
              key={g.id}
              onPointerMove={(e) => {
                setMunicipioAtivo(null);
                mover(e, agrupado ? { grupo: g } : { ponto: p });
              }}
            >
              {(b.deslocado || agrupado) && (
                <circle
                  cx={g.x} cy={g.y} r={1.1 / escala}
                  fill="hsl(var(--primary))"
                  className="pointer-events-none"
                />
              )}
              {insignia && (
                <image
                  href={insignia}
                  x={b.x - ri} y={b.y - ri} width={ri * 2} height={ri * 2}
                  className="pointer-events-none select-none"
                  preserveAspectRatio="xMidYMid meet"
                />
              )}
              {/* Com insígnia o círculo é só o alvo de clique: sem traço, para
                  não cercar o brasão com um anel vermelho. */}
              <circle
                cx={b.x} cy={b.y} r={insignia ? ri : r}
                fill={insignia ? "transparent" : "hsl(var(--primary) / 0.6)"}
                stroke={insignia ? "none" : "hsl(var(--primary))"}
                strokeWidth={insignia ? 0 : 1 / escala}
                // Tracejado quando a coordenada não é do próprio posto: parte
                // dos postos ainda cai no centroide do município ou na
                // coordenada da OME. Mostrar isso evita que alguém leia
                // posição aproximada como posição real.
                strokeDasharray={!insignia && aproximado ? `${2 / escala} ${2 / escala}` : undefined}
                cursor={clicavel || agrupado ? "pointer" : undefined}
                onClick={() => (agrupado ? aproximarNo(g) : clicar(p))}
              />
              {insignia ? (v > 0 && (
                <g className="pointer-events-none select-none">
                  <circle cx={b.x + ri * 0.7} cy={b.y + ri * 0.7} r={ri * 0.4} fill="hsl(var(--primary))" />
                  <text
                    x={b.x + ri * 0.7} y={b.y + ri * 0.7 + ri * 0.15}
                    textAnchor="middle"
                    style={{ fontSize: (ri * 0.55), fontWeight: 700, fill: "hsl(var(--primary-foreground))" }}
                  >
                    {v}
                  </text>
                </g>
              )) : (
                <text
                  x={b.x} y={b.y + 3 / escala}
                  textAnchor="middle"
                  className="pointer-events-none select-none"
                  style={{ fontSize: 9 / escala, fontWeight: 600, fill: "hsl(var(--primary-foreground))" }}
                >
                  {v > 0 ? v : ""}
                </text>
              )}
              {agrupado && (
                <text
                  x={b.x} y={b.y + (insignia ? ri : r) + 5 / escala}
                  textAnchor="middle"
                  className="pointer-events-none select-none"
                  style={{ fontSize: 5.5 / escala, fontWeight: 600, fill: "hsl(var(--muted-foreground))" }}
                >
                  {g.membros.length} postos
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div className="absolute right-3 top-3 flex flex-col gap-1">
        <button type="button" className={botao} onClick={mapa.maisZoom} aria-label="Aproximar"><Plus className="h-3.5 w-3.5" /></button>
        <button type="button" className={botao} onClick={mapa.menosZoom} aria-label="Afastar"><Minus className="h-3.5 w-3.5" /></button>
        <button type="button" className={botao} onClick={mapa.resetar} disabled={!mapa.zoomAtivo} aria-label="Enquadrar Pernambuco"><Maximize2 className="h-3.5 w-3.5" /></button>
      </div>

      {hover && createPortal(
        <div
          className="pointer-events-none fixed z-50 max-w-xs rounded-lg border border-border bg-popover px-3 py-2 text-[12px] shadow-lg"
          style={{ left: hover.x + 12, top: hover.y + 12 }}
        >
          {hover.municipio && !hover.ponto && !hover.grupo && (
            <b className="text-foreground">{hover.municipio}</b>
          )}
          {hover.grupo && (
            <>
              <b className="text-foreground">{hover.grupo.membros.length} postos nesta área</b>
              <div className="mt-1 text-foreground">
                {fmtNumero(hover.grupo.valor)} {rotuloValor}
                {" · "}
                {fmtNumero(hover.grupo.membros.reduce((s, m) => s + (m.militares || 0), 0))} militar(es)
              </div>
              <ul className="mt-1 max-h-40 overflow-hidden text-[11px] text-muted-foreground">
                {hover.grupo.membros.slice(0, 8).map((m) => (
                  <li key={m.id} className="truncate">{m.nome}</li>
                ))}
                {hover.grupo.membros.length > 8 && <li>e mais {hover.grupo.membros.length - 8}…</li>}
              </ul>
              <div className="mt-1 text-[10px] text-muted-foreground">clique para aproximar</div>
            </>
          )}
          {hover.ponto && (
            <>
              <b className="text-foreground">{hover.ponto.nome}</b>
              <div className="text-muted-foreground">
                {hover.ponto.ome}
                {hover.ponto.municipio ? ` · ${hover.ponto.municipio}` : ""}
              </div>
              <div className="mt-1 text-foreground">
                {fmtNumero(valorDoPonto(hover.ponto))} {rotuloValor}
                {" · "}
                {fmtNumero(hover.ponto.militares)} militar(es)
              </div>
              {hover.ponto.ancora?.noronha && (
                <div className="mt-1 text-[10px] text-muted-foreground">
                  a ilha é desenhada fora de escala e fora de posição
                </div>
              )}
              {hover.ponto.origemCoord !== "posto" && (
                <div className="mt-1 text-[10px] text-muted-foreground">
                  {hover.ponto.origemCoord === "municipio"
                    ? "posição aproximada — centro do município, o posto não tem coordenada própria"
                    : hover.ponto.origemCoord === "unidade"
                      ? "posição aproximada — coordenada da unidade que o posto nomeia"
                      : "posição aproximada — coordenada da OME"}
                </div>
              )}
            </>
          )}
        </div>,
        document.body
      )}

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
        <span className="ml-auto">Ctrl + rolar para aproximar · arrastar para mover</span>
      </div>
    </div>
  );
}
