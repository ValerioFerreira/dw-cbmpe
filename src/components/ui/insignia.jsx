import React from "react";
import { insigniaDaUnidade, BRASAO_CBMPE } from "@/lib/insignias";

// Insígnia da unidade, ao lado do nome no cabeçalho da página.
//
// Cai no brasão da corporação em dois casos: unidade que não tem insígnia
// própria (ver insignias.js) e falha de carregamento do arquivo. O segundo
// caso importa porque os PNG são servidos de public/ — se um deploy esquecer
// a pasta, o cabeçalho continua íntegro em vez de mostrar ícone quebrado.
export default function Insignia({ sigla, tamanho = 44, className = "" }) {
  const [src, setSrc] = React.useState(() => insigniaDaUnidade(sigla));

  React.useEffect(() => { setSrc(insigniaDaUnidade(sigla)); }, [sigla]);

  return (
    <img
      src={src}
      alt={sigla ? `Insígnia — ${sigla}` : "Brasão do CBMPE"}
      width={tamanho}
      height={tamanho}
      loading="lazy"
      onError={() => { if (src !== BRASAO_CBMPE) setSrc(BRASAO_CBMPE); }}
      className={`shrink-0 select-none object-contain ${className}`}
      style={{ width: tamanho, height: tamanho }}
    />
  );
}
