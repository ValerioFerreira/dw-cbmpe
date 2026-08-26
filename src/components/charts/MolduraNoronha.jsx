import React from "react";
import { NORONHA_CAIXA } from "@/lib/projecaoPe";

// Moldura + rótulo de Fernando de Noronha, compartilhada pelos mapas
// (GeoChoropleth e GeoMarcadores).
//
// Existe porque a ilha é desenhada FORA de escala e FORA de posição: ela
// está a ~350 km da costa e, no tamanho real, teria 13 unidades de largura
// num mapa de 1000. Deslocar e ampliar é o que qualquer atlas faz, mas só
// é honesto se estiver escrito na cara do leitor — é isso que este
// componente garante, e é por isso que ele não é opcional. Ver
// src/lib/projecaoPe.js.
export default function MolduraNoronha({ margem = 3, escala = 1 }) {
  const { x, y, largura, altura, rotulo } = NORONHA_CAIXA;
  const m = margem / escala;
  return (
    <g className="pointer-events-none select-none">
      <rect
        x={x - m} y={y - m}
        width={largura + m * 2} height={altura + m * 2}
        rx={2 / escala}
        fill="none"
        stroke="hsl(var(--foreground) / 0.35)"
        strokeWidth={0.5 / escala}
        strokeDasharray={`${2 / escala} ${2 / escala}`}
      />
      {/* Um rótulo só, e legível: no viewBox de 1000 unidades qualquer coisa
          abaixo de ~7 vira borrão na tela. Duas linhas menores não seriam
          lidas — e o que precisa ser lido é justamente o aviso.
          Alinhado à DIREITA da ilha, não centrado: centrado, o texto (mais
          largo que a ilha) vazaria pela borda direita do viewBox e seria
          cortado. Ancorado no fim, ele cresce para dentro do mapa. */}
      <text
        x={x + largura} y={y - m - 3.5 / escala}
        textAnchor="end"
        style={{ fontSize: 7 / escala, fontWeight: 600, fill: "hsl(var(--muted-foreground))" }}
      >
        {rotulo}
      </text>
    </g>
  );
}
