import React from "react";
import { createPortal } from "react-dom";
import { Filter } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

const LARGURA_PAINEL_FILTRO = 256;

// Filtro estilo "funil" (ícone + dropdown com busca e checkboxes) para
// colunas de tabela — extraído de EfetivoDetalhe.jsx pra ser reaproveitado
// também na tabela de Viaturas, mantendo o mesmo comportamento (inclusive o
// cálculo manual de posição, necessário por causa do `html { zoom: 1.25 }`
// global — ver comentário em calcularPosicao).
export function passaFiltro(valor, selecionado) {
  if (!selecionado) return true;
  return selecionado.has(valor);
}

// Valor de uma coluna pro filtro (checkboxes de valor único) — booleans
// viram "Sim"/"Não" em vez de "true"/"false" cru, ausência vira "—".
export function valorFiltro(coluna, r) {
  const b = coluna.bruto(r);
  if (typeof b === "boolean") return b ? "Sim" : "Não";
  return b === null || b === undefined || b === "" ? "—" : String(b);
}

// Número comparável pro filtro de intervalo (ver filtrosIniciaisDaUrl) — uma
// coluna de data (ISO "aaaa-mm-dd") não é number(), então extrai só o ano;
// os demais tipos (inteiro) já são number() diretamente.
export function numeroComparavel(bruto) {
  if (typeof bruto === "string") {
    const iso = bruto.match(/^(\d{4})-\d{2}-\d{2}/);
    if (iso) return Number(iso[1]);
  }
  return Number(bruto);
}

// Drill-down: monta o estado inicial de `filtros` a partir da URL — usado
// quando se chega a uma tabela de detalhamento (Efetivo, Viaturas) por um
// clique em barra/fatia/linha de algum módulo de dashboard (ver
// linkEfetivoTabela/linkViaturaTabela). Duas formas:
//  - `?chave=valor1,valor2` — filtro exato (Set com esses valores).
//  - `?chaveMin=N&chaveMax=N` — intervalo numérico, resolvido aqui contra os
//    valores reais da coluna (ex.: idade, ano) porque a URL não enumera cada
//    valor individualmente.
export function filtrosIniciaisDaUrl(searchParams, colunas, registros) {
  const filtros = {};
  colunas.forEach((c) => {
    const exato = searchParams.get(c.chave);
    if (exato !== null) {
      filtros[c.chave] = new Set(exato.split(","));
      return;
    }
    const minStr = searchParams.get(`${c.chave}Min`);
    const maxStr = searchParams.get(`${c.chave}Max`);
    if (minStr === null && maxStr === null) return;
    const min = minStr !== null ? Number(minStr) : -Infinity;
    const max = maxStr !== null ? Number(maxStr) : Infinity;
    const valores = new Set();
    registros.forEach((r) => {
      const bruto = c.bruto(r);
      if (bruto === null || bruto === undefined || bruto === "") return;
      const n = numeroComparavel(bruto);
      if (!Number.isNaN(n) && n >= min && n <= max) valores.add(valorFiltro(c, r));
    });
    filtros[c.chave] = valores;
  });
  return filtros;
}

export function FiltroColuna({ valoresDisponiveis, selecionado, onChange }) {
  const [busca, setBusca] = React.useState("");
  const [aberto, setAberto] = React.useState(false);
  const [pos, setPos] = React.useState({ top: 0, left: 0 });
  const botaoRef = React.useRef(null);
  const painelRef = React.useRef(null);

  function calcularPosicao() {
    if (!botaoRef.current) return;
    // `html { zoom: 1.25 }` (src/index.css) reescala a página inteira. Um
    // elemento "position: fixed" dentro do <html> zoomado interpreta seu
    // left/top NO ESPAÇO LOCAL (pré-zoom), mas getBoundingClientRect()/
    // innerWidth sempre devolvem pixels reais (pós-zoom) — sem dividir
    // pelo zoom aqui, o balão saía deslocado.
    const zoom = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
    const r = botaoRef.current.getBoundingClientRect();
    const larguraViewport = window.innerWidth / zoom;
    const left = Math.min(
      Math.max(8, r.left / zoom),
      larguraViewport - LARGURA_PAINEL_FILTRO - 8
    );
    setPos({ top: r.bottom / zoom + 4, left });
  }

  function alternarAberto() {
    if (!aberto) calcularPosicao();
    setAberto((v) => !v);
  }

  React.useEffect(() => {
    if (!aberto) return;
    function aoClicarFora(e) {
      if (painelRef.current?.contains(e.target) || botaoRef.current?.contains(e.target)) return;
      setAberto(false);
    }
    function aoRolarOuRedimensionar() {
      calcularPosicao();
    }
    document.addEventListener("mousedown", aoClicarFora);
    window.addEventListener("scroll", aoRolarOuRedimensionar, true);
    window.addEventListener("resize", aoRolarOuRedimensionar);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      window.removeEventListener("scroll", aoRolarOuRedimensionar, true);
      window.removeEventListener("resize", aoRolarOuRedimensionar);
    };
  }, [aberto]);

  const visiveis = React.useMemo(() => {
    const q = busca.trim().toLowerCase();
    return q ? valoresDisponiveis.filter((v) => v.toLowerCase().includes(q)) : valoresDisponiveis;
  }, [valoresDisponiveis, busca]);

  function alternar(v) {
    const base = selecionado ? new Set(selecionado) : new Set(valoresDisponiveis);
    if (base.has(v)) base.delete(v); else base.add(v);
    onChange(base);
  }

  const ativo = selecionado !== undefined;

  return (
    <>
      <button
        ref={botaoRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); alternarAberto(); }}
        aria-label="Filtrar coluna"
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded transition-colors ${
          ativo ? "text-primary" : "text-muted-foreground/50 hover:text-foreground"
        }`}
      >
        <Filter className="h-3 w-3" fill={ativo ? "currentColor" : "none"} />
      </button>
      {aberto && createPortal(
        <div
          ref={painelRef}
          onClick={(e) => e.stopPropagation()}
          style={{ position: "fixed", top: pos.top, left: pos.left, width: LARGURA_PAINEL_FILTRO }}
          className="z-50 rounded-md border border-border bg-popover text-popover-foreground shadow-md normal-case tracking-normal"
        >
          <div className="border-b border-border p-2">
            <input
              autoFocus
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar valor"
              className="h-7 w-full rounded-md border border-input bg-background px-2 text-[12px] outline-none focus:border-primary"
            />
          </div>
          <div className="flex gap-3 border-b border-border p-2 text-[11px] font-medium text-primary">
            <button type="button" onClick={() => onChange(undefined)}>Selecionar tudo</button>
            <button type="button" onClick={() => onChange(new Set())}>Limpar seleção</button>
          </div>
          <div className="max-h-56 overflow-y-auto p-1">
            {visiveis.map((v) => (
              <label key={v} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[12px] hover:bg-muted/60">
                <Checkbox
                  checked={selecionado ? selecionado.has(v) : true}
                  onCheckedChange={() => alternar(v)}
                />
                <span className="truncate">{v}</span>
              </label>
            ))}
            {visiveis.length === 0 && (
              <p className="px-2 py-3 text-center text-[11px] text-muted-foreground">Nenhum valor encontrado.</p>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
