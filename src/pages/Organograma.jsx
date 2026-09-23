import React, { useMemo, useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Star, TrendingUp, Lock, Pencil, Move, AlertTriangle, Check, X } from "lucide-react";
import { useCbmpe } from "@/lib/cbmpe-context";
import { useAcessoUsuario } from "@/lib/useAcessoUsuario";
import { atualizarUnidade } from "@/lib/organogramaClient";

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

// Ordem de exibição entre irmãos (mesmo parent_id) — ver `ordem` em
// src/data/organograma.js. Substituiu ordenarPorSigla em todo agrupamento
// estrutural em 2026-09-23: a ordenação alfabética embaralhava arranjos
// intencionais (DGO antes de DGA; DIM, DINTER I, DINTER II, DIESP nessa
// ordem) sempre que o admin editava o organograma. Sigla só entra como
// desempate — não deveria acontecer em uso normal (ordem é sempre única o
// bastante), mas evita empate instável se algum dia dois nós colidirem.
const ordenarPorOrdem = (a, b) => (a.ordem ?? 0) - (b.ordem ?? 0) || ordenarPorSigla(a, b);

// Arrastar-e-soltar do organograma (admin) — 2026-09-23.
//
// Regra única pra decidir o que um drop significa, sem precisar de zonas de
// drop diferentes por tipo de card: se o nível da unidade arrastada É
// compatível como FILHA do card onde ela caiu (mesma regra de
// backend/services/organogramaService.js > validarRelacaoNivel), o drop
// REPARENTEIA (unidade arrastada vira filha do card-alvo, vai pro fim do
// grupo). Senão, o drop REORDENA (unidade arrastada vira irmã do card-alvo,
// no mesmo pai dele, logo depois dele). O backend sempre revalida a
// operação (mesma regra) — se a heurística abaixo escolher errado (ex.:
// nível incompatível com o pai calculado), a pior consequência é um drop
// rejeitado com mensagem de erro, nunca dado corrompido.
//
// `ordem` novo é sempre a MÉDIA entre o vizinho anterior e o de depois (ou
// vizinho+10 se não houver próximo) — nunca precisa renumerar o resto do
// grupo pra abrir espaço (ver espaçamento de 10 em 10 no dado de origem).
function nivelCompativelComoFilho(nivelArrastado, pai) {
  if (nivelArrastado === 5) return pai.nivel === 4;
  if (nivelArrastado === 6) return pai.nivel === 5 || pai.nivel <= 3;
  if (nivelArrastado === 4) return pai.nivel === 2 || pai.nivel === 3;
  return false;
}

function useArrastarOrganograma({ podeEditar, token, unidades, recarregar }) {
  const [arrastandoId, setArrastandoId] = useState(null);
  const [sobreId, setSobreId] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState(null); // { tipo: "erro" | "ok", texto }
  // Log da sessão de edição atual — cada drop bem-sucedido some empilhado
  // aqui, pra virar o resumo do balão de confirmação quando o admin sai do
  // modo de edição (ver alternarModoEdicao no componente principal). Cada
  // drop já persiste na hora (não é um lote pendente) — isto é só o
  // registro do que já foi salvo, pra mostrar de uma vez no final.
  const [alteracoes, setAlteracoes] = useState([]);

  const iniciar = useCallback((e, unidade) => {
    if (!podeEditar || ocupado || unidade.nivel <= 3) { e.preventDefault(); return; }
    setArrastandoId(unidade.id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", unidade.id);
  }, [podeEditar, ocupado]);

  const terminar = useCallback(() => {
    setArrastandoId(null);
    setSobreId(null);
  }, []);

  const sobre = useCallback((e, unidade) => {
    if (!arrastandoId || arrastandoId === unidade.id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setSobreId(unidade.id);
  }, [arrastandoId]);

  const saiDeCima = useCallback((unidade) => {
    setSobreId((atual) => (atual === unidade.id ? null : atual));
  }, []);

  const soltar = useCallback(async (e, alvo) => {
    e.preventDefault();
    e.stopPropagation();
    const idArrastado = arrastandoId;
    setSobreId(null);
    setArrastandoId(null);
    if (!idArrastado || idArrastado === alvo.id || ocupado) return;
    const arrastada = unidades.find((u) => u.id === idArrastado);
    if (!arrastada) return;

    const comoFilho = nivelCompativelComoFilho(arrastada.nivel, alvo);
    const novoParentId = comoFilho ? alvo.id : alvo.parent_id;
    // Só acontece se o alvo for COMANDO GERAL (sem pai) e o nível arrastado
    // não puder ficar diretamente sob ele — não há "irmão de COMANDO GERAL"
    // pra reordenar. Mensagem própria em vez de mandar parentId nulo pro
    // backend.
    if (!comoFilho && novoParentId === null) {
      setAviso({ tipo: "erro", texto: `Nível de "${arrastada.sigla}" não pode ficar diretamente sob "${alvo.sigla}".` });
      window.setTimeout(() => setAviso(null), 4000);
      return;
    }

    let novaOrdem;
    if (comoFilho) {
      const irmaos = unidades.filter((u) => u.parent_id === novoParentId && u.id !== idArrastado);
      novaOrdem = irmaos.length ? Math.max(...irmaos.map((u) => u.ordem ?? 0)) + 10 : 10;
    } else {
      const irmaos = unidades
        .filter((u) => u.parent_id === novoParentId && u.id !== idArrastado)
        .sort(ordenarPorOrdem);
      const idxAlvo = irmaos.findIndex((u) => u.id === alvo.id);
      const alvoOrdem = alvo.ordem ?? 0;
      const proximo = irmaos[idxAlvo + 1];
      novaOrdem = proximo ? (alvoOrdem + (proximo.ordem ?? alvoOrdem + 20)) / 2 : alvoOrdem + 10;
    }

    const payload = { ordem: novaOrdem };
    if (novoParentId !== arrastada.parent_id) payload.parentId = novoParentId;

    setOcupado(true);
    try {
      await atualizarUnidade(idArrastado, payload, token);
      await recarregar();
      const texto = comoFilho
        ? `"${arrastada.sigla}" movida para dentro de "${alvo.sigla}"`
        : `"${arrastada.sigla}" reposicionada ao lado de "${alvo.sigla}"`;
      setAviso({ tipo: "ok", texto: `${texto}.` });
      setAlteracoes((lista) => [...lista, texto]);
    } catch (erro) {
      setAviso({ tipo: "erro", texto: erro.message });
    } finally {
      setOcupado(false);
      window.setTimeout(() => setAviso(null), 4000);
    }
  }, [arrastandoId, ocupado, unidades, token, recarregar]);

  const limparAviso = useCallback(() => setAviso(null), []);
  const limparAlteracoes = useCallback(() => setAlteracoes([]), []);

  // Props a espalhar num card pra torná-lo arrastável/soltável — nível<=3
  // nunca é arrastável (fixo), mas continua podendo RECEBER um drop.
  const propsDoCard = useCallback((unidade) => {
    if (!podeEditar) return {};
    const arrastavel = unidade.nivel > 3 && !ocupado;
    const destacado = !!arrastandoId && arrastandoId !== unidade.id && sobreId === unidade.id;
    const classes = [
      arrastavel ? "cursor-grab active:cursor-grabbing" : "",
      arrastandoId === unidade.id ? "opacity-40" : "",
      destacado ? "ring-2 ring-primary ring-offset-1" : "",
    ].filter(Boolean).join(" ");
    return {
      draggable: arrastavel,
      onDragStart: (e) => iniciar(e, unidade),
      onDragEnd: terminar,
      onDragOver: (e) => sobre(e, unidade),
      onDragLeave: () => saiDeCima(unidade),
      onDrop: (e) => soltar(e, unidade),
      dragClasses: classes,
    };
  }, [podeEditar, ocupado, arrastandoId, sobreId, iniciar, terminar, sobre, saiDeCima, soltar]);

  return { podeEditar, ocupado, aviso, limparAviso, alteracoes, limparAlteracoes, propsDoCard };
}

export default function Organograma() {
  const { unidades, indicadores, loading, recarregar } = useCbmpe();
  const { restrito, acesso, tokenAdmin } = useAcessoUsuario();
  const navigate = useNavigate();

  // Modo de edição: o arrastar-e-soltar só fica habilitado depois que o
  // admin liga explicitamente pelo botão de lápis no canto do organograma
  // (pedido de 2026-09-23) — antes ficava sempre ligado pra quem tinha
  // token, o que deixava qualquer card "puxável" sem aviso nenhum de que
  // estava em modo de edição.
  const [modoEdicao, setModoEdicao] = useState(false);
  const [resumoSalvo, setResumoSalvo] = useState(null); // { itens: string[] } | null
  const drag = useArrastarOrganograma({ podeEditar: !!tokenAdmin && modoEdicao, token: tokenAdmin, unidades, recarregar });

  // Clicar de novo desliga o modo de edição — é o momento de "salvar": cada
  // arrastar já persistiu na hora (ver useArrastarOrganograma), então não há
  // nada pendente pra de fato gravar aqui; "salvar" é sair do modo de
  // edição e mostrar o resumo do que já foi gravado durante a sessão.
  function alternarModoEdicao() {
    if (modoEdicao && drag.alteracoes.length > 0) {
      setResumoSalvo({ itens: [...drag.alteracoes] });
      drag.limparAlteracoes();
    }
    setModoEdicao((v) => !v);
  }

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
    const diretoriasGerais = unidades.filter((u) => u.nivel === 4).sort(ordenarPorOrdem);

    function aoLadoDe(unidade) {
      return filhosDe(unidade.id).filter((u) => u.nivel === 6).sort(ordenarPorOrdem);
    }

    // Colunas da Diretoria Geral: unidades nível 5 COM subordinada própria
    // primeiro (uma coluna cada, na ordem de `ordem` — é o que garante DIM,
    // DINTER I, DINTER II antes de DIESP na DGO), depois as "folha" (sem
    // subordinada) TODAS JUNTAS num bloco compacto (splitEmColunas em até 2
    // sub-colunas, ordenadas entre si por `ordem`).
    //
    // Até 2026-09-23 isto respeitava a ordem intercalada estrita (ver
    // histórico do arquivo) — quebrava a DGA: como DPLAG (folha) vem DEPOIS
    // de DLOG/DEIP (com subordinada) na ordem, virava um pacote de 1 item
    // sozinho no fim da lista de colunas; numa grade de 4 colunas isso
    // jogava o pacote pra uma 5ª posição, que quebra linha sozinha —
    // exatamente o "afastada, como se tivesse uma linha invisível acima"
    // reportado. Juntar as folhas sempre no mesmo bloco evita qualquer
    // pacote de 1 item isolado, sem violar a ordem pedida pra DGO (lá só
    // existe UMA folha — DIESP —, que já cai naturalmente por último).
    function gruposDaDiretoriaGeral(dg) {
      const nivel5 = filhosDe(dg.id).filter((u) => u.nivel === 5).sort(ordenarPorOrdem);
      const comFilhos = [];
      const folhas = [];
      nivel5.forEach((u) => {
        const filhos = filhosDe(u.id).filter((f) => f.nivel === 6).sort(ordenarPorOrdem);
        if (filhos.length > 0) comFilhos.push({ unidade: u, filhos });
        else folhas.push(u);
      });
      const colunas = comFilhos.map(({ unidade, filhos }) => ({ tipo: "grupo", unidade, filhos }));
      splitEmColunas(folhas, 2).forEach((pacote) => colunas.push({ tipo: "pacote", unidades: pacote }));
      return colunas;
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
    <div className="space-y-3 animate-fade-in">
      {modoEdicao && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3.5 py-2 text-[12px] text-foreground">
          <Move className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span>Modo de edição: arraste uma unidade sobre outra pra reordenar, ou sobre um balão/quadro pra mudar de subordinação. Cada alteração é salva na hora.</span>
        </div>
      )}
      {drag.aviso && (
        <div className={`flex items-center gap-2 rounded-lg border px-3.5 py-2 text-[12px] ${
          drag.aviso.tipo === "erro" ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-primary/30 bg-primary/5 text-foreground"
        }`}>
          {drag.aviso.tipo === "erro" ? <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> : <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
          <span className="flex-1">{drag.aviso.texto}</span>
          <button onClick={drag.limparAviso} className="text-muted-foreground hover:text-foreground">×</button>
        </div>
      )}
      {/* Balão de confirmação ao sair do modo de edição (pedido de
          2026-09-23) — resume tudo que foi arrastado e já salvo durante a
          sessão. Fica até o admin fechar, sem timeout automático: é o
          registro final da edição, diferente do aviso individual acima
          (que já some sozinho). */}
      {resumoSalvo && (
        <div className="flex items-start gap-2.5 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-[12px] text-foreground">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="flex-1 space-y-1">
            <p className="font-semibold text-primary">
              {resumoSalvo.itens.length === 1 ? "1 alteração salva" : `${resumoSalvo.itens.length} alterações salvas`}
            </p>
            <ul className="space-y-0.5 text-muted-foreground">
              {resumoSalvo.itens.map((texto, idx) => (
                <li key={idx}>• {texto}.</li>
              ))}
            </ul>
          </div>
          <button onClick={() => setResumoSalvo(null)} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {/* Sem min-width forçado: o organograma empilha naturalmente no mobile,
          igual à referência (index.html). O scroll horizontal só existe como
          rede de segurança para telas muito estreitas. */}
      <div className="relative overflow-x-auto rounded-xl border border-border bg-card p-3 scrollbar-thin sm:p-6">
        {!!tokenAdmin && (
          <button
            onClick={alternarModoEdicao}
            title={modoEdicao ? "Sair do modo de edição" : "Editar organograma"}
            className={`absolute right-3 top-3 z-30 inline-flex h-9 w-9 items-center justify-center rounded-full border shadow-sm transition-colors ${
              modoEdicao
                ? "border-primary bg-primary text-primary-foreground hover:opacity-90"
                : "border-border bg-card text-muted-foreground hover:border-primary hover:text-primary"
            }`}
          >
            {modoEdicao ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
          </button>
        )}
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

              {/* Balão + subordinadas de nível 6 diretas: o balão continua
                  CENTRALIZADO na página (grid 1fr/auto/auto com a 1ª coluna
                  vazia do mesmo tamanho da 3ª — pedido de 2026-09-23), e são
                  as subordinadas que se deslocam pra direita, não o balão.
                  Empilha centralizado em telas estreitas. */}
              <div className="mt-8 grid w-full grid-cols-1 items-center justify-items-center gap-4 lg:grid-cols-[1fr_auto_1fr] lg:gap-6">
                <div className="hidden lg:block" aria-hidden="true" />
                <NoEstrela unidade={estrutura.comandoGeral} tom="amber" onClick={() => goto(estrutura.comandoGeral.sigla)} acessoOk={acessoDe(estrutura.comandoGeral.sigla)} drag={drag} />
                {/* min-w-0: sem isso, a coluna 3 (grid "1fr") cresce pra
                    caber o conteúdo do painel inteiro, e a 1ª coluna (vazia)
                    encolhe pra 0 — quebrando a simetria que centraliza o
                    balão. Com min-w-0 as duas colunas 1fr ficam realmente
                    iguais; se o painel não couber, ele estoura visualmente
                    pra direita (mesma rede de segurança de overflow-x-auto
                    do container do organograma). */}
                <div className="lg:min-w-0 lg:justify-self-start">
                  <LinhaAssessorias unidades={estrutura.aoLadoDe(estrutura.comandoGeral)} goto={goto} accent="amber" acessoDe={acessoDe} drag={drag} />
                </div>
              </div>
            </div>
          )}

          {/* ===== Subcomando Geral / Estado Maior (nível 2 e 3) ===== */}
          {estrutura.demaisComando.map((unidade) => (
            <div key={unidade.id} className="grid w-full grid-cols-1 items-center justify-items-center gap-4 lg:grid-cols-[1fr_auto_1fr] lg:gap-6">
              <div className="hidden lg:block" aria-hidden="true" />
              <NoEstrela unidade={unidade} tom="yellow" onClick={() => goto(unidade.sigla)} acessoOk={acessoDe(unidade.sigla)} drag={drag} />
              <div className="lg:min-w-0 lg:justify-self-start">
                <LinhaAssessorias unidades={estrutura.aoLadoDe(unidade)} goto={goto} accent="yellow" acessoDe={acessoDe} drag={drag} />
              </div>
            </div>
          ))}

          {/* ===== Diretorias Gerais (nível 4) ===== */}
          <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
            {estrutura.diretoriasGerais.map((dg) => {
              const colunas = estrutura.gruposDaDiretoriaGeral(dg);
              return (
                <div key={dg.id} className="flex flex-col items-center rounded-2xl border border-border bg-background p-3 sm:p-4">
                  <CardDiretoria unidade={dg} onClick={() => goto(dg.sigla)} tamanho="lg" acessoOk={acessoDe(dg.sigla)} drag={drag} />
                  <div className="mt-4 grid w-full grid-cols-2 gap-3 lg:grid-cols-4">
                    {colunas.map((coluna, idx) =>
                      coluna.tipo === "pacote" ? (
                        <ColunaEmpilhada key={`col-${idx}`} unidades={coluna.unidades} goto={goto} acessoDe={acessoDe} drag={drag} />
                      ) : (
                        <GrupoDiretoria key={coluna.unidade.id} unidade={coluna.unidade} filhos={coluna.filhos} goto={goto} acessoDe={acessoDe} drag={drag} />
                      )
                    )}
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

function NoEstrela({ unidade, tom, onClick, acessoOk, drag }) {
  if (!unidade) return null;
  const isAmber = tom === "amber";
  const bloqueado = acessoOk === "no";
  // Nível 1-3 nunca é arrastável (ver useArrastarOrganograma), mas continua
  // podendo RECEBER um drop — é assim que uma unidade nível 6 "ao lado" pode
  // ser movida pra Comando/Subcomando via arrastar-e-soltar.
  const { dragClasses, ...dragProps } = drag?.propsDoCard(unidade) || {};
  return (
    <button
      onClick={bloqueado ? undefined : onClick}
      disabled={bloqueado}
      {...dragProps}
      className={`relative z-10 w-72 shrink-0 rounded-xl border-2 bg-gradient-to-br p-4 text-center transition-transform ${
        bloqueado ? CADEADO_BLOQUEADO : "hover:-translate-y-1 hover:scale-[1.02]"
      } ${
        isAmber
          ? "border-amber-300 from-amber-500 via-amber-600 to-orange-700 shadow-[0_8px_30px_-6px_rgba(217,119,6,0.35)]"
          : "border-yellow-300 from-yellow-500 via-yellow-600 to-amber-700 shadow-[0_8px_30px_-6px_rgba(202,138,4,0.35)]"
      } ${dragClasses || ""}`}
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
// Geral/Estado Maior (nível 1-3) — ficam AO LADO do balão do pai (mesmo
// quadro 2 colunas de sempre), não abaixo dele numa fileira separada
// (pedido explícito do usuário, 2026-09-23).
function LinhaAssessorias({ unidades, goto, accent, acessoDe, drag }) {
  if (unidades.length === 0) return null;
  const hoverBorder = accent === "yellow" ? "hover:border-yellow-500" : "hover:border-amber-500";
  // Div de agrupamento: fundo igual ao body (#F5F5F5 = bg-background), 4
  // cantos arredondados e borda em cima e embaixo (antes só embaixo). Uma
  // única LINHA sem quebra a partir de `lg` (pedido de 2026-09-23,
  // corrigindo o grid de 2 colunas que empilhava em várias linhas/colunas
  // no desktop) — no mobile continua podendo quebrar linha (`flex-wrap`),
  // senão viraria uma fileira ilegível estourando pros dois lados da tela.
  return (
    <div className="flex max-w-[280px] shrink-0 flex-wrap justify-center gap-2 rounded-xl border border-border bg-background p-2 sm:max-w-sm lg:max-w-none lg:flex-nowrap lg:justify-start">
      {unidades.map((u) => {
        const ok = acessoDe(u.sigla);
        const bloqueado = ok === "no";
        const { dragClasses, ...dragProps } = drag?.propsDoCard(u) || {};
        return (
          <button
            key={u.id}
            onClick={bloqueado ? undefined : () => goto(u.sigla)}
            disabled={bloqueado}
            {...dragProps}
            className={`relative w-24 shrink-0 rounded-lg border bg-card p-2 text-center transition-colors sm:w-28 ${SOMBRA_CARD} ${
              bloqueado ? `border-border ${CADEADO_BLOQUEADO}` : ok === "ok" ? "border-amber-400" : `border-border ${hoverBorder}`
            } ${dragClasses || ""}`}
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

function CardDiretoria({ unidade, onClick, tamanho = "col", acessoOk, drag }) {
  if (!unidade) return null;
  const isLg = tamanho === "lg";
  const bloqueado = acessoOk === "no";
  const { dragClasses, ...dragProps } = drag?.propsDoCard(unidade) || {};
  return (
    <button
      onClick={bloqueado ? undefined : onClick}
      disabled={bloqueado}
      {...dragProps}
      className={`relative ${isLg ? "w-64 p-3" : "w-full p-2"} rounded-xl border-2 border-yellow-400 bg-yellow-600 text-center shadow-md transition-transform ${
        bloqueado ? CADEADO_BLOQUEADO : "hover:-translate-y-0.5"
      } ${dragClasses || ""}`}
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
function ColunaEmpilhada({ unidades, goto, acessoDe, drag }) {
  return (
    <div className="space-y-2">
      {unidades.map((u) => (
        <CardDiretoria key={u.id} unidade={u} onClick={() => goto(u.sigla)} tamanho="col" acessoOk={acessoDe(u.sigla)} drag={drag} />
      ))}
    </div>
  );
}

function GrupoDiretoria({ unidade, filhos, goto, acessoDe, drag }) {
  // Fundo um pouco mais escuro que o #F5F5F5 do container-pai, pra dar
  // contraste (pedido de 2026-08-19 — DIM, DINTER I/II, DLOG, DEIP).
  return (
    <div className="flex flex-col items-center rounded-xl border border-border bg-black/[0.05] p-2">
      <CardDiretoria unidade={unidade} onClick={() => goto(unidade.sigla)} tamanho="col" acessoOk={acessoDe(unidade.sigla)} drag={drag} />
      {filhos.length > 0 && (
        <div className="mt-2 w-full space-y-1.5">
          {filhos.map((f) => {
            const ok = acessoDe(f.sigla);
            const bloqueado = ok === "no";
            const { dragClasses, ...dragProps } = drag?.propsDoCard(f) || {};
            return (
              <button
                key={f.id}
                onClick={bloqueado ? undefined : () => goto(f.sigla)}
                disabled={bloqueado}
                {...dragProps}
                className={`relative w-full rounded border bg-card p-1.5 text-center transition-colors ${SOMBRA_CARD} ${
                  bloqueado ? `border-border ${CADEADO_BLOQUEADO}` : ok === "ok" ? "border-amber-400" : "border-border hover:border-yellow-400"
                } ${dragClasses || ""}`}
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
