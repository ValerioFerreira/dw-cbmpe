import React from "react";

// Posiciona um balão flutuante logo abaixo de um gatilho, num app que usa
// `html { zoom: 1.25 }` (src/index.css).
//
// POR QUE ISTO EXISTE, e por que não usamos o posicionamento do Radix.
// O Radix (Floating UI) mede o gatilho com getBoundingClientRect(), que
// devolve pixels REAIS, e aplica o resultado como
// `transform: translate(x, y)` num wrapper que está DENTRO do <html>
// zoomado — onde o navegador multiplica tudo por 1,25. Resultado medido em
// 2026-08-26: gatilho em (575, 420), balão em (719, 530). O erro é 25% da
// distância até a origem, então cresce quanto mais à direita/abaixo o
// filtro estiver — era o "balão aparecendo muito distante do filtro".
//
// A conta certa é a inversa: dividir as medidas reais pelo zoom antes de
// escrevê-las em `top`/`left` de um `position: fixed`, porque esse fixed
// também vive no espaço zoomado. É o que este hook faz — a mesma lógica que
// FiltroColuna já usava e que foi verificada no navegador (gatilho e balão
// coincidem em x, com 5px de folga em y).
//
// Requer que o balão seja renderizado por createPortal em document.body.

export const MARGEM_JANELA = 8;
export const FOLGA_GATILHO = 4;

export default function usePosicaoAncorada({ aberto, gatilhoRef, painelRef, largura, aoFechar }) {
  const [pos, setPos] = React.useState({ top: 0, left: 0 });

  // `aoFechar` costuma ser uma arrow inline em quem chama, ou seja, uma
  // função nova a cada render. Guardá-la numa ref a tira das dependências do
  // efeito abaixo — senão o efeito se re-registra a cada render, chama
  // calcular(), que chama setPos, que causa outro render: "Maximum update
  // depth exceeded". Foi exatamente o que apareceu no console ao montar o
  // FiltroData.
  const fecharRef = React.useRef(aoFechar);
  fecharRef.current = aoFechar;

  const calcular = React.useCallback(() => {
    if (!gatilhoRef.current) return;
    const zoom = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
    const r = gatilhoRef.current.getBoundingClientRect();
    const larguraViewport = window.innerWidth / zoom;
    const larguraPainel = largura ?? painelRef?.current?.offsetWidth ?? 0;
    const left = Math.min(
      Math.max(MARGEM_JANELA, r.left / zoom),
      Math.max(MARGEM_JANELA, larguraViewport - larguraPainel - MARGEM_JANELA)
    );
    const top = r.bottom / zoom + FOLGA_GATILHO;
    // Só troca o estado quando a posição mudou de fato: um objeto novo a cada
    // chamada re-renderiza sem necessidade e realimenta o ciclo acima.
    setPos((atual) => (atual.top === top && atual.left === left ? atual : { top, left }));
  }, [gatilhoRef, painelRef, largura]);

  React.useEffect(() => {
    if (!aberto) return undefined;
    calcular();
    function aoClicarFora(e) {
      if (painelRef?.current?.contains(e.target) || gatilhoRef.current?.contains(e.target)) return;
      fecharRef.current?.();
    }
    function aoTeclar(e) {
      if (e.key === "Escape") fecharRef.current?.();
    }
    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoTeclar);
    // capture: true para pegar o scroll de qualquer contêiner interno — no
    // AppShell quem rola é o <main>, não a janela.
    window.addEventListener("scroll", calcular, true);
    window.addEventListener("resize", calcular);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclar);
      window.removeEventListener("scroll", calcular, true);
      window.removeEventListener("resize", calcular);
    };
  }, [aberto, calcular, gatilhoRef, painelRef]);

  return { pos, recalcular: calcular };
}
