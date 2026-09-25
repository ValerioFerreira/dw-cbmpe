import React from "react";
import { Plus, Trash2, AlertTriangle, Check, ChevronDown } from "lucide-react";
import { useCbmpe } from "@/lib/cbmpe-context";
import { useAcessoUsuario } from "@/lib/useAcessoUsuario";
import { getSubordinados } from "@/lib/cbmpe";
import { criarUnidade, atualizarUnidade, removerUnidade } from "@/lib/organogramaClient";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";

// Edição do organograma (mudar subordinação, renomear, criar, excluir OME)
// — ver relatório da funcionalidade. Estrutura (sigla/nível/pai) vem do
// backend (GET/POST/PUT/DELETE /organograma); os outros dados de cada
// unidade (oficial, indicadores mock, divisões) continuam estáticos e fora
// desta tela.
//
// Redesenho de 2026-09-25: antes era uma tabela única e sempre expandida
// (46+ linhas, ocupava a página inteira) — agora vive dentro de um modal
// (ver Administracao.jsx) e as unidades ficam agrupadas por nível, cada
// grupo retraído por padrão. Nomes de nível 4/5 revisados no mesmo pedido:
// "Diretoria Geral" → "Diretoria Executiva", "Diretoria Especialista" →
// "Diretoria Setorial".
//
// Segundo redesenho, no mesmo dia: o bloco "Fixas — não editáveis" saiu (não
// precisa ficar à mostra); cada unidade virou um cartão compacto (sigla +
// pai + Função de Coronel + excluir) numa grade de várias colunas, em vez
// de uma linha larga por unidade — ocupava espaço horizontal desnecessário.
// O pai de nível 4 (Diretoria Executiva) deixou de ser fixo: qualquer
// unidade criável (4-6) pode ser subordinada a QUALQUER unidade
// hierarquicamente superior (ver paisValidos/validarRelacaoNivel no
// backend), não só ao nível imediatamente acima — nível 4 só continua
// caindo no Subcomando Geral por padrão ao criar.
const NIVEL_LABEL = {
  1: "Comando Geral",
  2: "Subcomando Geral",
  3: "Estado-Maior Geral",
  4: "Diretoria Executiva",
  5: "Diretoria Setorial",
  6: "OME Subordinada",
};
const GRUPOS_EDITAVEIS = [4, 5, 6]; // 1-3 são fixas (Comando/Subcomando/Estado-Maior Geral)

const CLASSE_CAMPO =
  "h-9 w-full rounded-md border border-border bg-background px-2.5 text-[13px] " +
  "text-foreground outline-none transition-colors focus:border-primary";

// Pais aceitáveis pra uma unidade de um dado nível: qualquer unidade de
// nível hierarquicamente superior (nível menor) — mesma regra generalizada
// do backend (organogramaService.validarRelacaoNivel), replicada aqui só
// pra filtrar as opções do <select>; a validação de verdade é sempre a do
// servidor.
function paisValidos(nivel, unidades) {
  return unidades.filter((u) => u.nivel < nivel);
}

export default function OrganogramaEditor() {
  const { unidades, recarregar } = useCbmpe();
  // Admin fixo OU usuário SGU com perfil ADMINISTRADOR (ver
  // useAcessoUsuario.js e backend/middlewares/requireAdmin.js) — desde
  // 2026-09-23 a atribuição de perfil vive no backend, não só em
  // localStorage, então o backend consegue validar os dois casos.
  const { tokenAdmin: token } = useAcessoUsuario();

  const [erro, setErro] = React.useState("");
  const [ok, setOk] = React.useState("");
  const [ocupado, setOcupado] = React.useState(null); // id em operação, ou "novo"
  const [siglaEditada, setSiglaEditada] = React.useState({});
  const [gruposAbertos, setGruposAbertos] = React.useState({ 4: true, 5: false, 6: false });

  const [novaSigla, setNovaSigla] = React.useState("");
  const [novoNivel, setNovoNivel] = React.useState("6");
  const [novoPai, setNovoPai] = React.useState("");
  const [novoFuncaoCoronel, setNovoFuncaoCoronel] = React.useState(false);

  const porNivel = React.useMemo(() => {
    const mapa = { 4: [], 5: [], 6: [] };
    unidades.forEach((u) => { if (mapa[u.nivel]) mapa[u.nivel].push(u); });
    Object.values(mapa).forEach((lista) => lista.sort((a, b) => a.sigla.localeCompare(b.sigla, "pt-BR")));
    return mapa;
  }, [unidades]);

  function avisar(mensagemErro) {
    setErro(mensagemErro);
    setOk("");
    window.setTimeout(() => setErro(""), 5000);
  }

  function confirmarOk(mensagem) {
    setOk(mensagem);
    setErro("");
    window.setTimeout(() => setOk(""), 2500);
  }

  async function aoRenomear(unidade) {
    const novaValor = (siglaEditada[unidade.id] ?? unidade.sigla).trim();
    if (!novaValor || novaValor === unidade.sigla) return;
    setOcupado(unidade.id);
    try {
      await atualizarUnidade(unidade.id, { sigla: novaValor }, token);
      await recarregar();
      confirmarOk(`"${unidade.sigla}" renomeada para "${novaValor}".`);
    } catch (e) {
      avisar(e.message);
    } finally {
      setOcupado(null);
    }
  }

  async function aoMover(unidade, novoParentId) {
    if (!novoParentId || novoParentId === unidade.parent_id) return;
    setOcupado(unidade.id);
    try {
      await atualizarUnidade(unidade.id, { parentId: novoParentId }, token);
      await recarregar();
      confirmarOk(`"${unidade.sigla}" movida.`);
    } catch (e) {
      avisar(e.message);
    } finally {
      setOcupado(null);
    }
  }

  async function aoAlternarCoronel(unidade) {
    setOcupado(unidade.id);
    try {
      await atualizarUnidade(unidade.id, { funcaoCoronel: !unidade.funcaoCoronel }, token);
      await recarregar();
      confirmarOk(`"${unidade.sigla}" ${unidade.funcaoCoronel ? "deixou de ter" : "passou a ter"} Função de Coronel.`);
    } catch (e) {
      avisar(e.message);
    } finally {
      setOcupado(null);
    }
  }

  async function aoExcluir(unidade) {
    const filhos = getSubordinados(unidades, unidade.id);
    if (filhos.length > 0) {
      avisar(`Mova ou exclua antes as ${filhos.length} unidade(s) subordinada(s) a "${unidade.sigla}".`);
      return;
    }
    if (!window.confirm(`Excluir "${unidade.sigla}"? Esta ação não pode ser desfeita.`)) return;
    setOcupado(unidade.id);
    try {
      await removerUnidade(unidade.id, token);
      await recarregar();
      confirmarOk(`"${unidade.sigla}" excluída.`);
    } catch (e) {
      avisar(e.message);
    } finally {
      setOcupado(null);
    }
  }

  function aoMudarNivel(valor) {
    setNovoNivel(valor);
    // Nível 4 continua caindo no Subcomando Geral por padrão (histórico da
    // estrutura), mas agora é só o valor inicial — o admin pode trocar.
    if (Number(valor) === 4) {
      const subcomando = unidades.find((u) => u.nivel === 2);
      setNovoPai(subcomando ? subcomando.id : "");
    } else {
      setNovoPai("");
    }
  }

  async function aoCriar(evento) {
    evento.preventDefault();
    const nivelNum = Number(novoNivel);
    if (!novaSigla.trim()) return avisar("Informe a sigla/nome da nova unidade.");
    if (!novoPai) return avisar("Selecione a unidade pai.");
    setOcupado("novo");
    try {
      await criarUnidade(
        { sigla: novaSigla.trim(), nivel: nivelNum, parentId: novoPai, funcaoCoronel: novoFuncaoCoronel },
        token
      );
      await recarregar();
      confirmarOk(`"${novaSigla.trim()}" criada.`);
      setNovaSigla("");
      setNovoFuncaoCoronel(false);
      setGruposAbertos((g) => ({ ...g, [nivelNum]: true }));
    } catch (e) {
      avisar(e.message);
    } finally {
      setOcupado(null);
    }
  }

  const opcoesPaiCriacao = paisValidos(Number(novoNivel), unidades);
  const semToken = !token;

  return (
    <div className="space-y-4">
      {semToken && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-[12px] text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Sessão sem token de administrador do backend — só visualização. Para editar, entre com seu CPF (SGU) num usuário com perfil Administrador; o login AGGD não grava alterações.
          </span>
        </div>
      )}
      {erro && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-[12px] text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {erro}
        </div>
      )}
      {ok && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-[12px] text-primary">
          <Check className="h-3.5 w-3.5 shrink-0" /> {ok}
        </div>
      )}

      {GRUPOS_EDITAVEIS.map((nivel) => {
        const lista = porNivel[nivel];
        const aberto = gruposAbertos[nivel];
        return (
          <Collapsible
            key={nivel}
            open={aberto}
            onOpenChange={(v) => setGruposAbertos((g) => ({ ...g, [nivel]: v }))}
            className="overflow-hidden rounded-lg border border-border"
          >
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 bg-muted/40 px-4 py-2.5 text-left transition-colors hover:bg-muted/60">
              <span className="text-[13px] font-semibold text-foreground">
                Nível {nivel} — {NIVEL_LABEL[nivel]}
                <span className="ml-1.5 font-normal text-muted-foreground">({lista.length})</span>
              </span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${aberto ? "rotate-180" : ""}`} />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="grid grid-cols-1 gap-2 p-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {lista.map((u) => (
                  <CartaoUnidade
                    key={u.id}
                    unidade={u}
                    unidades={unidades}
                    ocupado={ocupado}
                    siglaEditada={siglaEditada}
                    setSiglaEditada={setSiglaEditada}
                    aoRenomear={aoRenomear}
                    aoMover={aoMover}
                    aoExcluir={aoExcluir}
                    aoAlternarCoronel={aoAlternarCoronel}
                  />
                ))}
                {lista.length === 0 && (
                  <p className="col-span-full px-1.5 py-2 text-[12px] text-muted-foreground">Nenhuma unidade neste nível ainda.</p>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}

      <form onSubmit={aoCriar} className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-border px-4 py-3.5">
        <div>
          <label className="mb-1 block text-[11px] text-muted-foreground">Nível</label>
          <select
            value={novoNivel}
            onChange={(e) => aoMudarNivel(e.target.value)}
            className={`${CLASSE_CAMPO} w-56`}
          >
            <option value="1" disabled>1 — Comando Geral (já existe)</option>
            <option value="2" disabled>2 — Subcomando Geral (já existe)</option>
            <option value="3" disabled>3 — Estado-Maior Geral (já existe)</option>
            <option value="4">4 — Diretoria Executiva</option>
            <option value="5">5 — Diretoria Setorial</option>
            <option value="6">6 — OME Subordinada</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-muted-foreground">Subordinada a (nível hierarquicamente superior)</label>
          <select value={novoPai} onChange={(e) => setNovoPai(e.target.value)} className={`${CLASSE_CAMPO} w-64`}>
            <option value="">Selecione…</option>
            {opcoesPaiCriacao.map((p) => (
              <option key={p.id} value={p.id}>{p.sigla} (nível {p.nivel})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-muted-foreground">Sigla / Nome</label>
          <input value={novaSigla} onChange={(e) => setNovaSigla(e.target.value)} className={`${CLASSE_CAMPO} w-48`} />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-muted-foreground">Função de Coronel</label>
          <select
            value={novoFuncaoCoronel ? "sim" : "nao"}
            onChange={(e) => setNovoFuncaoCoronel(e.target.value === "sim")}
            className={`${CLASSE_CAMPO} w-28`}
          >
            <option value="nao">Não</option>
            <option value="sim">Sim</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={ocupado === "novo"}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          <Plus className="h-4 w-4" /> Criar unidade
        </button>
      </form>
      {Number(novoNivel) === 6 && opcoesPaiCriacao.some((p) => novoPai && p.id === novoPai && p.nivel <= 3) && (
        <p className="text-[11px] text-muted-foreground">
          Pai de nível 1-3 selecionado: esta unidade vai aparecer ao lado do balão do pai no organograma, não abaixo dele.
        </p>
      )}
    </div>
  );
}

// Cartão compacto de uma unidade (sigla + Função de Coronel + excluir, e o
// pai numa segunda linha) — substituiu a antiga linha larga (LinhaUnidade)
// em 2026-09-25: numa grade de 2-3 colunas em vez de 1 unidade por linha,
// ocupa bem menos espaço horizontal.
function CartaoUnidade({ unidade: u, unidades, ocupado, siglaEditada, setSiglaEditada, aoRenomear, aoMover, aoExcluir, aoAlternarCoronel }) {
  const opcoesPai = paisValidos(u.nivel, unidades)
    .filter((p) => p.id !== u.id && !getSubordinados(unidades, u.id).some((d) => d.id === p.id));
  const emOperacao = ocupado === u.id;
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-background p-2.5">
      <div className="flex items-center gap-1.5">
        <input
          value={siglaEditada[u.id] ?? u.sigla}
          onChange={(e) => setSiglaEditada((s) => ({ ...s, [u.id]: e.target.value }))}
          onBlur={() => aoRenomear(u)}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
          disabled={emOperacao}
          className={`${CLASSE_CAMPO} h-8 min-w-0 flex-1 text-[12.5px]`}
        />
        <button
          type="button"
          onClick={() => aoAlternarCoronel(u)}
          disabled={emOperacao}
          title={u.funcaoCoronel ? "Função de Coronel ativada — clique para desativar" : "Marcar Função de Coronel (card dourado)"}
          className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-[11px] font-bold transition-colors ${
            u.funcaoCoronel
              ? "border-yellow-400 bg-yellow-500 text-white hover:bg-yellow-600"
              : "border-border text-muted-foreground hover:bg-muted"
          }`}
        >
          C
        </button>
        <button
          onClick={() => aoExcluir(u)}
          disabled={emOperacao}
          title="Excluir unidade"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <select
        value={u.parent_id || ""}
        onChange={(e) => aoMover(u, e.target.value)}
        disabled={emOperacao}
        className={`${CLASSE_CAMPO} h-7 text-[11.5px]`}
      >
        {opcoesPai.map((p) => (
          <option key={p.id} value={p.id}>{p.sigla} (nível {p.nivel})</option>
        ))}
      </select>
    </div>
  );
}
