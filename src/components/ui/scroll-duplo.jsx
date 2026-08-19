import React from "react";

// Wrapper de tabela com barra de rolagem horizontal no topo E embaixo,
// sincronizadas — a de baixo é a rolagem real (com a vertical junto), a de
// cima é um espelho só pra ficar acessível sem precisar rolar até o fim da
// tabela. Usado nas tabelas de Efetivo/Viaturas. A barra usa o estilo
// escurecido (.scrollbar-escuro, ver index.css) pra ficar bem visível.
export default function ScrollDuplo({ children, maxHeight = "36rem" }) {
  const topoRef = React.useRef(null);
  const baixoRef = React.useRef(null);
  const conteudoRef = React.useRef(null);
  const [largura, setLargura] = React.useState(0);
  const travado = React.useRef(false);

  React.useLayoutEffect(() => {
    const el = conteudoRef.current;
    if (!el) return;
    const atualizar = () => setLargura(el.scrollWidth);
    atualizar();
    const ro = new ResizeObserver(atualizar);
    ro.observe(el);
    return () => ro.disconnect();
  }, [children]);

  // Sincroniza scrollLeft entre as duas barras sem entrar em loop (a que
  // recebe o scroll programático não deve reemitir pro outro lado).
  const sincronizar = (origem, destinoRef) => {
    if (travado.current) {
      travado.current = false;
      return;
    }
    const destino = destinoRef.current;
    if (destino && destino.scrollLeft !== origem.scrollLeft) {
      travado.current = true;
      destino.scrollLeft = origem.scrollLeft;
    }
  };

  return (
    <>
      <div
        ref={topoRef}
        onScroll={(e) => sincronizar(e.currentTarget, baixoRef)}
        className="overflow-x-auto overflow-y-hidden scrollbar-escuro"
      >
        <div style={{ width: largura, height: 1 }} />
      </div>
      <div
        ref={baixoRef}
        onScroll={(e) => sincronizar(e.currentTarget, topoRef)}
        style={{ maxHeight }}
        className="overflow-auto scrollbar-escuro"
      >
        <div ref={conteudoRef}>
          {children}
        </div>
      </div>
    </>
  );
}
