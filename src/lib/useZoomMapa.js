import React from "react";

// Zoom e pan de um SVG por manipulação do viewBox.
//
// Por que viewBox e não `transform: scale()`: o mapa desenha texto e traços
// finos (0,4 de espessura no contorno do município). Escalando por transform,
// o traço e a fonte crescem junto e o mapa vira um borrão ampliado. Mudando o
// viewBox, o SVG é REDESENHADO no novo enquadramento — o traço continua com a
// mesma espessura na tela, que é o que se espera de um mapa.
//
// Em troca, quem desenha precisa dividir os tamanhos fixos (raio de balão,
// fonte, espessura) por `escala`, senão eles crescem junto com o zoom. O hook
// devolve `escala` pronto para isso.
//
// ARRASTAR (corrigido em 2026-08-26). A versão anterior misturava dois
// referenciais: media o deslocamento do mouse na escala do viewBox ATUAL,
// que ela mesma acabara de alterar no quadro anterior do arrasto. O efeito
// era o mapa "escapando" do cursor e acelerando sozinho. Agora o arrasto
// congela o quadro inicial (`vb` e o retângulo do SVG no mousedown) e cada
// movimento é calculado SEMPRE a partir dele:
//
//     unidades por pixel = vbInicial.w / retangulo.width
//     x = vbInicial.x - (clientX - clientXInicial) * unidadesPorPixel
//
// Assim o ponto que estava sob o cursor continua sob o cursor do começo ao
// fim do gesto — é o comportamento do Google Maps. Com setPointerCapture o
// gesto sobrevive a sair de cima do SVG e ao soltar o botão fora da janela.
//
// ROLAR. A roda só dá zoom com Ctrl pressionado (pedido do usuário): o mapa
// ocupa boa parte da página, e capturar a rolagem normal prendia quem só
// queria descer até as viaturas e o efetivo escalado. Sem Ctrl, o evento
// passa direto e a página rola.

const ZOOM_MIN = 1;
const ZOOM_MAX = 14;
const PASSO_BOTAO = 1.6;
const PASSO_RODA = 1.18;
// Abaixo disso o mouseup ainda conta como clique, não como arrasto.
const ARRASTO_MINIMO_PX = 3;

export default function useZoomMapa(inicial) {
  const base = React.useMemo(() => ({ ...inicial }), [inicial.x, inicial.y, inicial.w, inicial.h]);
  const [vb, setVb] = React.useState(base);
  const [arrastandoAgora, setArrastandoAgora] = React.useState(false);
  const svgRef = React.useRef(null);
  const arrasto = React.useRef(null);
  // O pan precisa ler o viewBox mais recente dentro de um handler nativo sem
  // se re-registrar a cada quadro; a ref acompanha o estado.
  const vbRef = React.useRef(vb);
  vbRef.current = vb;

  React.useEffect(() => { setVb(base); }, [base]);

  const escala = base.w / vb.w;

  /** Enquadramento válido: zoom entre 1x e 14x e sempre dentro do mapa, para
   *  não ser possível "cair fora" e ficar com a tela vazia. */
  const limitar = React.useCallback((novo) => {
    const w = Math.min(base.w / ZOOM_MIN, Math.max(base.w / ZOOM_MAX, novo.w));
    const h = w * (base.h / base.w);
    return {
      w,
      h,
      x: Math.min(Math.max(novo.x, base.x), base.x + base.w - w),
      y: Math.min(Math.max(novo.y, base.y), base.y + base.h - h),
    };
  }, [base]);

  const aplicar = React.useCallback((novo) => setVb(limitar(novo)), [limitar]);

  /** Ponto do SVG (unidades do viewBox) sob um evento de mouse. */
  const pontoDoEvento = React.useCallback((e) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    const atual = vbRef.current;
    return {
      x: atual.x + ((e.clientX - r.left) / r.width) * atual.w,
      y: atual.y + ((e.clientY - r.top) / r.height) * atual.h,
    };
  }, []);

  /**
   * Aproxima/afasta mantendo parado o ponto sob o cursor (`fracao`, 0..1 do
   * quadro em cada eixo). A conta é feita DENTRO do setVb, a partir do estado
   * anterior, e não a partir de uma leitura externa: numa rolagem rápida o
   * navegador entrega vários `wheel` no mesmo quadro, e a versão que lia o
   * viewBox de fora aplicava só o primeiro — os outros oito partiam do mesmo
   * valor e escreviam o mesmo resultado. Medido: nove eventos davam 1,18x em
   * vez de 4,9x.
   */
  const zoomEm = React.useCallback((fator, fracao) => {
    setVb((atual) => {
      const w = atual.w / fator;
      const h = atual.h / fator;
      const f = fracao || { x: 0.5, y: 0.5 };
      return limitar({
        x: atual.x + atual.w * f.x - w * f.x,
        y: atual.y + atual.h * f.y - h * f.y,
        w,
        h,
      });
    });
  }, [limitar]);

  /** Fração (0..1) do quadro em que o cursor está — independe do viewBox, o
   *  que a torna válida mesmo quando vários eventos chegam no mesmo quadro. */
  const fracaoDoEvento = React.useCallback((e) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  }, []);

  const aoRolar = React.useCallback((e) => {
    // Sem Ctrl a roda é da página, não do mapa. Nada de preventDefault aqui:
    // é justamente o que deixa a rolagem seguir.
    if (!e.ctrlKey) return;
    e.preventDefault();
    zoomEm(e.deltaY < 0 ? PASSO_RODA : 1 / PASSO_RODA, fracaoDoEvento(e));
  }, [zoomEm, fracaoDoEvento]);

  // O wheel precisa de listener não-passivo para poder chamar
  // preventDefault(); o React registra onWheel como passivo.
  React.useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;
    svg.addEventListener("wheel", aoRolar, { passive: false });
    return () => svg.removeEventListener("wheel", aoRolar);
  }, [aoRolar]);

  function aoPressionar(e) {
    if (e.button !== 0) return;
    const svg = svgRef.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    arrasto.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      vb: { ...vbRef.current },
      // O retângulo é medido UMA vez: durante o gesto ele não muda, e
      // remedi-lo a cada movimento só adiciona reflow.
      porPixelX: vbRef.current.w / r.width,
      porPixelY: vbRef.current.h / r.height,
      moveu: false,
    };
    // Segura o gesto mesmo se o cursor sair do SVG (ou da janela).
    if (svg.setPointerCapture && e.pointerId !== undefined) {
      try { svg.setPointerCapture(e.pointerId); } catch { /* sem captura, tudo bem */ }
    }
  }

  function aoMover(e) {
    const a = arrasto.current;
    if (!a) return;
    const dx = e.clientX - a.clientX;
    const dy = e.clientY - a.clientY;
    if (!a.moveu && Math.hypot(dx, dy) > ARRASTO_MINIMO_PX) {
      a.moveu = true;
      setArrastandoAgora(true);
    }
    if (!a.moveu) return;
    // Arrastar para a direita move o mapa para a direita, ou seja, a janela
    // anda para a esquerda — daí o sinal negativo.
    aplicar({
      x: a.vb.x - dx * a.porPixelX,
      y: a.vb.y - dy * a.porPixelY,
      w: a.vb.w,
      h: a.vb.h,
    });
  }

  function aoSoltar(e) {
    const a = arrasto.current;
    const svg = svgRef.current;
    if (svg?.releasePointerCapture && e?.pointerId !== undefined) {
      try { svg.releasePointerCapture(e.pointerId); } catch { /* já solto */ }
    }
    // O clique no balão dispara depois do mouseup; a marca de "acabou de
    // arrastar" precisa sobreviver a esse quadro, senão todo pan que terminar
    // em cima de um posto abre o detalhe dele.
    if (a?.moveu) {
      arrasto.current = { encerrado: true };
      setTimeout(() => { arrasto.current = null; setArrastandoAgora(false); }, 0);
    } else {
      arrasto.current = null;
      setArrastandoAgora(false);
    }
    return !!a?.moveu;
  }

  /** true durante (e no instante seguinte a) um arrasto — usar para não
   *  disparar clique de balão logo depois de mover o mapa. */
  const arrastando = () => !!(arrasto.current?.moveu || arrasto.current?.encerrado);

  /**
   * Aproxima até um conjunto de pontos caber com folga — usado ao clicar num
   * grupo, para abri-lo em vez de escolher um membro qualquer. O alvo é ficar
   * com o grupo ocupando pouco mais que `distanciaGrupo`, que é justamente o
   * limite abaixo do qual eles voltariam a se agrupar.
   */
  const enquadrar = React.useCallback((membros, distanciaGrupo) => {
    if (!membros?.length) return;
    const xs = membros.map((m) => m.x);
    const ys = membros.map((m) => m.y);
    const larguraGrupo = Math.max(...xs) - Math.min(...xs);
    const alturaGrupo = Math.max(...ys) - Math.min(...ys);
    const centroX = (Math.max(...xs) + Math.min(...xs)) / 2;
    const centroY = (Math.max(...ys) + Math.min(...ys)) / 2;
    // Largura de quadro que faz a distância-limite virar ~1/6 da tela: aí os
    // membros necessariamente se separam.
    const alvo = Math.max(larguraGrupo, alturaGrupo * (base.w / base.h), distanciaGrupo) * 6;
    const w = Math.max(base.w / ZOOM_MAX, Math.min(base.w, alvo));
    const h = w * (base.h / base.w);
    aplicar({ x: centroX - w / 2, y: centroY - h / 2, w, h });
  }, [base, aplicar]);

  return {
    svgRef,
    enquadrar,
    vb,
    escala,
    zoomAtivo: escala > 1.01,
    arrastandoAgora,
    maisZoom: () => zoomEm(PASSO_BOTAO),
    menosZoom: () => zoomEm(1 / PASSO_BOTAO),
    resetar: () => setVb(base),
    aoPressionar,
    aoMover,
    aoSoltar,
    arrastando,
    pontoDoEvento,
  };
}
