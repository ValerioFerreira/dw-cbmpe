import React from "react";

// Botão de grupo "Mostrar: Todos / Top N" para gráficos com muitas barras —
// default sempre "Todos" (pedido do usuário: nada fica escondido por
// padrão, o corte é uma opção manual). Só faz sentido renderizar quando o
// gráfico realmente tem mais itens que a menor opção de corte.
export default function TopNControl({ value, onChange, total, opcoes = [10, 20] }) {
  if (total <= opcoes[0]) return null;
  const opcoesValidas = opcoes.filter((n) => n < total);

  return (
    <div className="inline-flex items-center rounded-lg border border-border bg-card p-0.5">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
          value === null ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Todos
      </button>
      {opcoesValidas.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
            value === n ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Top {n}
        </button>
      ))}
    </div>
  );
}
