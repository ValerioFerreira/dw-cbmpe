import React, { useMemo } from "react";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Cell, LabelList, Legend
} from "recharts";

const COR_PRIMARIA = "hsl(var(--primary))";
const COR_CINZA = "hsl(var(--muted-foreground))";
const COR_ACENTO = "hsl(var(--accent))";
const COR_GRID = "hsl(var(--border))";
const COR_TEXTO = "hsl(var(--muted-foreground))";

// Paleta padrão: vermelho (marca) + cinza como par de 2 cores — laranja
// (--accent) só entra como 3ª cor em diante, nunca como a 2ª (pedido do
// usuário: evitar laranja em distinções de apenas 2 categorias).
const PALETA_PADRAO = [COR_PRIMARIA, COR_CINZA, COR_ACENTO, "hsl(var(--chart-3))", "hsl(var(--chart-4))"];

function fmtRotulo(v) {
  return typeof v === "number" ? v.toLocaleString("pt-BR") : v;
}

// Rótulo de ponto de linha que evita sobrepor a própria linha: fica acima
// num pico (ponto ≥ os dois vizinhos existentes) e abaixo num vale — exceto
// no mínimo global da série, que fica sempre acima (não há espaço abaixo,
// coincide com o eixo X).
function criarRotuloLinha(data, chave, formatarRotulo) {
  const valores = data.map((d) => Number(d[chave]));
  const minimoGlobal = Math.min(...valores);
  return function RotuloLinha({ x, y, index, value }) {
    if (value === undefined || value === null || x === undefined || y === undefined) return null;
    const atual = valores[index];
    const anterior = index > 0 ? valores[index - 1] : null;
    const proximo = index < valores.length - 1 ? valores[index + 1] : null;
    const ehPico = (anterior === null || atual >= anterior) && (proximo === null || atual >= proximo);
    const abaixo = !ehPico && atual > minimoGlobal;
    return (
      <text x={x} y={y} dy={abaixo ? 16 : -8} textAnchor="middle" fontSize={10} fill="hsl(var(--foreground))">
        {formatarRotulo(value)}
      </text>
    );
  };
}

function TooltipCustom({ active, payload, label, unidade, formatador }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg">
      {label !== undefined && <p className="mb-1 text-[11px] font-medium text-muted-foreground">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2 text-[12px]">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold text-foreground">
            {formatador ? formatador(p.value) : `${p.value}${unidade ? " " + unidade : ""}`}
          </span>
        </p>
      ))}
    </div>
  );
}

export default function PanelGrafico({
  tipo = "bar", data, xKey = "label", yKeys = ["valor"], altura = 240, unidade, cores, stacked = false,
  aoClicarBarra, legenda = false, formatoValor, formatoTooltip, curva = "monotone",
  anguloEixoX = -35, alturaEixoX = 64, fontEixoX = 11, paddingEixoX = { left: 0, right: 0 },
}) {
  const palette = useMemo(() => cores || PALETA_PADRAO, [cores]);
  const clicavel = typeof aoClicarBarra === "function";
  const formatarRotulo = formatoValor || fmtRotulo;
  const formatarTooltip = formatoTooltip || formatoValor;

  // Siglas de unidade vão até ~10 caracteres ("DINTER II") — uma largura
  // fixa cortava os nomes mais longos no eixo de categorias do hbar.
  const larguraEixoYCategoria = useMemo(() => {
    if (tipo !== "hbar") return 56;
    const maiorRotulo = data.reduce((m, d) => Math.max(m, String(d[xKey] ?? "").length), 0);
    return Math.min(220, Math.max(56, maiorRotulo * 6 + 16));
  }, [tipo, data, xKey]);

  // Rótulos de valor no fim da barra (ex. "R$ 3.884.760") podem ser bem mais
  // largos que a margem fixa antiga reservava, cortando o texto.
  const margemDireitaHbar = useMemo(() => {
    if (tipo !== "hbar") return 24;
    const maiorTexto = data.reduce(
      (m, d) => Math.max(m, ...yKeys.map((k) => String(formatarRotulo(d[k]) ?? "").length)),
      0
    );
    return Math.min(120, Math.max(24, maiorTexto * 6 + 16));
  }, [tipo, data, yKeys, formatarRotulo]);

  const margemBase = { top: 8, right: legenda ? 96 : 8, bottom: 0, left: 4 };
  const propsComuns = { data, margin: margemBase };

  // bar/line/area com muitas categorias no eixo X (ex. série diária de
  // Ocorrências, ~270 dias, ou um ranking de OME sem corte tipo "Diretoria")
  // colidiam: `interval={0}` forçava mostrar TODO tick, e o LabelList de
  // valor em cima de cada ponto/barra virava uma pilha ilegível de números
  // sobrepostos. Acima de 20 categorias, mostra só ~15 ticks (distribuídos)
  // e some com os rótulos de valor — o dado exato continua no tooltip.
  // hbar não entra aqui: já tem a própria defesa (altura dinâmica por
  // Math.max(320, n*26), sem eixo de categoria compartilhado com bar/line).
  const muitasCategoriasEixoX = tipo !== "hbar" && data.length > 20;
  const intervaloEixoX = muitasCategoriasEixoX ? Math.ceil(data.length / 15) - 1 : 0;
  const suprimirRotuloPonto = muitasCategoriasEixoX;

  const eixoX = (
    <XAxis
      dataKey={xKey}
      tick={{ fontSize: fontEixoX, fill: COR_TEXTO }}
      tickLine={false}
      axisLine={{ stroke: COR_GRID }}
      interval={intervaloEixoX}
      angle={anguloEixoX}
      textAnchor="end"
      height={alturaEixoX}
      padding={paddingEixoX}
    />
  );

  return (
    <ResponsiveContainer width="100%" height={altura}>
      {tipo === "bar" ? (
        <BarChart {...propsComuns} margin={{ ...margemBase, top: 24, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={COR_GRID} vertical={false} />
          {eixoX}
          <YAxis tick={{ fontSize: 11, fill: COR_TEXTO }} tickLine={false} axisLine={false} />
          <Tooltip content={<TooltipCustom unidade={unidade} formatador={formatarTooltip} />} cursor={{ fill: "hsl(var(--muted))" }} />
          {legenda && <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: 12 }} />}
          {yKeys.map((k, i) => (
            <Bar
              key={k}
              dataKey={k}
              fill={palette[i % palette.length]}
              stackId={stacked ? "a" : undefined}
              radius={[3, 3, 0, 0]}
              maxBarSize={42}
              isAnimationActive={false}
              cursor={clicavel ? "pointer" : undefined}
              onClick={clicavel ? (pontoDado) => aoClicarBarra(pontoDado?.payload || pontoDado, k) : undefined}
            >
              {data.map((_, idx) => <Cell key={idx} fill={palette[i % palette.length]} />)}
              {!suprimirRotuloPonto && (
                <LabelList dataKey={k} position="top" formatter={formatarRotulo} style={{ fontSize: 10, fill: "hsl(var(--foreground))" }} />
              )}
            </Bar>
          ))}
        </BarChart>
      ) : tipo === "hbar" ? (
        // Barras horizontais rankeadas — categoria no eixo Y, valor no eixo X
        // (ex. "Ingresso de militares" por ano, painel 07). Altura precisa
        // escalar com o nº de categorias pra cada barra não ficar espremida.
        <BarChart {...propsComuns} layout="vertical" margin={{ top: 8, right: legenda ? 96 : margemDireitaHbar, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={COR_GRID} horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: COR_TEXTO }} tickLine={false} axisLine={{ stroke: COR_GRID }} />
          <YAxis type="category" dataKey={xKey} tick={{ fontSize: 11, fill: COR_TEXTO }} tickLine={false} axisLine={false} width={larguraEixoYCategoria} interval={0} />
          <Tooltip content={<TooltipCustom unidade={unidade} formatador={formatarTooltip} />} cursor={{ fill: "hsl(var(--muted))" }} />
          {legenda && <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: 12 }} />}
          {yKeys.map((k, i) => (
            <Bar
              key={k}
              dataKey={k}
              fill={palette[i % palette.length]}
              radius={[0, 3, 3, 0]}
              maxBarSize={18}
              isAnimationActive={false}
              cursor={clicavel ? "pointer" : undefined}
              onClick={clicavel ? (pontoDado) => aoClicarBarra(pontoDado?.payload || pontoDado, k) : undefined}
            >
              {data.map((_, idx) => <Cell key={idx} fill={palette[i % palette.length]} />)}
              <LabelList dataKey={k} position="right" formatter={formatarRotulo} style={{ fontSize: 10, fill: "hsl(var(--foreground))" }} />
            </Bar>
          ))}
        </BarChart>
      ) : tipo === "line" ? (
        <LineChart {...propsComuns} margin={{ ...margemBase, top: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={COR_GRID} vertical={false} />
          {eixoX}
          <YAxis tick={{ fontSize: 11, fill: COR_TEXTO }} tickLine={false} axisLine={false} />
          <Tooltip content={<TooltipCustom unidade={unidade} formatador={formatarTooltip} />} />
          {legenda && <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: 12 }} />}
          {yKeys.map((k, i) => (
            <Line key={k} type={curva} dataKey={k} stroke={palette[i % palette.length]} strokeWidth={2} dot={false} activeDot={{ r: 4 }}>
              {yKeys.length === 1 && !suprimirRotuloPonto && <LabelList dataKey={k} content={criarRotuloLinha(data, k, formatarRotulo)} />}
            </Line>
          ))}
        </LineChart>
      ) : (
        <AreaChart {...propsComuns}>
          <defs>
            {yKeys.map((k, i) => (
              <linearGradient key={k} id={`grad-${k}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={palette[i % palette.length]} stopOpacity={0.28} />
                <stop offset="100%" stopColor={palette[i % palette.length]} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={COR_GRID} vertical={false} />
          {eixoX}
          <YAxis tick={{ fontSize: 11, fill: COR_TEXTO }} tickLine={false} axisLine={false} />
          <Tooltip content={<TooltipCustom unidade={unidade} formatador={formatarTooltip} />} />
          {yKeys.map((k, i) => (
            <Area key={k} type="monotone" dataKey={k} stroke={palette[i % palette.length]} strokeWidth={2} fill={`url(#grad-${k})`} />
          ))}
        </AreaChart>
      )}
    </ResponsiveContainer>
  );
}
