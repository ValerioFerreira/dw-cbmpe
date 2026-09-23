import React from "react";
import { DatabaseZap } from "lucide-react";
import EmptyState from "@/components/ui/empty-state";

// Banner compartilhado pelos 9 módulos de Ocorrências enquanto
// src/data/real/ocorrencias_dashboard.json seguir vazio (bloqueado por
// credencial — ver etl/ocorrencias/extract_dashboard_ocorrencias.py e
// DW_CATALOGO_FONTES.md, seção Ocorrências). Extraído num componente
// próprio em vez de repetido em cada Modulo*.jsx porque o texto é idêntico
// nos 9 — só evita duplicação, não é um padrão novo de acesso.
export default function AguardandoCredencial() {
  return (
    <EmptyState
      icon={DatabaseZap}
      titulo="Aguardando credencial de roe_api_production"
      descricao="O extrator (etl/ocorrencias/extract_dashboard_ocorrencias.py) está pronto, mas nenhuma credencial em .env.local autentica em 10.193.1.252:15432 ainda. Os números desta aba aparecem assim que houver acesso — nada aqui é dado real ou inventado."
    />
  );
}
