// Cores de status de viatura, definidas pelo usuário (2026-08-18) — não são
// as mesmas cores da fonte (frotas define as suas próprias em
// vehicle_status_types.color), propositalmente: aqui seguem a paleta pedida
// para o app do DW.
const CORES = {
  "Ativa": { bg: "#90EEB1", texto: "#0f3d24" },
  "Manutenção": { bg: "#9A0100", texto: "#ffffff" },
  "Processo de Desfazimento": { bg: "#FBBE7F", texto: "#5c3200" },
};

const PADRAO = { bg: "var(--muted)", texto: "var(--muted-foreground)" };

export default function BadgeSituacao({ situacao }) {
  if (!situacao) return <span className="text-muted-foreground">—</span>;
  const cor = CORES[situacao] || PADRAO;
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{ backgroundColor: cor.bg, color: cor.texto }}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: cor.texto, opacity: 0.7 }} />
      {situacao}
    </span>
  );
}
