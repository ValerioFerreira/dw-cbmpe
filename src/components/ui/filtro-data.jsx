import React from "react";
import { createPortal } from "react-dom";
import { CalendarDays } from "lucide-react";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import usePosicaoAncorada from "@/lib/usePosicaoAncorada";

// Escolha de dia por calendário, para uma lista fechada de datas disponíveis.
//
// Substituiu o <select> do Mapa de Força: a janela tem 90 dias, e procurar
// "12/07" numa lista de noventa linhas é pior do que apontar no mês. Os dias
// sem lançamento ficam desabilitados no próprio calendário, o que também
// responde "até quando vai o dado" sem precisar de legenda.
//
// O balão é posicionado à mão, via portal no body, pelo mesmo motivo que o
// MultiSelectFiltro: o app roda com `html { zoom: 1.25 }` e o posicionamento
// do Radix erra 25% da distância até a origem. Ver src/lib/usePosicaoAncorada.js.

const LARGURA_PAINEL = 280;

/** "2026-08-24" → Date local. `new Date(iso)` interpretaria como UTC e, no
 *  fuso do Brasil, devolveria o dia anterior. */
export function dataDoIso(iso) {
  if (!iso) return undefined;
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, m - 1, d);
}

export function isoDaData(data) {
  const p = (n) => String(n).padStart(2, "0");
  return `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())}`;
}

export function formatarData(iso) {
  if (!iso) return "—";
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

export default function FiltroData({ valor, datas, onChange }) {
  const [aberto, setAberto] = React.useState(false);
  const gatilhoRef = React.useRef(null);
  const painelRef = React.useRef(null);
  const { pos } = usePosicaoAncorada({
    aberto,
    gatilhoRef,
    painelRef,
    largura: LARGURA_PAINEL,
    aoFechar: () => setAberto(false),
  });

  const disponiveis = React.useMemo(() => new Set(datas || []), [datas]);
  const limites = React.useMemo(() => {
    const ordenadas = (datas || []).slice().sort();
    return {
      de: dataDoIso(ordenadas[0]),
      ate: dataDoIso(ordenadas[ordenadas.length - 1]),
    };
  }, [datas]);

  const selecionada = dataDoIso(valor);

  return (
    <>
      <button
        ref={gatilhoRef}
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-[12px] font-medium text-foreground hover:bg-muted"
      >
        <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
        {formatarData(valor)}
      </button>

      {aberto && createPortal(
        <div
          ref={painelRef}
          style={{ top: pos.top, left: pos.left, width: LARGURA_PAINEL }}
          className="fixed z-50 rounded-lg border border-border bg-popover shadow-lg"
        >
          <Calendar
            mode="single"
            locale={ptBR}
            selected={selecionada}
            defaultMonth={selecionada || limites.ate}
            fromDate={limites.de}
            toDate={limites.ate}
            // Dia sem lançamento não é escolhível: o painel buscaria um
            // arquivo que não existe e cairia no estado de erro.
            disabled={(dia) => !disponiveis.has(isoDaData(dia))}
            onSelect={(dia) => {
              if (!dia) return;
              onChange(isoDaData(dia));
              setAberto(false);
            }}
          />
        </div>,
        document.body
      )}
    </>
  );
}
