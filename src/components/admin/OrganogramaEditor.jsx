import React from "react";
import { Plus, Trash2, AlertTriangle, Check } from "lucide-react";
import { useCbmpe } from "@/lib/cbmpe-context";
import { useAuth } from "@/lib/AuthContext";
import { getSubordinados } from "@/lib/cbmpe";
import { criarUnidade, atualizarUnidade, removerUnidade } from "@/lib/organogramaClient";
import SectionCard from "@/components/ui/section-card";

// Edição do organograma (mudar subordinação, renomear, criar, excluir OME)
// — ver relatório da funcionalidade. Estrutura (sigla/nível/pai) vem do
// backend (GET/POST/PUT/DELETE /organograma); os outros dados de cada
// unidade (oficial, indicadores mock, divisões) continuam estáticos e fora
// desta tela.
const NIVEL_LABEL = {
  1: "Comando Geral",
  2: "Subcomando Geral",
  3: "Estado Maior",
  4: "Diretoria Geral",
  5: "Diretoria Especialista",
  6: "OME Subordinada",
};

const CLASSE_CAMPO =
  "h-9 w-full rounded-md border border-border bg-background px-2.5 text-[13px] " +
  "text-foreground outline-none transition-colors focus:border-primary";

// Pais aceitáveis pra uma unidade de um dado nível, seguindo a mesma regra
// do backend (organogramaService.validarRelacaoNivel) — replicada aqui só
// pra filtrar as opções do <select>; a validação de verdade é sempre a do
// servidor.
function paisValidos(nivel, unidades) {
  if (nivel === 5) return unidades.filter((u) => u.nivel === 4);
  if (nivel === 6) return unidades.filter((u) => u.nivel === 5 || u.nivel <= 3);
  return [];
}

export default function OrganogramaEditor() {
  const { unidades, recarregar } = useCbmpe();
  const { user } = useAuth();
  // Só o admin fixo (VITE_ADMIN_USUARIO) tem token de admin do backend hoje
  // — ver comentário no topo de src/lib/authClient.js. Um usuário "nivel"
  // com perfil ADMINISTRADOR (accessControl.js) enxerga esta tela mas não
  // tem esse token, então nem tenta mandar o token errado (SGU) pras rotas
  // de escrita do organograma.
  const token = user?.role === "admin" ? user?.token : undefined;

  const [erro, setErro] = React.useState("");
  const [ok, setOk] = React.useState("");
  const [ocupado, setOcupado] = React.useState(null); // id em operação, ou "novo"
  const [siglaEditada, setSiglaEditada] = React.useState({});

  const [novaSigla, setNovaSigla] = React.useState("");
  const [novoNivel, setNovoNivel] = React.useState("6");
  const [novoPai, setNovoPai] = React.useState("");

  const lista = React.useMemo(
    () => [...unidades].sort((a, b) => a.nivel - b.nivel || a.sigla.localeCompare(b.sigla, "pt-BR")),
    [unidades]
  );

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

  async function aoCriar(evento) {
    evento.preventDefault();
    const nivelNum = Number(novoNivel);
    if (!novaSigla.trim()) return avisar("Informe a sigla/nome da nova unidade.");
    if (nivelNum !== 4 && !novoPai) return avisar("Selecione a unidade pai.");
    setOcupado("novo");
    try {
      await criarUnidade(
        { sigla: novaSigla.trim(), nivel: nivelNum, parentId: nivelNum === 4 ? undefined : novoPai },
        token
      );
      await recarregar();
      confirmarOk(`"${novaSigla.trim()}" criada.`);
      setNovaSigla("");
      setNovoPai("");
    } catch (e) {
      avisar(e.message);
    } finally {
      setOcupado(null);
    }
  }

  const opcoesPaiCriacao = paisValidos(Number(novoNivel), unidades);
  const semToken = !token;

  return (
    <SectionCard
      titulo="Organograma"
      subtitulo="Subordinação, sigla e criação/exclusão de unidades (OMEs)"
      semPadding
    >
      {semToken && (
        <div className="flex items-start gap-2 border-b border-border bg-destructive/5 px-5 py-3 text-[12px] text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {user?.role === "admin"
              ? "Sessão sem token de administrador do backend — confira se o backend está no ar e se VITE_AUTH_API_URL está configurado, depois saia e entre novamente."
              : "A edição do organograma só funciona logado com o usuário administrador fixo (VITE_ADMIN_USUARIO) — o backend ainda não reconhece perfis atribuídos em /adm como administradores."}
          </span>
        </div>
      )}
      {erro && (
        <div className="flex items-start gap-2 border-b border-border bg-destructive/5 px-5 py-3 text-[12px] text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {erro}
        </div>
      )}
      {ok && (
        <div className="flex items-center gap-2 border-b border-border bg-primary/5 px-5 py-3 text-[12px] text-primary">
          <Check className="h-3.5 w-3.5 shrink-0" /> {ok}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-5 py-2.5 font-medium">Sigla / Nome</th>
              <th className="px-5 py-2.5 font-medium">Nível</th>
              <th className="px-5 py-2.5 font-medium">Subordinada a</th>
              <th className="px-5 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {lista.map((u) => {
              const imutavel = u.nivel <= 3;
              const movivel = !imutavel && u.nivel !== 4;
              const opcoesPai = movivel
                ? paisValidos(u.nivel, unidades).filter((p) => p.id !== u.id && !getSubordinados(unidades, u.id).some((d) => d.id === p.id))
                : [];
              const pai = unidades.find((x) => x.id === u.parent_id);
              return (
                <tr key={u.id} className="border-b border-border/60 align-top last:border-0">
                  <td className="px-5 py-2.5">
                    <input
                      value={siglaEditada[u.id] ?? u.sigla}
                      onChange={(e) => setSiglaEditada((s) => ({ ...s, [u.id]: e.target.value }))}
                      onBlur={() => aoRenomear(u)}
                      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                      disabled={ocupado === u.id}
                      className={`${CLASSE_CAMPO} w-48`}
                    />
                  </td>
                  <td className="px-5 py-2.5 text-muted-foreground">
                    {u.nivel} — {NIVEL_LABEL[u.nivel] || "—"}
                  </td>
                  <td className="px-5 py-2.5">
                    {!movivel ? (
                      <span className="text-muted-foreground">{pai ? pai.sigla : "—"}{imutavel ? "" : " (fixo)"}</span>
                    ) : (
                      <select
                        value={u.parent_id || ""}
                        onChange={(e) => aoMover(u, e.target.value)}
                        disabled={ocupado === u.id}
                        className={`${CLASSE_CAMPO} w-56`}
                      >
                        {opcoesPai.map((p) => (
                          <option key={p.id} value={p.id}>{p.sigla} (nível {p.nivel})</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    {!imutavel && (
                      <button
                        onClick={() => aoExcluir(u)}
                        disabled={ocupado === u.id}
                        title="Excluir unidade"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <form onSubmit={aoCriar} className="flex flex-wrap items-end gap-2 border-t border-border px-5 py-3.5">
        <div>
          <label className="mb-1 block text-[11px] text-muted-foreground">Nível</label>
          <select
            value={novoNivel}
            onChange={(e) => { setNovoNivel(e.target.value); setNovoPai(""); }}
            className={`${CLASSE_CAMPO} w-56`}
          >
            <option value="1" disabled>1 — Comando Geral (já existe)</option>
            <option value="2" disabled>2 — Subcomando Geral (já existe)</option>
            <option value="3" disabled>3 — Estado Maior (em breve)</option>
            <option value="4">4 — Diretoria Geral</option>
            <option value="5">5 — Diretoria Especialista</option>
            <option value="6">6 — OME Subordinada</option>
          </select>
        </div>
        {Number(novoNivel) !== 4 && (
          <div>
            <label className="mb-1 block text-[11px] text-muted-foreground">
              Subordinada a {Number(novoNivel) === 6 ? "(Diretoria Especialista, ou Comando/Subcomando Geral)" : "(Diretoria Geral)"}
            </label>
            <select value={novoPai} onChange={(e) => setNovoPai(e.target.value)} className={`${CLASSE_CAMPO} w-64`}>
              <option value="">Selecione…</option>
              {opcoesPaiCriacao.map((p) => (
                <option key={p.id} value={p.id}>{p.sigla} (nível {p.nivel})</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="mb-1 block text-[11px] text-muted-foreground">Sigla / Nome</label>
          <input value={novaSigla} onChange={(e) => setNovaSigla(e.target.value)} className={`${CLASSE_CAMPO} w-48`} />
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
        <p className="px-5 pb-3.5 text-[11px] text-muted-foreground">
          Pai de nível 1-3 selecionado: esta unidade vai aparecer ao lado do balão do pai no organograma, não abaixo dele.
        </p>
      )}
    </SectionCard>
  );
}
