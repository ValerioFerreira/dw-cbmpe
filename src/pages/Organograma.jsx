import React, { useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Star, TrendingUp, Lock } from "lucide-react";
import { useCbmpe } from "@/lib/cbmpe-context";
import { useAcessoUsuario } from "@/lib/useAcessoUsuario";

// Layout do organograma — até 2026-09-23 isto era inteiramente hardcoded
// (listas fixas de sigla por quadro, replicando o protótipo de referência
// Power BI CBMPE - Organograma Interativo). Com a funcionalidade de
// organograma editável (/adm > Organograma), a estrutura abaixo do
// Comando/Subcomando Geral passa a ser CALCULADA a partir de `unidades`
// (nivel/parent_id, vindos do backend) — senão uma unidade criada/movida/
// renomeada pelo admin nunca apareceria aqui. Isso troca o agrupamento
// manual e curado que a DGA tinha (colunas "empilhadas" sem moldura pra
// DGP/DVP/DJD/DF/DAS/DTIC/DPLAG, moldura só para DLOG/DEIP) por uma regra
// genérica (nível 5 sem subordinada nenhuma → coluna empilhada; com
// subordinada → moldura), que reproduz o mesmo resultado visual pra quase
// todas as unidades — só a ORDEM exata de DPLAG dentro da coluna
// empilhada da DGA pode variar (documentado no relatório da
// funcionalidade).
const KPIS_ATALHO = ["Efetivo", "Viaturas", "Materiais", "Finanças"];

// Protótipo de níveis de acesso (ver @/lib/accessControl). Quando o usuário
// tem acesso PARCIAL (nível, sem acesso total), cada card ganha um indicador:
// - card SEM acesso: fica não-clicável e apagado (opacidade/saturação
//   reduzidas), com um cadeado no canto — superior direito na maioria, e
//   inferior direito nos cards de COMANDO GERAL e SUBCOMANDO GERAL (pedido de
//   2026-08-19).
// - card COM acesso: ganha uma borda amarela fina constante (o mesmo realce
//   que antes só aparecia no hover).
// acessoDe/acessoKpiDe devolvem "ok" | "no" | null (null = admin ou acesso
// total → sem indicadores, comportamento normal com hover).
const CADEADO_BLOQUEADO = "pointer-events-none opacity-50 saturate-[0.4]";

// Sombra leve no canto inferior direito de todos os cards, pro leve efeito 3D
// pedido em 2026-08-19.
const SOMBRA_CARD = "shadow-[2px_3px_5px_-2px_rgba(0,0,0,0.14)]";

// Cadeado no canto do card. `claro` usa tom branco (cards de fundo colorido);
// `posicao` = "top-right" (padrão) ou "bottom-right" (Comando/Subcomando).
function CadeadoOverlay({ claro = false, posicao = "top-right" }) {
  const canto = posicao === "bottom-right" ? "bottom-1 right-1.5" : "top-1 right-1.5";
  return (
    <span className={`pointer-events-none absolute ${canto} z-20`}>
      <Lock className={`h-4 w-4 ${claro ? "text-white" : "text-foreground/70"}`} />
    </span>
  );
}

// Divide uma lista em até `numColunas` colunas, o mais equilibrado possível,
// preservando a ordem — usado pra empilhar as unidades de nível 6 "folha"
// (sem subordinada própria) dentro do quadro de uma diretoria nível 4,
// mesmo efeito visual do antigo DGA_COLUNAS_EMPILHADAS.
function splitEmColunas(itens, numColunas) {
  if (itens.length === 0) return [];
  const porColuna = Math.ceil(itens.length / numColunas);
  const colunas = [];
  for (let i = 0; i < itens.length; i += porColuna) {
    colunas.push(itens.slice(i, i + porColuna));
  }
  return colunas;
}

const ordenarPorSigla = (a, b) => a.sigla.localeCompare(b.sigla, "pt-BR");

export default function Organograma() {
  const { unidades, indicadores, loading } = useCbmpe();
  const { restrito, acesso } = useAcessoUsuario();
  const navigate = useNavigate();

  const bySigla = useMemo(() => {
    const map = {};
    unidades.forEach((u) => { map[u.sigla] = u; });
    return map;
  }, [unidades]);

  // Estrutura calculada a partir da árvore ao vivo (ver cabeçalho do
  // arquivo) — nunca hardcoded por sigla.
  const estrutura = useMemo(() => {
    const filhosDe = (parentId) => unidades.filter((u) => u.parent_id === parentId);
    const comandoGeral = unidades.find((u) => u.nivel === 1) || null;
    // Nível 2 (Subcomando Geral) e nível 3 (Estado Maior, reservado — ainda
    // sem unidade) tratados igual: balão + subordinadas de nível 6 direto
    // "ao lado". Hoje só existe o nível 2.
    const demaisComando = unidades.filter((u) => u.nivel === 2 || u.nivel === 3).sort((a, b) => a.nivel - b.nivel);
    const diretoriasGerais = unidades.filter((u) => u.nivel === 4).sort(ordenarPorSigla);

    function aoLadoDe(unidade) {
      return filhosDe(unidade.id).filter((u) => u.nivel === 6).sort(ordenarPorSigla);
    }

    function gruposDaDiretoriaGeral(dg) {
      const nivel5 = filhosDe(dg.id).filter((u) => u.nivel === 5).sort(ordenarPorSigla);
      const comFilhos = [];
      const folhas = [];
      nivel5.forEach((u) => {
        const filhos = filhosDe(u.id).filter((f) => f.nivel === 6).sort(ordenarPorSigla);
        if (filhos.length > 0) comFilhos.push({ unidade: u, filhos });
        else folhas.push(u);
      });
      const colunasFolhas = splitEmColunas(folhas, 2);
      return { comFilhos, colunasFolhas };
    }

    return { comandoGeral, demaisComando, diretoriasGerais, aoLadoDe, gruposDaDiretoriaGeral };
  }, [unidades]);

  const kpisComandoGeral = useMemo(() => {
    const cg = estrutura.comandoGeral;
    if (!cg) return {};
    const mapa = {};
    indicadores.filter((i) => i.unidade_id === cg.id).forEach((i) => { mapa[i.nome] = i; });
    return mapa;
  }, [indicadores, estrutura.comandoGeral]);

  // Protótipo de níveis de acesso (2026-08-17, ver DW_PLANEJAMENTO.md e
  // @/lib/useAcessoUsuario): o login "adm" (role "admin") continua vendo o
  // organograma sem nenhuma restrição visual. Usuários de nível ("role"
  // nivel) veem tudo, mas só os cards liberados ficam clicáveis/destacados —
  // o resto fica com cor e contraste reduzidos, sem efeito de hover. A mesma
  // regra de acesso (calcularAcesso) também bloqueia a navegação direta nas
  // páginas de detalhe — ver useAcessoUsuario.
  const acessoDe = (sigla) => {
    if (!restrito || acesso.total) return null; // admin/total → sem indicadores
    return acesso.siglas.has(sigla) ? "ok" : "no";
  };
  const acessoKpiDe = (nome) => {
    if (!restrito || acesso.total) return null;
    return acesso.indicadores.has(nome) ? "ok" : "no";
  };

  // Banner "CBMPE - Geral" (topo) fica apagado quando o usuário de nível não
  // tem acesso ao topo da corporação (nem COMANDO GERAL, nem nenhum KPI do
  // topo) — ver pedido de 2026-08-18.
  const cbmpeBloqueado =
    restrito && !acesso.total &&
    !acesso.siglas.has("COMANDO GERAL") &&
    acesso.indicadores.size === 0;

  const goto = (sigla) => {
    const u = bySigla[sigla];
    if (u) navigate(`/diretoria/${u.id}`);
  };

  if (loading && unidades.length === 0) {
    return <div className="h-96 animate-pulse rounded-xl bg-muted/40" />;
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Sem min-width forçado: o organograma empilha naturalmente no mobile,
          igual à referência (index.html). O scroll horizontal só existe como
          rede de segurança para telas muito estreitas. */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card p-3 scrollbar-thin sm:p-6">
        <div className="mx-auto flex w-full max-w-[1520px] flex-col items-center gap-6 py-2 sm:gap-8">
          {/* ===== Comando Geral ===== */}
          {estrutura.comandoGeral && (
            <div className="flex w-full flex-col items-center">
              <div className={`relative w-full max-w-md rounded-xl rounded-b-none border-2 border-amber-300 bg-gradient-to-br from-amber-500 via-amber-600 to-orange-700 p-3 text-center shadow-[0_8px_30px_-6px_rgba(217,119,6,0.35)] ${cbmpeBloqueado ? "opacity-50 saturate-[0.4]" : ""}`}>
                <p className="text-base font-black uppercase tracking-wider text-white">CBMPE - Geral</p>
                {cbmpeBloqueado && <CadeadoOverlay claro />}
              </div>
              <div className="grid w-full max-w-md grid-cols-2 gap-2 rounded-xl rounded-t-none border border-t-0 border-border bg-background p-2 sm:grid-cols-4">
                {KPIS_ATALHO.map((nome) => {
                  const kpi = kpisComandoGeral[nome];
                  const ok = acessoKpiDe(nome);
                  const base = `relative flex min-h-[2.75rem] items-center justify-center rounded-lg border bg-card px-2 text-center text-xs font-bold text-foreground transition-colors ${SOMBRA_CARD}`;
                  if (ok === "no") {
                    return (
                      <span key={nome} className={`${base} border-border ${CADEADO_BLOQUEADO}`}>
                        {nome}
                        <CadeadoOverlay />
                      </span>
                    );
                  }
                  return (
                    <Link
                      key={nome}
                      to={kpi ? `/indicador/${kpi.id}` : "#"}
                      className={`${base} ${ok === "ok" ? "border-amber-400" : "border-border hover:border-amber-500"}`}
                    >
                      {nome}
                    </Link>
                  );
                })}
              </div>

              <NoEstrela unidade={estrutura.comandoGeral} tom="amber" onClick={() => goto(estrutura.comandoGeral.sigla)} acessoOk={acessoDe(estrutura.comandoGeral.sigla)} />

              <LinhaAssessorias
                unidades={estrutura.aoLadoDe(estrutura.comandoGeral)}
                goto={goto}
                gridCols="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
                maxWidth="max-w-2xl"
                accent="amber"
                acessoDe={acessoDe}
              />
            </div>
          )}

          {/* ===== Subcomando Geral / Estado Maior (nível 2 e 3) ===== */}
          {estrutura.demaisComando.map((unidade) => (
            <div key={unidade.id} className="flex w-full flex-col items-center">
              <NoEstrela unidade={unidade} tom="yellow" onClick={() => goto(unidade.sigla)} acessoOk={acessoDe(unidade.sigla)} />
              <LinhaAssessorias
                unidades={estrutura.aoLadoDe(unidade)}
                goto={goto}
                gridCols="grid-cols-3"
                maxWidth="max-w-md"
                accent="yellow"
                acessoDe={acessoDe}
              />
            </div>
          ))}

          {/* ===== Diretorias Gerais (nível 4) ===== */}
          <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
            {estrutura.diretoriasGerais.map((dg) => {
              const { comFilhos, colunasFolhas } = estrutura.gruposDaDiretoriaGeral(dg);
              return (
                <div key={dg.id} className="flex flex-col items-center rounded-2xl border border-border bg-background p-3 sm:p-4">
                  <CardDiretoria unidade={dg} onClick={() => goto(dg.sigla)} tamanho="lg" acessoOk={acessoDe(dg.sigla)} />
                  <div className="mt-4 grid w-full grid-cols-2 gap-3 lg:grid-cols-4">
                    {colunasFolhas.map((coluna, idx) => (
                      <ColunaEmpilhada key={`col-${idx}`} unidades={coluna} goto={goto} acessoDe={acessoDe} />
                    ))}
                    {comFilhos.map(({ unidade, filhos }) => (
                      <GrupoDiretoria key={unidade.id} unidade={unidade} filhos={filhos} goto={goto} acessoDe={acessoDe} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function NoEstrela({ unidade, tom, onClick, acessoOk }) {
  if (!unidade) return null;
  const isAmber = tom === "amber";
  const bloqueado = acessoOk === "no";
  return (
    <button
      onClick={bloqueado ? undefined : onClick}
      disabled={bloqueado}
      className={`relative z-10 mt-8 w-72 rounded-xl border-2 bg-gradient-to-br p-4 text-center transition-transform ${
        bloqueado ? CADEADO_BLOQUEADO : "hover:-translate-y-1 hover:scale-[1.02]"
      } ${
        isAmber
          ? "border-amber-300 from-amber-500 via-amber-600 to-orange-700 shadow-[0_8px_30px_-6px_rgba(217,119,6,0.35)]"
          : "border-yellow-300 from-yellow-500 via-yellow-600 to-amber-700 shadow-[0_8px_30px_-6px_rgba(202,138,4,0.35)]"
      }`}
    >
      <div className="flex items-center justify-center gap-2">
        <Star className={`h-4 w-4 fill-current ${isAmber ? "text-amber-200" : "text-yellow-200"}`} />
        <p className="whitespace-nowrap text-lg font-black uppercase tracking-wider text-white">{unidade.nome}</p>
        <Star className={`h-4 w-4 fill-current ${isAmber ? "text-amber-200" : "text-yellow-200"}`} />
      </div>
      <p className={`mt-0.5 text-[11px] tracking-widest ${isAmber ? "text-amber-200" : "text-yellow-200"}`}>{unidade.responsavel} - {unidade.cargo}</p>
      <div className={`mt-2 inline-flex items-center gap-1 rounded-full bg-black/20 px-3 py-1 text-[10px] font-semibold ${isAmber ? "text-amber-100" : "text-yellow-100"}`}>
        <TrendingUp className="h-3 w-3" /> Detalhar
      </div>
      {bloqueado && <CadeadoOverlay claro posicao="bottom-right" />}
    </button>
  );
}

// Unidades de nível 6 diretamente subordinadas ao Comando/Subcomando
// Geral/Estado Maior (nível 1-3) — ficam AO LADO do balão do pai, não
// abaixo dele numa fileira separada (pedido explícito do usuário,
// 2026-09-23, corrigindo o comportamento anterior).
function LinhaAssessorias({ unidades, goto, gridCols, maxWidth, accent, acessoDe }) {
  if (unidades.length === 0) return null;
  const hoverBorder = accent === "yellow" ? "hover:border-yellow-500" : "hover:border-amber-500";
  // Div de agrupamento: fundo igual ao body (#F5F5F5 = bg-background), 4
  // cantos arredondados e borda em cima e embaixo (antes só embaixo).
  return (
    <div className={`mt-3 grid w-full ${maxWidth} ${gridCols} gap-2 rounded-xl border border-border bg-background p-2`}>
      {unidades.map((u) => {
        const ok = acessoDe(u.sigla);
        const bloqueado = ok === "no";
        return (
          <button
            key={u.id}
            onClick={bloqueado ? undefined : () => goto(u.sigla)}
            disabled={bloqueado}
            className={`relative rounded-lg border bg-card p-2 text-center transition-colors ${SOMBRA_CARD} ${
              bloqueado ? `border-border ${CADEADO_BLOQUEADO}` : ok === "ok" ? "border-amber-400" : `border-border ${hoverBorder}`
            }`}
          >
            <p className="text-xs font-bold text-foreground">{u.sigla}</p>
            <p className="text-[9px] text-muted-foreground">{u.responsavel} - {u.cargo}</p>
            {bloqueado && <CadeadoOverlay />}
          </button>
        );
      })}
    </div>
  );
}

function CardDiretoria({ unidade, onClick, tamanho = "col", acessoOk }) {
  if (!unidade) return null;
  const isLg = tamanho === "lg";
  const bloqueado = acessoOk === "no";
  return (
    <button
      onClick={bloqueado ? undefined : onClick}
      disabled={bloqueado}
      className={`relative ${isLg ? "w-64 p-3" : "w-full p-2"} rounded-xl border-2 border-yellow-400 bg-yellow-600 text-center shadow-md transition-transform ${
        bloqueado ? CADEADO_BLOQUEADO : "hover:-translate-y-0.5"
      }`}
    >
      <p className={`font-black uppercase tracking-wider text-white ${isLg ? "text-base" : "text-xs"}`}>{unidade.sigla}</p>
      <p className={`text-yellow-100 ${isLg ? "mt-0.5 text-[10px] tracking-widest" : "text-[8px]"}`}>{unidade.responsavel} - {unidade.cargo}</p>
      {bloqueado && <CadeadoOverlay claro />}
    </button>
  );
}

// Unidades de nível 5 "folha" (sem subordinada própria) de uma Diretoria
// Geral, empilhadas sem moldura — mesmo efeito visual do antigo
// DGA_COLUNAS_EMPILHADAS, agora calculado (ver splitEmColunas).
function ColunaEmpilhada({ unidades, goto, acessoDe }) {
  return (
    <div className="space-y-2">
      {unidades.map((u) => (
        <CardDiretoria key={u.id} unidade={u} onClick={() => goto(u.sigla)} tamanho="col" acessoOk={acessoDe(u.sigla)} />
      ))}
    </div>
  );
}

function GrupoDiretoria({ unidade, filhos, goto, acessoDe }) {
  // Fundo um pouco mais escuro que o #F5F5F5 do container-pai, pra dar
  // contraste (pedido de 2026-08-19 — DIM, DINTER I/II, DLOG, DEIP).
  return (
    <div className="flex flex-col items-center rounded-xl border border-border bg-black/[0.05] p-2">
      <CardDiretoria unidade={unidade} onClick={() => goto(unidade.sigla)} tamanho="col" acessoOk={acessoDe(unidade.sigla)} />
      {filhos.length > 0 && (
        <div className="mt-2 w-full space-y-1.5">
          {filhos.map((f) => {
            const ok = acessoDe(f.sigla);
            const bloqueado = ok === "no";
            return (
              <button
                key={f.id}
                onClick={bloqueado ? undefined : () => goto(f.sigla)}
                disabled={bloqueado}
                className={`relative w-full rounded border bg-card p-1.5 text-center transition-colors ${SOMBRA_CARD} ${
                  bloqueado ? `border-border ${CADEADO_BLOQUEADO}` : ok === "ok" ? "border-amber-400" : "border-border hover:border-yellow-400"
                }`}
              >
                <p className="text-[10px] font-bold text-foreground">{f.sigla}</p>
                <p className="text-[7px] text-muted-foreground">{f.responsavel} - {f.cargo}</p>
                {bloqueado && <CadeadoOverlay />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
