// Provedor de dados globais da plataforma CBMPE BI
import React, { createContext, useContext, useEffect, useState } from "react";
import {
  fetchUnidades, fetchIndicadores, fetchDashboards, fetchAlertas, buildArvore,
  invalidarCacheOrganograma, fetchAtribuicoes, invalidarCacheAtribuicoes
} from "@/lib/cbmpe";

const CbmpeContext = createContext(null);

export function CbmpeProvider({ children }) {
  const [unidades, setUnidades] = useState([]);
  const [indicadores, setIndicadores] = useState([]);
  const [dashboards, setDashboards] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [atribuicoes, setAtribuicoes] = useState({});
  const [loading, setLoading] = useState(true);
  // LOB (Lei de Organização Básica) em exibição: "atual" ou "nova". Só
  // Administrador, Comandante e Subcomandante Geral podem trocar (ver
  // LobGuard.jsx, que volta a "atual" para os demais). Guardada no navegador.
  const [lob, setLobEstado] = useState(() => {
    try { return localStorage.getItem("cbmpe_lob") === "nova" ? "nova" : "atual"; } catch { return "atual"; }
  });
  const [recentes, setRecentes] = useState(() => {
    try { return JSON.parse(localStorage.getItem("cbmpe_recentes") || "[]"); }
    catch { return []; }
  });

  async function carregar(lobAlvo = lob) {
    setLoading(true);
    // Sempre busca a árvore de novo — importante pra recarregar() (chamada
    // depois de criar/editar/mover/excluir uma OME em /adm) não devolver o
    // organograma antigo que ficou em cache (ver src/lib/cbmpe.js).
    invalidarCacheOrganograma();
    invalidarCacheAtribuicoes();
    try {
      const [u, i, d, a, atr] = await Promise.all([
        fetchUnidades(lobAlvo), fetchIndicadores(lobAlvo), fetchDashboards(lobAlvo), fetchAlertas(lobAlvo), fetchAtribuicoes()
      ]);
      setUnidades(u);
      setIndicadores(i);
      setDashboards(d);
      setAlertas(a);
      setAtribuicoes(atr);
    } catch (e) {
      console.error("Falha ao carregar dados CBMPE", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  function setLob(novo) {
    const alvo = novo === "nova" ? "nova" : "atual";
    if (alvo === lob) return;
    try { localStorage.setItem("cbmpe_lob", alvo); } catch { /* sem armazenamento: vale só nesta sessão */ }
    setLobEstado(alvo);
    carregar(alvo);
  }

  const { raizes, porId } = buildArvore(unidades);

  function registrarRecente(id) {
    setRecentes((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, 6);
      localStorage.setItem("cbmpe_recentes", JSON.stringify(next));
      return next;
    });
  }

  return (
    <CbmpeContext.Provider value={{
      unidades, indicadores, dashboards, alertas, atribuicoes,
      raizes, porId, loading, recarregar: () => carregar(), lob, setLob,
      recentes, registrarRecente
    }}>
      {children}
    </CbmpeContext.Provider>
  );
}

export function useCbmpe() {
  const ctx = useContext(CbmpeContext);
  if (!ctx) throw new Error("useCbmpe deve ser usado dentro de CbmpeProvider");
  return ctx;
}