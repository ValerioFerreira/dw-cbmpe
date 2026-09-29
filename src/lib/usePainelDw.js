import { useEffect, useState } from "react";
import { fetchPainelDw } from "@/lib/dadosClient";

// Dados de um painel corporativo (DF, Vacinação, Ocorrências): começa com o
// JSON embutido e, se o backend alcançar o DW (app no CapRover com login
// SGU), troca pelo do DW — já recortado pelo perfil no servidor. Os useMemo
// das telas dependem do objeto devolvido, então recalculam sozinhos.
//
// Os painéis são pesados (Ocorrências tem dezenas de milhares de linhas):
// por isso cada um é buscado quando é aberto (`ativo`), não no carregamento
// inicial do app, e fica em cache enquanto a aba estiver aberta.
const cache = new Map();

export function usePainelDw(nome, embutido, ativo = true) {
  const [dados, setDados] = useState(() => cache.get(nome) || embutido);

  useEffect(() => {
    if (!ativo || cache.has(nome)) return undefined;
    let vivo = true;
    fetchPainelDw(nome).then((remoto) => {
      if (!remoto) return;
      cache.set(nome, remoto);
      if (vivo) setDados(remoto);
    });
    return () => { vivo = false; };
  }, [nome, ativo]);

  return cache.get(nome) || dados;
}
