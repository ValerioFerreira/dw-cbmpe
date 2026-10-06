import React, { useSyncExternalStore } from "react";
import { Info } from "lucide-react";
import { snapshotStore } from "@/lib/dadosClient";

// Faixa que aparece no app publicado (Vercel) quando os dados vêm do snapshot e não do
// backend: diz de quando é o dado e o que não está nele. Na rede interna (backend no ar)
// nunca aparece.
export default function AvisoSnapshot() {
  const geradoEm = useSyncExternalStore(snapshotStore.subscribe, snapshotStore.getSnapshot);
  if (!geradoEm) return null;
  const quando = new Date(geradoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  return (
    <div className="mb-4 flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-[12px] text-muted-foreground">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <p>
        Dados do snapshot de <strong className="text-foreground">{quando}</strong>. Este endereço não acessa o
        banco: os números são atualizados quando um novo snapshot é publicado, e não aparecem nome completo,
        CPF, telefone, licenças por militar nem ofício/SEI de Finanças. Dentro da rede do CBMPE o sistema mostra
        os dados em tempo real.
      </p>
    </div>
  );
}
