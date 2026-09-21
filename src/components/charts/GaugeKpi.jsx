import React, { useEffect, useState } from "react";
import { fmtNumero } from "@/lib/cbmpe";

const RAIO_ARCO = 80;
const RAIO_PONTEIRO = 60;
const RAIO_ROTULO_PCT = 98;
const CENTRO_X = 100;
const CENTRO_Y = 100;
const COMPRIMENTO_ARCO = Math.PI * RAIO_ARCO;

function pontoNoArco(fracao, raio) {
  const angulo = Math.PI * (1 - fracao);
  return { x: CENTRO_X + raio * Math.cos(angulo), y: CENTRO_Y - raio * Math.sin(angulo) };
}

// "Acelerômetro" de KPI — semicírculo estilo velocímetro: arco de fundo +
// arco preenchido (0 até `valor`, escala fixa 0..`maximo`) + ponteiro
// saindo do centro até o arco, igual um medidor de velocidade de veículo
// (pedido do usuário, 2026-09-21). "0" e `maximo` ficam nas duas pontas da
// base; o percentual fica logo acima da ponta do ponteiro/arco preenchido
// (viewBox com folga acima de y=0 — sem isso, perto de 50% o rótulo
// aparecia cortado no topo, ponteiro quase vertical). O valor bruto fica
// ABAIXO do ponteiro/base do arco, não mais no centro do semicírculo — a
// primeira versão sobrepunha o número com o próprio ponteiro (pedido do
// usuário, 2026-09-21, segunda correção).
//
// `valorAlvo` já existe como prop, mas NADA a usa ainda — pré-alinhado pra
// quando houver meta de vacinação por vacina (o usuário pediu
// explicitamente pra deixar o gancho pronto sem implementar a meta em si:
// sem UI de definir meta, sem persistência). Quando isso vier, só falta
// passar `valorAlvo` de verdade — o traço no arco já sabe se desenhar.
export default function GaugeKpi({ valor, maximo, valorAlvo, cor = "hsl(var(--primary))" }) {
  const fracaoAlvo = maximo > 0 ? Math.min(1, valor / maximo) : 0;
  const [fracaoAnimada, setFracaoAnimada] = useState(0);

  useEffect(() => {
    // setTimeout, não requestAnimationFrame: a página pode montar este
    // componente numa aba/pane sem compositar frames no momento (verificado
    // nesta sessão) — rAF nunca dispara nesse caso e a animação trava em
    // 0%. setTimeout só depende do event loop, não de haver um frame pra
    // pintar.
    const id = setTimeout(() => setFracaoAnimada(fracaoAlvo), 50);
    return () => clearTimeout(id);
  }, [fracaoAlvo]);

  const offset = COMPRIMENTO_ARCO * (1 - fracaoAnimada);
  const pontoValorAlvo = valorAlvo != null && maximo > 0 ? pontoNoArco(Math.min(1, valorAlvo / maximo), RAIO_ARCO) : null;
  const pontaPonteiro = pontoNoArco(fracaoAnimada, RAIO_PONTEIRO);
  const pontoPercentual = pontoNoArco(fracaoAnimada, RAIO_ROTULO_PCT);
  // Perto de 0% ou 100% o rótulo cai bem em cima da ponta esquerda/direita
  // do arco (x≈2 ou x≈198) — com texto centralizado ali, "0,0%" ficava
  // cortado pela borda do viewBox. Trava o x numa faixa seguro, sem mexer
  // no ângulo real do ponteiro (que continua exato).
  const xPercentual = Math.min(182, Math.max(18, pontoPercentual.x));
  const percentual = maximo > 0 ? ((valor / maximo) * 100).toFixed(1).replace(".", ",") : "0,0";

  return (
    <svg viewBox="0 -18 200 168" className="mx-auto w-full">
      <path
        d={`M 20 ${CENTRO_Y} A ${RAIO_ARCO} ${RAIO_ARCO} 0 0 1 180 ${CENTRO_Y}`}
        fill="none" stroke="hsl(var(--muted))" strokeWidth="16" strokeLinecap="round"
      />
      <path
        d={`M 20 ${CENTRO_Y} A ${RAIO_ARCO} ${RAIO_ARCO} 0 0 1 180 ${CENTRO_Y}`}
        fill="none" stroke={cor} strokeWidth="16" strokeLinecap="round"
        strokeDasharray={`${COMPRIMENTO_ARCO} ${COMPRIMENTO_ARCO}`}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 900ms ease-out" }}
      />
      {pontoValorAlvo && (
        <line
          x1={pontoValorAlvo.x} y1={pontoValorAlvo.y - 12} x2={pontoValorAlvo.x} y2={pontoValorAlvo.y + 12}
          stroke="hsl(var(--foreground))" strokeWidth="2"
        />
      )}

      {/* Ponteiro, saindo do centro até a borda do arco. */}
      <line
        x1={CENTRO_X} y1={CENTRO_Y} x2={pontaPonteiro.x} y2={pontaPonteiro.y}
        stroke="hsl(var(--foreground))" strokeWidth="3" strokeLinecap="round"
        style={{ transition: "x2 900ms ease-out, y2 900ms ease-out" }}
      />
      <circle cx={CENTRO_X} cy={CENTRO_Y} r="6" className="fill-foreground" />

      {/* Percentual, logo acima da ponta preenchida do arco — viewBox com
          folga acima de y=0 pra não cortar perto de 50% (ponteiro quase
          vertical, rótulo bem no topo). */}
      <text
        x={xPercentual} y={pontoPercentual.y} textAnchor="middle"
        className="fill-foreground text-[10px] font-semibold" style={{ transition: "x 900ms ease-out, y 900ms ease-out" }}
      >
        {percentual}%
      </text>

      {/* Base do arco: 0 à esquerda, efetivo total à direita. */}
      <text x="20" y="120" textAnchor="middle" className="fill-muted-foreground text-[10px] font-medium">0</text>
      <text x="180" y="120" textAnchor="middle" className="fill-muted-foreground text-[10px] font-medium">{fmtNumero(maximo)}</text>

      {/* Valor bruto, ABAIXO do ponteiro/base do arco — não mais em cima
          dele, pra não sobrepor. Fonte reduzida (30px -> 20px, pedido do
          usuário: estava grande demais). */}
      <text x={CENTRO_X} y="145" textAnchor="middle" className="fill-foreground font-display text-[20px] font-semibold">
        {fmtNumero(valor)}
      </text>
    </svg>
  );
}
