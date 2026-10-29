import React, { useMemo, useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Star, TrendingUp, Lock, Pencil, Move, AlertTriangle, Check, X, Flame } from "lucide-react";
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
const ATALHOS_CORPORACAO = [
  { nome: "Mapa de Força", rota: "/mapa-forca/geral" },
  { nome: "Ocorrências", rota: "/ocorrencias/geral" },
];

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

// Traço de inserção durante o arrastar-e-soltar (pedido de 2026-09-25) —
// mostra em qual borda exata do card a unidade arrastada vai entrar, em vez
// de sempre "depois" sem indicação nenhuma. `lado` vem de
// useArrastarOrganograma > propsDoCard; o card que o usa precisa ser
// `relative` (todos já são).
function TracoInsercao({ lado }) {
  if (!lado) return null;
  return (
    <span
      className={`pointer-events-none absolute inset-y-0.5 z-30 w-[3px] rounded-full bg-primary shadow-[0_0_6px_rgba(0,0,0,0.25)] ${
        lado === "antes" ? "-left-1" : "-right-1"
      }`}
    />
  );
}

// "Chefe - cargo" de um card. Desde 2026-09-25 nunca é cortado (antes era
// truncate nas colunas estreitas): o nome e o cargo são dois blocos
// indivisíveis (whitespace-nowrap cada), e a ÚNICA quebra permitida é entre
// eles — numa linha só quando há espaço, "nome -" / "cargo" em duas quando
// a coluna encolhe (ver GrupoDiretoria/ColunaEmpilhada, flex-1 basis-0).
function ChefeCargo({ unidade, className }) {
  if (!unidade.responsavel && !unidade.cargo) return null;
  return (
    <p className={className}>
      <span className="whitespace-nowrap">{unidade.responsavel}{unidade.cargo ? " -" : ""}</span>
      {unidade.cargo && <> <span className="whitespace-nowrap">{unidade.cargo}</span></>}
    </p>
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
// Regra generalizada (2026-09-25, ver validarRelacaoNivel no backend):
// qualquer unidade arrastável (nível 4-6) pode virar filha de QUALQUER
// unidade de nível hierarquicamente superior (nível menor), não só do nível
// imediatamente acima.
function nivelCompativelComoFilho(nivelArrastado, pai) {
  if (nivelArrastado < 4 || nivelArrastado > 6) return false;
  return pai.nivel < nivelArrastado;
}

function useArrastarOrganograma({ podeEditar, token, unidades, recarregar }) {
  const [arrastandoId, setArrastandoId] = useState(null);
  const [sobreId, setSobreId] = useState(null);
  // Lado do card sobrevoado onde a unidade arrastada vai entrar — calculado
  // pela posição do cursor (metade esquerda/direita do card, ver `sobre`).
  // Pedido de 2026-09-25: antes o drop sempre inserida DEPOIS do alvo (só
  // dava pra empurrar pra direita); agora o lado decide se entra antes ou
  // depois, e o traço em `indicadorPara` mostra onde exatamente.
  const [ladoAlvo, setLadoAlvo] = useState("depois");
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
    const rect = e.currentTarget.getBoundingClientRect();
    const lado = (e.clientX - rect.left) < rect.width / 2 ? "antes" : "depois";
    setSobreId(unidade.id);
    setLadoAlvo(lado);
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
      // Antes/depois do alvo, pelo lado calculado em `sobre` — é o que
      // permite soltar GSG à ESQUERDA de CI (virar o primeiro da linha), não
      // só sempre depois dele.
      const irmaos = unidades
        .filter((u) => u.parent_id === novoParentId && u.id !== idArrastado)
        .sort(ordenarPorOrdem);
      const idxAlvo = irmaos.findIndex((u) => u.id === alvo.id);
      const alvoOrdem = alvo.ordem ?? 0;
      if (ladoAlvo === "antes") {
        const anterior = irmaos[idxAlvo - 1];
        const anteriorOrdem = anterior ? (anterior.ordem ?? alvoOrdem - 20) : alvoOrdem - 20;
        novaOrdem = (anteriorOrdem + alvoOrdem) / 2;
      } else {
        const proximo = irmaos[idxAlvo + 1];
        novaOrdem = proximo ? (alvoOrdem + (proximo.ordem ?? alvoOrdem + 20)) / 2 : alvoOrdem + 10;
      }
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
  }, [arrastandoId, ocupado, unidades, token, recarregar, ladoAlvo]);

  const limparAviso = useCallback(() => setAviso(null), []);
  const limparAlteracoes = useCallback(() => setAlteracoes([]), []);

  // Props a espalhar num card pra torná-lo arrastável/soltável — nível<=3
  // nunca é arrastável (fixo), mas continua podendo RECEBER um drop.
  // `lado` ("antes" | "depois" | null): qual borda do card mostra o traço
  // de inserção — ver `sobre` (calculado pela metade esquerda/direita do
  // card sob o cursor) e `indicadorPara` abaixo, usado pelos componentes de
  // card pra desenhar a barrinha.
  const propsDoCard = useCallback((unidade) => {
    if (!podeEditar) return {};
    const arrastavel = unidade.nivel > 3 && !ocupado;
    const destacado = !!arrastandoId && arrastandoId !== unidade.id && sobreId === unidade.id;
    const classes = [
      arrastavel ? "cursor-grab active:cursor-grabbing" : "",
      arrastandoId === unidade.id ? "opacity-40" : "",
    ].filter(Boolean).join(" ");
    return {
      draggable: arrastavel,
      onDragStart: (e) => iniciar(e, unidade),
      onDragEnd: terminar,
      onDragOver: (e) => sobre(e, unidade),
      onDragLeave: () => saiDeCima(unidade),
      onDrop: (e) => soltar(e, unidade),
      dragClasses: classes,
      lado: destacado ? ladoAlvo : null,
    };
  }, [podeEditar, ocupado, arrastandoId, sobreId, ladoAlvo, iniciar, terminar, sobre, saiDeCima, soltar]);

  return { podeEditar, ocupado, aviso, limparAviso, alteracoes, limparAlteracoes, propsDoCard };
}

export default function Organograma() {
  const { unidades, indicadores, loading, recarregar, lob, setLob } = useCbmpe();
  const { restrito, acesso, tokenAdmin, podeVerLob } = useAcessoUsuario();
  const navigate = useNavigate();

  // Modo de edição: o arrastar-e-soltar só fica habilitado depois que o
  // admin liga explicitamente pelo botão de lápis no canto do organograma
  // (pedido de 2026-09-23) — antes ficava sempre ligado pra quem tinha
  // token, o que deixava qualquer card "puxável" sem aviso nenhum de que
  // estava em modo de edição.
  const [modoEdicao, setModoEdicao] = useState(false);
  const [resumoSalvo, setResumoSalvo] = useState(null); // { itens: string[] } | null
  const drag = useArrastarOrganograma({ podeEditar: !!tokenAdmin && modoEdicao && lob === "atual", token: tokenAdmin, unidades, recarregar });

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
    const filhosDe = (parentId) => unidades.filter((u) => u.parent_id === parentId && !u.oculto);
    const comandoGeral = unidades.find((u) => u.nivel === 1) || null;
    const subcomandoGeral = unidades.find((u) => u.nivel === 2) || null;
    // Estado-Maior Geral (nível 3) — desde 2026-09-25 renderizado como uma
    // "diretoria" (balão + body cinza próprio com as 3 subordinadas fixas,
    // ver EstadoMaiorBox), posicionado à ESQUERDA do balão do Subcomando
    // Geral, na mesma linha/altura — não é mais um balão-estrela como
    // Comando/Subcomando (esses dois continuam os ÚNICOS cards de tamanho
    // diferenciado, pedido explícito do usuário).
    const estadoMaior = unidades.find((u) => u.nivel === 3) || null;
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
      // Nível 5, mais as unidades de nível 6 penduradas direto na diretoria geral
      // (LOB Nova: AJG sob a DGA) — entram como "folhas". Para o Subcomando Geral (nível 2) só
      // entram as de nível 5: as de nível 6 dele ficam ao lado do balão.
      const nivel5 = filhosDe(dg.id).filter((u) => u.nivel === 5 || (u.nivel === 6 && dg.nivel === 4)).sort(ordenarPorOrdem);
      const comFilhos = [];
      const folhas = [];
      nivel5.forEach((u) => {
        const filhos = u.nivel === 5 ? filhosDe(u.id).filter((f) => f.nivel === 6).sort(ordenarPorOrdem) : [];
        if (filhos.length > 0) comFilhos.push({ unidade: u, filhos });
        else folhas.push(u);
      });
      const netosDe = (id) => filhosDe(id).sort(ordenarPorOrdem);
      // Grupo com `abaixoDe` (LOB Nova: DGP sob a DAL) vai na MESMA coluna do grupo
      // indicado, empilhado embaixo dele.
      const colunas = [];
      comFilhos.forEach(({ unidade, filhos }) => {
        const grupo = { tipo: "grupo", unidade, filhos, netosDe };
        const alvo = unidade.abaixoDe && colunas.find((c) => c.grupos?.some((g) => g.unidade.id === unidade.abaixoDe));
        if (alvo) alvo.grupos.push(grupo);
        else colunas.push({ tipo: "pilha", grupos: [grupo] });
      });
      // Folhas de nível 5 (diretorias) numa coluna; folhas de nível 6 (assessorias) em outra.
      // Grade de até 4 colunas: DGO nova = DIM, DINTER I, DINTER II, DINTER III (com 1º GB, 7º GB e CAT/ZM) + DIESP;
      // DGA nova = DECI, DAL/DGP, DF/DTIC/DVP/DAS e só a AJG.
      const folhas5 = folhas.filter((u) => u.nivel === 5);
      const folhas6 = folhas.filter((u) => u.nivel === 6);
      // DGO (LOB Nova): DINTER III e DIESP cada uma na sua coluna, ao lado de DIM/DINTER I/
      // DINTER II — 5 colunas, nenhuma diretoria embaixo da outra. Na LOB Atual a DGO só tem
      // a DIESP como folha, então continua com uma coluna.
      const livres = dg.sigla === "DGO"
        ? Math.max(1, folhas5.length)
        : Math.max(1, Math.min(2, 4 - colunas.length - (folhas6.length ? 1 : 0)));
      splitEmColunas(folhas5, livres).forEach((pacote) => colunas.push({ tipo: "pacote", unidades: pacote }));
      if (folhas6.length) colunas.push({ tipo: "pacote", unidades: folhas6, netosDe });
      return colunas;
    }

    // LOB Atual: com a DGA extinta, as subordinadas dela são filhas de nível 5 do Subcomando
    // Geral. Saem na linha das diretorias, ao lado da DGO, com as mesmas colunas de antes
    // mas sem o quadro nem o card da DGA.
    const colunasSoltas = subcomandoGeral && filhosDe(subcomandoGeral.id).some((u) => u.nivel === 5)
      ? gruposDaDiretoriaGeral(subcomandoGeral)
      : [];

    return { comandoGeral, subcomandoGeral, estadoMaior, diretoriasGerais, aoLadoDe, gruposDaDiretoriaGeral, colunasSoltas };
  }, [unidades]);

  const kpisComandoGeral = useMemo(() => {
    const cg = estrutura.comandoGeral;
    if (!cg) return {};
    const mapa = {};
    indicadores.filter((i) => i.unidade_id === cg.id).forEach((i) => { mapa[i.nome] = i; });
    return mapa;
  }, [indicadores, estrutura.comandoGeral]);

  // Protótipo de níveis de acesso (2026-08-17, ver DW_PLANEJAMENTO.md e
  // @/lib/useAcessoUsuario): perfis de acesso total (Administrador,
  // Comandante/Subcomandante Geral) veem o organograma sem nenhuma restrição
  // visual. Os demais veem tudo, mas só os cards liberados ficam clicáveis/destacados —
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

  // `alinhar`: colunas sem moldura (pacotes) ganham o mesmo recuo lateral das colunas com moldura
  // (GrupoDiretoria: borda 1px + p-1.5), pra todos os cards da linha terem a mesma largura.
  const renderColunas = (colunas, alinhar = false) => colunas.map((coluna, idx) =>
    coluna.tipo === "pacote" ? (
      <ColunaEmpilhada key={`col-${idx}`} unidades={coluna.unidades} netosDe={coluna.netosDe} goto={goto} acessoDe={acessoDe} drag={drag} alinhar={alinhar} />
    ) : coluna.grupos.length === 1 ? (
      <GrupoDiretoria key={coluna.grupos[0].unidade.id} {...coluna.grupos[0]} goto={goto} acessoDe={acessoDe} drag={drag} />
    ) : (
      <div key={`pilha-${idx}`} className={`flex ${COLUNA_FLEX} flex-col gap-2`}>
        {coluna.grupos.map((g) => (
          <GrupoDiretoria key={g.unidade.id} {...g} empilhado goto={goto} acessoDe={acessoDe} drag={drag} />
        ))}
      </div>
    ));

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
      {/* ===== Cabeçalho "CBMPE - Geral" ===== fora do body do organograma
          (pedido de 2026-09-25): não é uma unidade real, é só a
          identificação da corporação, então fica FORA da caixa que envolve
          Comando/Subcomando/Diretorias — antes ficava "integrado" dentro
          dela, criando a impressão de que era mais um nível da hierarquia.
          Cor vermelha (não dourada com fade, cor reservada às unidades de
          verdade), com o ícone de chama junto ao nome. */}
      <div className="mx-auto w-full max-w-md">
        <div className={`relative rounded-xl rounded-b-none border-2 border-red-400 bg-gradient-to-br from-red-600 via-red-700 to-red-800 p-3 text-center shadow-[0_8px_30px_-6px_rgba(185,28,28,0.35)] ${cbmpeBloqueado ? "opacity-50 saturate-[0.4]" : ""}`}>
          <div className="flex items-center justify-center gap-2">
            <Flame className="h-4 w-4 fill-current text-red-200" />
            <p className="text-base font-black uppercase tracking-wider text-white">CBMPE - Geral</p>
            <Flame className="h-4 w-4 fill-current text-red-200" />
          </div>
          {cbmpeBloqueado && <CadeadoOverlay claro />}
        </div>
        <div className="grid grid-cols-2 gap-2 rounded-xl rounded-t-none border border-t-0 border-border bg-background p-2 sm:grid-cols-3">
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
          {/* Mapa de Força e Ocorrências da corporação inteira, liberados para todos
              (decisão do usuário, 2026-10-29) — sem cadeado nem checagem de perfil. */}
          {ATALHOS_CORPORACAO.map(({ nome, rota }) => (
            <Link
              key={nome}
              to={rota}
              className={`relative flex min-h-[2.75rem] items-center justify-center rounded-lg border border-border bg-card px-2 text-center text-xs font-bold text-foreground transition-colors hover:border-amber-500 ${SOMBRA_CARD}`}
            >
              {nome}
            </Link>
          ))}
        </div>
      </div>

      {/* Sem min-width forçado: o organograma empilha naturalmente no mobile,
          igual à referência (index.html). O scroll horizontal só existe como
          rede de segurança para telas muito estreitas. Margem superior
          retraída (pt-3/pt-6 iguais ao restante do padding, não mais um
          bloco extra) — o body agora começa direto no COMANDO GERAL. */}
      <div className="relative overflow-x-auto rounded-xl border border-border bg-card p-3 scrollbar-thin sm:p-6">
        {(podeVerLob || (!!tokenAdmin && lob === "atual")) && (
          <div className="absolute right-3 top-3 z-30 flex items-center gap-2">
            {podeVerLob && (
              <div
                role="group"
                aria-label="LOB"
                className="inline-flex items-center overflow-hidden rounded-full border border-border bg-card text-[11px] font-semibold shadow-sm"
              >
                <span className="px-2.5 text-muted-foreground">LOB</span>
                {[["atual", "Atual"], ["nova", "Nova"]].map(([valor, rotuloLob]) => (
                  <button
                    key={valor}
                    onClick={() => { if (modoEdicao) setModoEdicao(false); setLob(valor); }}
                    aria-pressed={lob === valor}
                    className={`px-3 py-1.5 transition-colors ${
                      lob === valor ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {rotuloLob}
                  </button>
                ))}
              </div>
            )}
            {!!tokenAdmin && lob === "atual" && (
              <button
                onClick={alternarModoEdicao}
                title={modoEdicao ? "Sair do modo de edição" : "Editar organograma"}
                className={`inline-flex h-9 w-9 items-center justify-center rounded-full border shadow-sm transition-colors ${
                  modoEdicao
                    ? "border-primary bg-primary text-primary-foreground hover:opacity-90"
                    : "border-border bg-card text-muted-foreground hover:border-primary hover:text-primary"
                }`}
              >
                {modoEdicao ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
              </button>
            )}
          </div>
        )}
        <div className="mx-auto flex w-full max-w-[1520px] flex-col items-center gap-6 py-2 sm:gap-8">
          {/* ===== Comando Geral ===== */}
          {estrutura.comandoGeral && (
            // Balão + subordinadas de nível 6 diretas: o balão continua
            // CENTRALIZADO na página (grid minmax(0,1fr)/auto/minmax(0,1fr)
            // com a 1ª coluna vazia do mesmo tamanho da 3ª — pedido de
            // 2026-09-23), e são as subordinadas que se deslocam pra
            // direita, não o balão. minmax(0,1fr) (não só "1fr") garante que
            // as duas colunas fiquem SEMPRE do mesmo tamanho mesmo quando
            // uma tem mais conteúdo que a outra (ex.: linha do Subcomando,
            // que tem o quadro do Estado-Maior na coluna 1) — sem isso o
            // conteúdo mínimo de cada coluna desalinha o balão do centro.
            // Empilha centralizado em telas estreitas.
            <div className="grid w-full grid-cols-1 items-center justify-items-center gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-6">
              <div className="hidden lg:block" aria-hidden="true" />
              <NoEstrela unidade={estrutura.comandoGeral} tom="amber" onClick={() => goto(estrutura.comandoGeral.sigla)} acessoOk={acessoDe(estrutura.comandoGeral.sigla)} drag={drag} />
              {/* max-w trava a quebra em 3+2 (pedido de 2026-09-25) em vez de
                  4+1: as 5 subordinadas diretas do Comando Geral (GCG, CI,
                  CPO, AECI, CCS) cabiam 4 numa linha só em telas largas —
                  largura pensada pros 3 primeiros cards (o quarto, AECI, é
                  bem mais largo por causa do cargo "Assessor Especial")
                  ainda caberem juntos, mas não um quinto. flex-wrap com
                  justify-center já centraliza cada linha por conta própria
                  (comportamento padrão de flexbox multi-linha), então isto
                  sozinho já resulta nas duas linhas centralizadas pedidas. */}
              <div className="max-w-full lg:min-w-0 lg:justify-self-start">
                <LinhaAssessorias unidades={estrutura.aoLadoDe(estrutura.comandoGeral)} goto={goto} accent="amber" acessoDe={acessoDe} drag={drag} />
              </div>
            </div>
          )}

          {/* ===== Subcomando Geral, com o Estado-Maior Geral à esquerda,
              mesma altura ===== `order` inverte a posição empilhada no
              mobile (grid-cols-1): sem isso o Estado-Maior, por vir
              PRIMEIRO no DOM (é a coluna 1 do grid de 3 colunas do
              desktop), aparecia ACIMA do balão do Subcomando Geral ao
              encolher a tela — pedido de 2026-09-25 é o contrário (balão
              primeiro, Estado-Maior abaixo dele). A partir de lg os `order`
              voltam ao neutro e o grid-cols-[...] de 3 colunas manda. */}
          {estrutura.subcomandoGeral && (
            <div className="grid w-full grid-cols-1 items-center justify-items-center gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-6">
              <div className="order-2 flex w-full justify-center lg:order-1 lg:justify-end">
                <EstadoMaiorBox
                  unidade={estrutura.estadoMaior}
                  filhos={estrutura.estadoMaior ? estrutura.aoLadoDe(estrutura.estadoMaior) : []}
                  goto={goto}
                  acessoOk={estrutura.estadoMaior ? acessoDe(estrutura.estadoMaior.sigla) : null}
                  acessoDe={acessoDe}
                  drag={drag}
                />
              </div>
              <div className="order-1 lg:order-2 lg:flex lg:self-stretch">
                <NoEstrela unidade={estrutura.subcomandoGeral} tom="yellow" onClick={() => goto(estrutura.subcomandoGeral.sigla)} acessoOk={acessoDe(estrutura.subcomandoGeral.sigla)} drag={drag} />
              </div>
              <div className="order-3 lg:order-3 lg:min-w-0 lg:justify-self-start">
                <LinhaAssessorias unidades={estrutura.aoLadoDe(estrutura.subcomandoGeral)} goto={goto} accent="yellow" acessoDe={acessoDe} drag={drag} />
              </div>
            </div>
          )}

          {/* ===== Diretorias Gerais (nível 4) ===== grid de diretorias só
              vira 2 colunas a partir de 2xl (1536px — não mais lg, nem xl):
              abaixo disso cada diretoria fica sozinha na linha, com a
              largura toda pra suas colunas internas (w-28, ver
              GrupoDiretoria/ColunaEmpilhada) não quebrarem. Medido: mesmo
              com lg:grid-cols-2 (1024px) e depois xl:grid-cols-2 (1280px),
              a caixa de cada diretoria continuava estreita demais pra 4
              colunas numa linha só até ~1920px de viewport — DIM/DINTER I/
              DINTER II/DIESP da DGO e as 4 colunas da DGA quebravam pra uma
              2ª linha (2+2) em telas de notebook comuns (1440px) — bug
              reportado em 2026-09-25. */}
          <div className="flex w-full flex-wrap justify-center gap-6 2xl:gap-8">
            {estrutura.diretoriasGerais.map((dg) => {
              const colunas = estrutura.gruposDaDiretoriaGeral(dg);
              // Largura uniforme entre as diretorias: cada coluna vale a mesma coisa em qualquer caixa.
              // A caixa cresce e parte de uma base proporcional ao nº de colunas (flex-grow = nº de
              // colunas; base = n × COLUNA_MIN + padding da caixa), então DGO (5) e DGA (4) dividem
              // a linha e terminam com colunas — e cards — do mesmo tamanho.
              const n = Math.max(1, colunas.length);
              return (
                <div
                  key={dg.id}
                  style={{ flex: `${n} 1 calc(${n} * ${COLUNA_MIN} + 2rem)` }}
                  className="flex max-w-full flex-col items-center rounded-2xl border border-border bg-background p-3 sm:p-4"
                >
                  <CardDiretoria unidade={dg} onClick={() => goto(dg.sigla)} acessoOk={acessoDe(dg.sigla)} drag={drag} />
                  {/* Trilhas de largura IGUAL (grade, não flex): com flex, o padding de cada tipo de
                      coluna deixava uma 3px mais larga que a outra. auto-fit mantém o comportamento
                      de antes — só quebra de linha quando nem COLUNA_MIN cabe — pedido de 2026-09-25. */}
                  <div
                    className="mt-4 grid w-full items-start justify-center gap-2 [&>*]:min-w-0"
                    style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${COLUNA_MIN}, 1fr))` }}
                  >
                    {renderColunas(colunas, true)}
                  </div>
                </div>
              );
            })}
            {estrutura.colunasSoltas.length > 0 && (
              // LOB Atual: subordinadas da DGA extinta, sem quadro nem card. Mesma regra de largura
              // das caixas acima (base e flex-grow pelo nº de colunas, trilhas iguais), pra os cards
              // saírem do mesmo tamanho que os da DGO.
              <div
                className="grid max-w-full items-start justify-center gap-2 p-3 sm:p-4 [&>*]:min-w-0"
                style={{
                  flex: `${estrutura.colunasSoltas.length} 1 calc(${estrutura.colunasSoltas.length} * ${COLUNA_MIN} + 2rem)`,
                  gridTemplateColumns: `repeat(auto-fit, minmax(${COLUNA_MIN}, 1fr))`,
                }}
              >
                {renderColunas(estrutura.colunasSoltas, true)}
              </div>
            )}
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
  // ser movida pra Comando/Subcomando via arrastar-e-soltar. `lado` não é
  // usado aqui (virar filho, não reordenar irmão — sem "antes/depois").
  const { dragClasses, lado: _lado, ...dragProps } = drag?.propsDoCard(unidade) || {};
  return (
    <button
      onClick={bloqueado ? undefined : onClick}
      disabled={bloqueado}
      {...dragProps}
      className={`relative z-10 flex min-h-[9.5rem] w-max min-w-[20rem] shrink-0 flex-col items-center justify-center rounded-xl border-2 bg-gradient-to-br px-5 py-4 text-center transition-transform ${
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
      <p className={`mt-0.5 whitespace-nowrap text-[11px] tracking-widest ${isAmber ? "text-amber-200" : "text-yellow-200"}`}>{unidade.responsavel}{unidade.cargo ? ` - ${unidade.cargo}` : ""}</p>
      <div className={`mt-2 inline-flex items-center gap-1 rounded-full bg-black/20 px-3 py-1 text-[10px] font-semibold ${isAmber ? "text-amber-100" : "text-yellow-100"}`}>
        <TrendingUp className="h-3 w-3" /> Detalhar
      </div>
      {bloqueado && <CadeadoOverlay claro posicao="bottom-right" />}
    </button>
  );
}

// Card de uma OME "folha" (nível 6, sem subordinada própria) — usado tanto
// ao lado do balão de Comando/Subcomando/Estado-Maior (LinhaAssessorias,
// EstadoMaiorBox) quanto dentro do quadro de uma Diretoria Setorial
// (GrupoDiretoria). Título + "chefe - cargo" NUMA LINHA SÓ, sem quebra
// (pedido de 2026-09-25 — antes cada lugar tinha seu próprio botão inline,
// com o de LinhaAssessorias quebrando "chefe - cargo" em 2 linhas por falta
// de espaço no card estreito w-24/w-28). `largura="auto"`: card se ajusta
// ao próprio conteúdo (whitespace-nowrap de verdade, nunca corta — usado
// onde o container-pai é flex-wrap, então um card mais largo só empurra
// pra próxima linha, não estoura). `largura="col"`: preenche a coluna de
// largura fixa do GrupoDiretoria (contexto onde não há como crescer sem
// quebrar o alinhamento da grade de diretorias) — ali o nowrap vira
// truncate como rede de segurança, não a regra geral.
function CardFolha({ unidade, onClick, acessoOk, drag, largura = "auto", accent = "yellow" }) {
  if (!unidade) return null;
  const bloqueado = acessoOk === "no";
  const { dragClasses, lado, ...dragProps } = drag?.propsDoCard(unidade) || {};
  const hoverBorder = accent === "amber" ? "hover:border-amber-500" : "hover:border-yellow-500";
  // Sigla sempre inteira (nunca truncate, desde 2026-09-25) — ver ChefeCargo
  // pro nome do chefe.
  const textoClasses = "whitespace-nowrap";
  // "Função de Coronel" (2026-09-25, ver OrganogramaEditor.jsx): renderiza
  // no mesmo dourado com fade de CardDiretoria, independente do nível —
  // sobrepõe o estilo branco padrão de card "folha".
  if (unidade.funcaoCoronel) {
    return (
      <button
        onClick={bloqueado ? undefined : onClick}
        disabled={bloqueado}
        {...dragProps}
        className={`relative shrink-0 rounded-lg border-2 border-yellow-400 bg-yellow-600 px-2.5 py-1.5 text-center shadow-md transition-transform ${
          largura === "auto" ? "w-fit min-w-[4rem]" : "w-full"
        } ${bloqueado ? CADEADO_BLOQUEADO : "hover:-translate-y-0.5"} ${dragClasses || ""}`}
      >
        <TracoInsercao lado={lado} />
        <p className={`text-[11px] font-black uppercase text-white ${textoClasses}`}>{unidade.sigla}</p>
        <ChefeCargo unidade={unidade} className="text-[9px] leading-tight text-yellow-100" />
        {bloqueado && <CadeadoOverlay claro />}
      </button>
    );
  }
  return (
    <button
      onClick={bloqueado ? undefined : onClick}
      disabled={bloqueado}
      {...dragProps}
      className={`relative shrink-0 rounded-lg border bg-card px-2.5 py-1.5 text-center transition-colors ${SOMBRA_CARD} ${
        largura === "auto" ? "w-fit min-w-[4rem]" : "w-full"
      } ${
        bloqueado ? `border-border ${CADEADO_BLOQUEADO}` : acessoOk === "ok" ? "border-amber-400" : `border-border ${hoverBorder}`
      } ${dragClasses || ""}`}
    >
      <TracoInsercao lado={lado} />
      <p className={`text-[11px] font-bold text-foreground ${textoClasses}`}>{unidade.sigla}</p>
      <ChefeCargo unidade={unidade} className="text-[9px] leading-tight text-muted-foreground" />
      {bloqueado && <CadeadoOverlay />}
    </button>
  );
}

// Unidades de nível 6 diretamente subordinadas ao Comando/Subcomando Geral
// (nível 1-2) — ficam AO LADO do balão do pai (mesmo quadro de sempre), não
// abaixo dele numa fileira separada (pedido explícito do usuário,
// 2026-09-23). flex-wrap SEMPRE ativo (não só até `lg`, pedido de
// 2026-09-25): cada card tem largura própria (CardFolha largura="auto",
// nunca corta o "chefe - cargo"), e se a linha não couber todos, o
// excedente reagrupa numa nova linha em vez de espremer o texto.
//
// Desde 2026-09-25 as linhas são montadas aqui (até POR_LINHA cards cada),
// não mais por flex-wrap: com flex-wrap a caixa ocupava a largura máxima
// disponível e a linha incompleta ficava encostada num lado, deixando mais
// borda de um lado que do outro. Agora a caixa é w-fit (largura da linha
// mais larga) e cada linha é centralizada dentro dela — bordas simétricas.
const ASSESSORIAS_POR_LINHA = 3;
function LinhaAssessorias({ unidades, goto, accent, acessoDe, drag }) {
  if (unidades.length === 0) return null;
  const linhas = [];
  for (let i = 0; i < unidades.length; i += ASSESSORIAS_POR_LINHA) {
    linhas.push(unidades.slice(i, i + ASSESSORIAS_POR_LINHA));
  }
  return (
    <div className="flex w-fit max-w-full flex-col items-center gap-2 rounded-xl border border-border bg-background p-2">
      {linhas.map((linha, idx) => (
        <div key={idx} className="flex max-w-full flex-wrap justify-center gap-2">
          {linha.map((u) => (
            <CardFolha
              key={u.id}
              unidade={u}
              onClick={() => goto(u.sigla)}
              acessoOk={acessoDe(u.sigla)}
              drag={drag}
              accent={accent}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// Card de uma "diretoria" (balão dourado com título + chefe/cargo) — usado
// tanto pra Diretoria Executiva (nível 4) quanto Diretoria Setorial (nível
// 5) quanto pro Estado-Maior Geral (nível 3, ver EstadoMaiorBox). Tamanho
// ÚNICO pros três (pedido de 2026-09-25 — antes a Diretoria Executiva tinha
// um "tamanho=lg" maior/com fonte maior que as demais); os únicos cards com
// tamanho diferenciado no organograma inteiro são os balões-estrela de
// Comando/Subcomando Geral (NoEstrela). Mesma dualidade de largura do
// CardFolha: `largura="auto"` (padrão — cabeçalho de diretoria "solto",
// como o da própria DGO/DGA ou do Estado-Maior Geral em EstadoMaiorBox)
// nunca corta o nome; `largura="col"` (dentro da coluna de largura fixa de
// GrupoDiretoria/ColunaEmpilhada) usa truncate como rede de segurança.
function CardDiretoria({ unidade, onClick, acessoOk, drag, largura = "auto" }) {
  if (!unidade) return null;
  const bloqueado = acessoOk === "no";
  const { dragClasses, lado, ...dragProps } = drag?.propsDoCard(unidade) || {};
  const textoClasses = "whitespace-nowrap";
  return (
    <button
      onClick={bloqueado ? undefined : onClick}
      disabled={bloqueado}
      {...dragProps}
      className={`relative shrink-0 rounded-xl border-2 border-yellow-400 bg-yellow-600 px-3 py-2 text-center shadow-md transition-transform ${
        largura === "auto" ? "w-fit min-w-[8.5rem]" : "w-full"
      } ${bloqueado ? CADEADO_BLOQUEADO : "hover:-translate-y-0.5"} ${dragClasses || ""}`}
    >
      <TracoInsercao lado={lado} />
      <p className={`text-xs font-black uppercase tracking-wider text-white ${textoClasses}`}>{unidade.sigla}</p>
      <ChefeCargo unidade={unidade} className="mt-0.5 text-[9px] leading-tight text-yellow-100" />
      {bloqueado && <CadeadoOverlay claro />}
    </button>
  );
}

// Body próprio do Estado-Maior Geral (nível 3) — visualmente igual ao de
// uma Diretoria Executiva (balão dourado + quadro cinza, ver CardDiretoria/
// GrupoDiretoria), com as 3 subordinadas fixas (1º/2º/3º EMG) lado a lado
// em linha única abaixo, não empilhadas (pedido de 2026-09-25 — diferente
// do padrão empilhado de GrupoDiretoria, que é pra listas mais longas).
function EstadoMaiorBox({ unidade, filhos, goto, acessoOk, acessoDe, drag }) {
  if (!unidade) return null;
  return (
    <div className="flex w-fit max-w-full flex-col items-center rounded-2xl border border-border bg-background p-3">
      <CardDiretoria unidade={unidade} onClick={() => goto(unidade.sigla)} acessoOk={acessoOk} drag={drag} />
      {filhos.length > 0 && (
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {filhos.map((f) => (
            <CardFolha key={f.id} unidade={f} onClick={() => goto(f.sigla)} acessoOk={acessoDe(f.sigla)} drag={drag} />
          ))}
        </div>
      )}
    </div>
  );
}

// Unidades de nível 5 "folha" (sem subordinada própria) de uma Diretoria
// Geral, empilhadas sem moldura — mesmo efeito visual do antigo
// DGA_COLUNAS_EMPILHADAS, agora calculado (ver splitEmColunas). Largura
// fixa (não mais grid de colunas no pai — ver flex-wrap em Organograma()),
// pra manter o alinhamento visual entre as colunas da mesma diretoria.
// Largura dinâmica das colunas de uma Diretoria Geral (2026-09-25, substitui
// o w-28 fixo que cortava nome/cargo): flex 1 1 0 — todas partem do
// min-content (nome e cargo em duas linhas, nunca cortados, ver ChefeCargo)
// e crescem por igual pra preencher a largura da diretoria, até max-w (a
// partir daí justify-center centraliza o conjunto, bordas simétricas).
const COLUNA_FLEX = "flex-1 basis-0 max-w-[15rem]";
// Largura mínima de uma coluna de diretoria — o mesmo valor de `min-w-[6.5rem]` na linha de colunas.
const COLUNA_MIN = "6.5rem";

function ColunaEmpilhada({ unidades, netosDe, goto, acessoDe, drag, alinhar = false }) {
  return (
    <div className={`flex ${COLUNA_FLEX} flex-col gap-2 ${alinhar ? "px-[7px]" : ""}`}>
      {unidades.map((u) => {
        if (u.nivel !== 6) {
          return <CardDiretoria key={u.id} unidade={u} onClick={() => goto(u.sigla)} acessoOk={acessoDe(u.sigla)} drag={drag} largura="col" />;
        }
        const netos = netosDe ? netosDe(u.id) : [];
        if (netos.length === 0) {
          return <CardFolha key={u.id} unidade={u} onClick={() => goto(u.sigla)} acessoOk={acessoDe(u.sigla)} drag={drag} largura="col" />;
        }
        // Subordinada de nível 6 solta na diretoria que tem subordinadas próprias (LOB Nova: AJG → GI):
        // mesmo quadro menor usado para ABMG → CEI/CFO/CAEBM.
        return (
          <div key={u.id} className="flex flex-col gap-1 rounded-lg border border-border bg-black/[0.16] p-1">
            <CardFolha unidade={u} onClick={() => goto(u.sigla)} acessoOk={acessoDe(u.sigla)} drag={drag} largura="col" />
            {netos.map((n) => (
              <CardFolha key={n.id} unidade={n} onClick={() => goto(n.sigla)} acessoOk={acessoDe(n.sigla)} drag={drag} largura="col" />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function GrupoDiretoria({ unidade, filhos, netosDe, empilhado = false, goto, acessoDe, drag }) {
  // Fundo um pouco mais escuro que o #F5F5F5 do container-pai, pra dar
  // contraste (pedido de 2026-08-19 — DIM, DINTER I/II, DLOG, DEIP). Largura
  // fixa (w-28, mesma de ColunaEmpilhada — reduzida de w-40/44 em
  // 2026-09-25, e de novo de w-32/36 no mesmo dia depois de medir que ainda
  // quebrava em 1920px — pra até 4 colunas caberem numa linha só sem
  // quebrar) — os filhos usam CardFolha largura="col" (truncate como rede
  // de segurança) porque aqui não há como crescer sem quebrar o
  // alinhamento das colunas da diretoria.
  return (
    <div className={`flex ${empilhado ? "w-full" : COLUNA_FLEX} flex-col items-stretch rounded-xl border border-border bg-black/[0.05] p-1.5`}>
      <CardDiretoria unidade={unidade} onClick={() => goto(unidade.sigla)} acessoOk={acessoDe(unidade.sigla)} drag={drag} largura="col" />
      {filhos.length > 0 && (
        <div className="mt-2 flex flex-col gap-1.5">
          {filhos.map((f) => {
            const netos = netosDe ? netosDe(f.id) : [];
            if (netos.length === 0) {
              return <CardFolha key={f.id} unidade={f} onClick={() => goto(f.sigla)} acessoOk={acessoDe(f.sigla)} drag={drag} largura="col" />;
            }
            // Subordinada que tem subordinadas próprias (LOB Nova: ABMG → CEI, CFO,
            // CAEBM): vira um quadro menor dentro da coluna.
            return (
              <div key={f.id} className="flex flex-col gap-1 rounded-lg border border-border bg-black/[0.16] p-1">
                <CardFolha unidade={f} onClick={() => goto(f.sigla)} acessoOk={acessoDe(f.sigla)} drag={drag} largura="col" />
                {netos.map((n) => (
                  <CardFolha key={n.id} unidade={n} onClick={() => goto(n.sigla)} acessoOk={acessoDe(n.sigla)} drag={drag} largura="col" />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
