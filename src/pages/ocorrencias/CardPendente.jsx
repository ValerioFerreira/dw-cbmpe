import React from "react";
import { HelpCircle } from "lucide-react";

// Card "aguardando SQL/schema" — mesma convenção já usada no protótipo do
// Igor ("⏳ Aguardando dado", ver PENDENCIAS-PAINEIS-CORPORATIVOS.md), só
// que embutido como componente React em vez de HTML estático. Usado nos
// quadrantes onde status_ocorrencias.md confirma que Igor validou o card no
// Metabase, mas não colou o texto da query nem o schema da tabela de
// detalhe está verificado — nomear coluna aqui seria adivinhar (contra a
// regra do projeto). `motivo` vem de `pendenciasSemSql` no JSON de saída do
// extrator, não hardcoded — se o extrator um dia resolver a pendência, o
// texto some sozinho quando a chave for removida do JSON.
export default function CardPendente({ titulo, motivo }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
      <HelpCircle className="h-5 w-5 text-muted-foreground" />
      <p className="text-[13px] font-medium text-foreground">{titulo}</p>
      <p className="max-w-md text-[11px] text-muted-foreground">{motivo}</p>
    </div>
  );
}
