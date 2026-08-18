import React from "react";

// Larguras de coluna redimensionáveis pelo usuário (arrastar a alça na borda
// direita do cabeçalho) + truncagem do conteúdo que ultrapassa a largura.
// Compartilhado entre as tabelas de Efetivo e Viaturas. Cada coluna pode
// declarar `largura` (px) inicial; sem isso usa LARGURA_PADRAO.
export const LARGURA_PADRAO = 150;
export const LARGURA_MIN = 60;

// Classe aplicada às células (e ao rótulo do cabeçalho) pra cortar o que
// passar da largura da coluna — depende de `table-fixed` na <table>.
export const CELULA_TRUNCADA = "overflow-hidden text-ellipsis whitespace-nowrap";

export function useLarguras(colunas) {
  const inicial = React.useMemo(() => {
    const m = {};
    colunas.forEach((c) => { m[c.chave] = c.largura || LARGURA_PADRAO; });
    return m;
  }, [colunas]);

  const [larguras, setLarguras] = React.useState(inicial);
  React.useEffect(() => { setLarguras(inicial); }, [inicial]);

  // Espelho pra ler a largura corrente no início do arrasto sem recriar o
  // handler a cada mudança.
  const ref = React.useRef(larguras);
  ref.current = larguras;

  const iniciarResize = React.useCallback((chave, e) => {
    e.preventDefault();
    e.stopPropagation();
    // A página usa `html { zoom: 1.25 }`; clientX vem no espaço não-zoom,
    // então dividimos o deslocamento pelo zoom pra casar com a largura em px
    // aplicada no <col> (que o zoom reescala ao renderizar).
    const zoom = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
    const x0 = e.clientX;
    const w0 = ref.current[chave] || LARGURA_PADRAO;
    const mover = (ev) => {
      const nova = Math.max(LARGURA_MIN, w0 + (ev.clientX - x0) / zoom);
      setLarguras((prev) => ({ ...prev, [chave]: nova }));
    };
    const soltar = () => {
      window.removeEventListener("mousemove", mover);
      window.removeEventListener("mouseup", soltar);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    window.addEventListener("mousemove", mover);
    window.addEventListener("mouseup", soltar);
  }, []);

  const larguraTotal = colunas.reduce((s, c) => s + (larguras[c.chave] || LARGURA_PADRAO), 0);
  return { larguras, iniciarResize, larguraTotal };
}

export function ColGroup({ colunas, larguras }) {
  return (
    <colgroup>
      {colunas.map((c) => (
        <col key={c.chave} style={{ width: `${larguras[c.chave] || LARGURA_PADRAO}px` }} />
      ))}
    </colgroup>
  );
}

// Alça de redimensionamento na borda direita do <th>. Fica sobre a divisa
// das colunas; o mousedown não deve disparar filtro/ordenação.
export function AlcaResize({ onMouseDown }) {
  return (
    <span
      onMouseDown={onMouseDown}
      onClick={(e) => e.stopPropagation()}
      title="Arraste para ajustar a largura"
      className="group absolute right-0 top-0 z-30 flex h-full w-2 cursor-col-resize touch-none items-center justify-center"
    >
      <span className="h-1/2 w-px bg-border group-hover:h-full group-hover:w-0.5 group-hover:bg-primary" />
    </span>
  );
}
