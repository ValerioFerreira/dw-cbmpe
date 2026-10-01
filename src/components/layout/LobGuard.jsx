import { useEffect } from "react";
import { useCbmpe } from "@/lib/cbmpe-context";
import { useAcessoUsuario } from "@/lib/useAcessoUsuario";

// Quem não pode ver o seletor "LOB Atual/Nova" nunca fica na LOB Nova — mesmo que
// o navegador tenha guardado a escolha de outro usuário (ver cbmpe-context.jsx).
export default function LobGuard() {
  const { lob, setLob, loading } = useCbmpe();
  const { podeVerLob } = useAcessoUsuario();
  useEffect(() => {
    if (!loading && lob === "nova" && !podeVerLob) setLob("atual");
  }, [loading, lob, podeVerLob, setLob]);
  return null;
}
