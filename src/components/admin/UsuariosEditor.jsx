import React from "react";
import { Plus, Trash2, AlertTriangle, Check, ChevronDown, Search, RefreshCw, Info, X } from "lucide-react";
import { useCbmpe } from "@/lib/cbmpe-context";
import { useAcessoUsuario } from "@/lib/useAcessoUsuario";
import {
  PERFIS, unidadeDoUsuario, vinculoDoAssessor, resolverOmePorCpf, todosPerfisDoUsuario,
} from "@/lib/accessControl";
import {
  definirAtribuicao, removerAtribuicao, criarUsuarioPendente, atualizarMatriculasPendentes,
  adicionarPerfilAdicional, removerPerfilAdicional,
} from "@/lib/atribuicoesClient";
import { resolverPorCpf, identificarUsuarios, formatarCpf } from "@/lib/pessoasClient";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";

// Extraído de Administracao.jsx no redesenho de 2026-09-25: agora vive num
// modal (ver Administracao.jsx), usuários agrupados por perfil (antes:
// tabela única, sempre expandida). Duas funcionalidades novas no mesmo
// pedido:
//
// 1. CPF resolve a matrícula SOZINHO (antes precisava clicar em
//    "Resolver") assim que completa 11 dígitos — trava o campo de
//    matrícula e o botão de adicionar enquanto busca.
// 2. Quando o CPF não resolve (matrícula não existe no SGP), o usuário
//    pode ser adicionado MESMO ASSIM, com a flag "Matrícula não encontrada
//    na base" — decisão do usuário (2026-09-25): o CPF desse registro fica
//    guardado só no backend (exceção pontual à regra de nunca persistir
//    CPF, ver backend/services/atribuicoesService.js > criarPendente),
//    unicamente pra permitir o retry em lote depois, pelo botão
//    "Atualizar" — nunca é devolvido a nenhum cliente (nem este).
//
// 3. (2026-09-25) Cada usuário aparece pelo NOME, com o CPF ao lado e a
//    matrícula embaixo — antes era só a matrícula (e a "senha" do antigo
//    login de demonstração, removido). Nome/CPF vêm ao vivo do SGP pela
//    rota admin /pessoas/identificar a cada abertura do modal; nada disso é
//    persistido (o arquivo de atribuições continua só com a matrícula).
const CLASSE_CAMPO =
  "h-9 w-full rounded-md border border-border bg-background px-2.5 text-[13px] " +
  "text-foreground outline-none transition-colors focus:border-primary";

export default function UsuariosEditor() {
  const { unidades, atribuicoes, recarregar } = useCbmpe();
  const { ehAdministrador, tokenAdmin } = useAcessoUsuario();

  const [novoCpf, setNovoCpf] = React.useState("");
  const [novoUsuario, setNovoUsuario] = React.useState("");
  const [novoPerfil, setNovoPerfil] = React.useState("TITULAR");
  // "idle" | "buscando" | "encontrada" | "nao_encontrada"
  const [estadoBusca, setEstadoBusca] = React.useState("idle");
  const [nomeEncontrado, setNomeEncontrado] = React.useState("");
  // { [usuario]: { nome, cpf } } — ver item 3 do cabeçalho.
  const [pessoas, setPessoas] = React.useState({});
  const [ocupado, setOcupado] = React.useState(null); // usuário em operação, "novo" ou "pendentes"
  const [erro, setErro] = React.useState("");
  const [ok, setOk] = React.useState("");
  const [gruposAbertos, setGruposAbertos] = React.useState({});

  function avisar(mensagemErro) {
    setErro(mensagemErro);
    setOk("");
    window.setTimeout(() => setErro(""), 5000);
  }
  function confirmarOk(mensagem) {
    setOk(mensagem);
    setErro("");
    window.setTimeout(() => setOk(""), 3500);
  }

  // Busca automática assim que o CPF completa 11 dígitos — substitui o
  // antigo botão "Resolver" clicado manualmente.
  React.useEffect(() => {
    const digitos = novoCpf.replace(/\D/g, "");
    setNomeEncontrado("");
    if (digitos.length !== 11) {
      setEstadoBusca("idle");
      return undefined;
    }
    let cancelado = false;
    setEstadoBusca("buscando");
    resolverPorCpf(digitos, tokenAdmin)
      .then(({ matricula, nome }) => {
        if (cancelado) return;
        if (matricula) {
          setNovoUsuario(matricula);
          setNomeEncontrado(nome || "");
          setEstadoBusca("encontrada");
        } else {
          setNovoUsuario("");
          setEstadoBusca("nao_encontrada");
        }
      })
      .catch(() => {
        if (cancelado) return;
        setNovoUsuario("");
        setEstadoBusca("nao_encontrada");
      });
    return () => { cancelado = true; };
  }, [novoCpf, tokenAdmin]);

  // Chaves atuais como string estável — só refaz a consulta quando o
  // conjunto de usuários muda (não a cada troca de perfil).
  const chavesUsuarios = React.useMemo(() => Object.keys(atribuicoes).sort().join("|"), [atribuicoes]);
  React.useEffect(() => {
    if (!tokenAdmin || !chavesUsuarios) return undefined;
    let cancelado = false;
    identificarUsuarios(chavesUsuarios.split("|"), tokenAdmin)
      .then((r) => { if (!cancelado) setPessoas(r); })
      .catch(() => { /* sem nome/CPF: a linha cai de volta na matrícula */ });
    return () => { cancelado = true; };
  }, [chavesUsuarios, tokenAdmin]);

  // "NOME (matrícula)" pra mensagens e selects — matrícula sozinha quando o
  // nome ainda não chegou/não existe.
  const rotuloUsuario = React.useCallback(
    (usuario) => (pessoas[usuario]?.nome ? `${pessoas[usuario].nome} (${usuario})` : usuario),
    [pessoas]
  );

  async function aplicar(usuario, dados, mensagemOk) {
    setOcupado(usuario);
    try {
      await definirAtribuicao(usuario, { perfil: atribuicoes[usuario]?.perfil, ...dados }, tokenAdmin);
      await recarregar();
      confirmarOk(mensagemOk);
    } catch (e) {
      avisar(e.message);
    } finally {
      setOcupado(null);
    }
  }

  function atualizar(usuario, mudanca) {
    aplicar(usuario, mudanca, `"${usuario}" atualizado.`);
  }

  function trocarPerfil(usuario, chavePerfil) {
    aplicar(usuario, { perfil: chavePerfil }, `Perfil de "${usuario}" alterado.`);
  }

  function vincularAssessor(usuario, titular) {
    aplicar(usuario, {
      titular: titular || null,
      unidadeConcedida: titular ? unidadeDoUsuario(titular, atribuicoes) : null,
    }, `"${usuario}" vinculado.`);
  }

  async function remover(usuario) {
    setOcupado(usuario);
    try {
      await removerAtribuicao(usuario, tokenAdmin);
      await recarregar();
      confirmarOk(`"${usuario}" removido.`);
    } catch (e) {
      avisar(e.message);
    } finally {
      setOcupado(null);
    }
  }

  // Mais de um perfil por usuário (2026-09-25, pedido do usuário): o
  // formulário de adicionar (ver AdicionarPerfilForm) já mostra o alerta de
  // confirmação antes de chamar isto — aqui só persiste.
  async function adicionarPerfilExtra(usuario, dados) {
    await adicionarPerfilAdicional(usuario, dados, tokenAdmin);
    await recarregar();
    confirmarOk(`Perfil "${PERFIS[dados.perfil]?.nome || dados.perfil}" adicionado a "${usuario}".`);
  }

  async function removerPerfilExtra(usuario, perfilChave) {
    setOcupado(usuario);
    try {
      await removerPerfilAdicional(usuario, perfilChave, tokenAdmin);
      await recarregar();
      confirmarOk(`Perfil "${PERFIS[perfilChave]?.nome || perfilChave}" removido de "${usuario}".`);
    } catch (e) {
      avisar(e.message);
    } finally {
      setOcupado(null);
    }
  }

  function limparFormulario() {
    setNovoCpf("");
    setNovoUsuario("");
    setNomeEncontrado("");
    setEstadoBusca("idle");
  }

  async function adicionar(evento) {
    evento.preventDefault();
    if (estadoBusca === "buscando") return;

    const chave = novoUsuario.trim().toUpperCase();
    if (chave) {
      if (atribuicoes[chave]) return avisar(`"${chave}" já existe.`);
      setOcupado("novo");
      try {
        await definirAtribuicao(chave, { perfil: novoPerfil }, tokenAdmin);
        await recarregar();
        confirmarOk(`"${chave}" adicionado.`);
        limparFormulario();
      } catch (e) {
        avisar(e.message);
      } finally {
        setOcupado(null);
      }
      return;
    }

    // Matrícula em branco só é aceitável quando a busca já rodou e não
    // encontrou nada — nunca adiciona "no escuro" sem ter tentado resolver.
    if (estadoBusca !== "nao_encontrada") {
      return avisar("Informe o CPF (pra resolver a matrícula) ou digite a matrícula manualmente.");
    }
    setOcupado("novo");
    try {
      const digitos = novoCpf.replace(/\D/g, "");
      const resultado = await criarUsuarioPendente({ cpf: digitos, perfil: novoPerfil }, tokenAdmin);
      await recarregar();
      confirmarOk(`Adicionado como "${resultado.usuario}" — matrícula não encontrada na base, marcado para atualizar depois.`);
      setGruposAbertos((g) => ({ ...g, [novoPerfil]: true }));
      limparFormulario();
    } catch (e) {
      avisar(e.message);
    } finally {
      setOcupado(null);
    }
  }

  const usuariosPendentes = React.useMemo(
    () => Object.entries(atribuicoes).filter(([, dados]) => dados.matriculaPendente).map(([usuario]) => usuario),
    [atribuicoes]
  );

  async function aoAtualizarPendentes() {
    setOcupado("pendentes");
    try {
      const r = await atualizarMatriculasPendentes(tokenAdmin);
      await recarregar();
      if (r.resolvidos > 0) {
        confirmarOk(`${r.resolvidos} matrícula(s) resolvida(s)${r.aindaPendentes ? `, ${r.aindaPendentes} ainda pendente(s)` : ""}${r.conflitos ? `, ${r.conflitos} em conflito` : ""}.`);
      } else {
        confirmarOk(r.aindaPendentes ? "Nenhuma matrícula nova encontrada ainda." : "Nada pendente.");
      }
    } catch (e) {
      avisar(e.message);
    } finally {
      setOcupado(null);
    }
  }

  const siglas = React.useMemo(
    () => unidades.map((u) => u.sigla).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [unidades]
  );
  const titulares = React.useMemo(
    () => Object.keys(atribuicoes)
      .filter((u) => atribuicoes[u].perfil === "TITULAR")
      .sort((a, b) => a.localeCompare(b, "pt-BR")),
    [atribuicoes]
  );
  const porPerfil = React.useMemo(() => {
    const mapa = {};
    Object.keys(PERFIS).forEach((chave) => { mapa[chave] = []; });
    Object.entries(atribuicoes).forEach(([usuario, dados]) => {
      if (!mapa[dados.perfil]) mapa[dados.perfil] = [];
      mapa[dados.perfil].push(usuario);
    });
    Object.values(mapa).forEach((lista) => lista.sort((a, b) => a.localeCompare(b, "pt-BR")));
    return mapa;
  }, [atribuicoes]);

  if (!ehAdministrador) return null;
  const semToken = !tokenAdmin;
  const rotuloBusca = {
    idle: "",
    buscando: "Buscando matrícula…",
    encontrada: nomeEncontrado ? `Matrícula encontrada — ${nomeEncontrado}` : "Matrícula encontrada",
    nao_encontrada: "Não encontrada na base",
  }[estadoBusca];

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

      {usuariosPendentes.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-400/40 bg-amber-400/10 px-4 py-3">
          <div className="flex items-center gap-2 text-[12px] text-foreground">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
            <span>
              {usuariosPendentes.length === 1 ? "1 usuário" : `${usuariosPendentes.length} usuários`} com matrícula não encontrada na base.
            </span>
          </div>
          <button
            onClick={aoAtualizarPendentes}
            disabled={ocupado === "pendentes"}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-amber-500/50 bg-card px-3 text-[12px] font-medium text-foreground transition-colors hover:bg-amber-400/10 disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${ocupado === "pendentes" ? "animate-spin" : ""}`} />
            Atualizar matrículas pendentes
          </button>
        </div>
      )}

      <form onSubmit={adicionar} className="space-y-2 rounded-lg border border-dashed border-border px-4 py-3.5">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-[11px] text-muted-foreground">CPF</label>
            <div className="relative">
              <input
                value={novoCpf}
                onChange={(e) => setNovoCpf(e.target.value)}
                placeholder="Só números"
                inputMode="numeric"
                className={`${CLASSE_CAMPO} w-44 pr-7`}
              />
              {estadoBusca === "buscando" && (
                <Search className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-pulse text-muted-foreground" />
              )}
              {estadoBusca === "encontrada" && (
                <Check className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-primary" />
              )}
              {estadoBusca === "nao_encontrada" && (
                <AlertTriangle className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-amber-600" />
              )}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-muted-foreground">Matrícula (usuário)</label>
            <input
              value={novoUsuario}
              onChange={(e) => setNovoUsuario(e.target.value)}
              disabled={estadoBusca === "buscando"}
              placeholder={estadoBusca === "nao_encontrada" ? "não encontrada — digite manual ou deixe em branco" : ""}
              className={`${CLASSE_CAMPO} w-56 disabled:opacity-50`}
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-muted-foreground">Perfil</label>
            <select value={novoPerfil} onChange={(e) => setNovoPerfil(e.target.value)} className={`${CLASSE_CAMPO} w-44`}>
              {Object.entries(PERFIS).map(([chave, p]) => (
                <option key={chave} value={chave}>{p.nome}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={ocupado === "novo" || estadoBusca === "buscando"}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <Plus className="h-4 w-4" /> Adicionar
          </button>
        </div>
        {rotuloBusca && (
          <p className={`text-[11px] ${estadoBusca === "nao_encontrada" ? "text-amber-700" : "text-muted-foreground"}`}>
            {rotuloBusca}
            {estadoBusca === "nao_encontrada" && " — pode adicionar mesmo assim; fica marcado para tentar de novo depois."}
          </p>
        )}
      </form>

      {Object.entries(PERFIS).map(([chave, perfil]) => {
        const lista = porPerfil[chave] || [];
        const aberto = gruposAbertos[chave] ?? false;
        return (
          <Collapsible
            key={chave}
            open={aberto}
            onOpenChange={(v) => setGruposAbertos((g) => ({ ...g, [chave]: v }))}
            className="overflow-hidden rounded-lg border border-border"
          >
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 bg-muted/40 px-4 py-2.5 text-left transition-colors hover:bg-muted/60">
              <span className="text-[13px] font-semibold text-foreground">
                {perfil.nome}
                <span className="ml-1.5 font-normal text-muted-foreground">({lista.length})</span>
              </span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${aberto ? "rotate-180" : ""}`} />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="divide-y divide-border/60">
                {lista.map((usuario) => (
                  <LinhaUsuario
                    key={usuario}
                    usuario={usuario}
                    pessoa={pessoas[usuario]}
                    rotuloUsuario={rotuloUsuario}
                    atribuicao={atribuicoes[usuario]}
                    atribuicoes={atribuicoes}
                    siglas={siglas}
                    titulares={titulares}
                    ocupado={ocupado}
                    trocarPerfil={trocarPerfil}
                    atualizar={atualizar}
                    vincularAssessor={vincularAssessor}
                    remover={remover}
                    adicionarPerfilExtra={adicionarPerfilExtra}
                    removerPerfilExtra={removerPerfilExtra}
                  />
                ))}
                {lista.length === 0 && (
                  <p className="px-4 py-3 text-[12px] text-muted-foreground">Nenhum usuário com este perfil ainda.</p>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}

      <Collapsible
        open={gruposAbertos.referencia ?? false}
        onOpenChange={(v) => setGruposAbertos((g) => ({ ...g, referencia: v }))}
        className="overflow-hidden rounded-lg border border-border"
      >
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 bg-muted/40 px-4 py-2.5 text-left transition-colors hover:bg-muted/60">
          <span className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
            <Info className="h-3.5 w-3.5 text-muted-foreground" /> O que cada perfil enxerga
          </span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${gruposAbertos.referencia ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul className="space-y-2 px-4 py-3">
            {Object.entries(PERFIS).map(([chave, perfil]) => (
              <li key={chave} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[12.5px]">
                <span className="font-medium text-foreground">{perfil.nome}</span>
                <span className="text-muted-foreground">— {perfil.descricao}</span>
              </li>
            ))}
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function LinhaUsuario({ usuario, pessoa, rotuloUsuario, atribuicao, atribuicoes, siglas, titulares, ocupado, trocarPerfil, atualizar, vincularAssessor, remover, adicionarPerfilExtra, removerPerfilExtra }) {
  const perfil = PERFIS[atribuicao.perfil];
  const unidade = unidadeDoUsuario(usuario, atribuicoes);
  const vinculo = vinculoDoAssessor(usuario, atribuicoes);
  const emOperacao = ocupado === usuario;
  const pendente = !!atribuicao.matriculaPendente;
  const outrosPerfis = atribuicao.outrosPerfis || [];
  const [mostrarForm, setMostrarForm] = React.useState(false);

  return (
    <div className="px-4 py-2.5">
    <div className="flex flex-wrap items-start gap-3">
      <div className="min-w-[12rem] flex-1 basis-56">
        <div className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="font-medium text-foreground">{pessoa?.nome || (pendente ? "Nome não encontrado" : usuario)}</span>
          {pessoa?.cpf && <span className="font-mono text-[11px] text-muted-foreground">{formatarCpf(pessoa.cpf)}</span>}
        </div>
        <div className="flex items-center gap-1.5">
          {!pendente && pessoa?.nome && <span className="text-[11px] text-muted-foreground">Matrícula {usuario}</span>}
          {pendente && (
            <Badge variant="outline" className="gap-1 border-amber-500/50 bg-amber-400/10 px-1.5 py-0 text-[10px] font-medium text-amber-700">
              <AlertTriangle className="h-2.5 w-2.5" /> matrícula não encontrada
            </Badge>
          )}
        </div>
      </div>

      <select
        value={atribuicao.perfil}
        onChange={(e) => trocarPerfil(usuario, e.target.value)}
        disabled={emOperacao}
        className={`${CLASSE_CAMPO} h-8 w-44 text-[12px]`}
      >
        {Object.entries(PERFIS).map(([chave, p]) => (
          <option key={chave} value={chave}>{p.nome}</option>
        ))}
      </select>

      <div className="min-w-[8rem]">
        {perfil?.unidade ? (
          <span className="text-[12px] text-muted-foreground">{perfil.unidade}</span>
        ) : perfil?.exigeTitular ? (
          <span className="text-[12px] text-muted-foreground">{vinculo?.valido ? vinculo.unidade : "—"}</span>
        ) : perfil?.daOme ? (
          <UnidadeDaOme
            atribuicao={atribuicao}
            siglas={siglas}
            disabled={emOperacao}
            onChange={(sigla) => atualizar(usuario, { unidade: sigla || null })}
          />
        ) : (
          <span className="text-[12px] text-muted-foreground">{unidade || "—"}</span>
        )}
      </div>

      <div className="min-w-[9rem] flex-1">
        {perfil?.exigeTitular ? (
          <div className="space-y-1">
            <select
              value={atribuicao.titular || ""}
              onChange={(e) => vincularAssessor(usuario, e.target.value)}
              disabled={emOperacao}
              className={`${CLASSE_CAMPO} h-8 w-44 text-[12px]`}
            >
              <option value="">Selecione o titular…</option>
              {titulares.map((t) => (
                <option key={t} value={t}>
                  {rotuloUsuario(t)}{unidadeDoUsuario(t, atribuicoes) ? ` — ${unidadeDoUsuario(t, atribuicoes)}` : ""}
                </option>
              ))}
            </select>
            {vinculo && !vinculo.valido && (
              <p className="flex items-start gap-1 text-[11px] text-destructive">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                <span>Acesso suspenso: {vinculo.motivo}</span>
              </p>
            )}
          </div>
        ) : null}
      </div>

      {/* Mais de um perfil por usuário (2026-09-25) — perfis adicionais
          como badges removíveis, e o "+" abre o formulário de adicionar
          mais um (ver AdicionarPerfilForm, que mostra o alerta de
          confirmação citando os perfis que este usuário já tem). */}
      <div className="flex min-w-[8rem] flex-wrap items-center gap-1">
        {outrosPerfis.map((p) => (
          <Badge key={p.perfil} variant="outline" className="gap-1 px-1.5 py-0 text-[10px] font-medium">
            {PERFIS[p.perfil]?.nome || p.perfil}
            <button
              type="button"
              onClick={() => removerPerfilExtra(usuario, p.perfil)}
              disabled={emOperacao}
              title={`Remover perfil ${PERFIS[p.perfil]?.nome || p.perfil}`}
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </Badge>
        ))}
        <button
          type="button"
          onClick={() => setMostrarForm((v) => !v)}
          disabled={emOperacao}
          title="Adicionar outro perfil a este usuário"
          className="inline-flex h-6 items-center gap-1 rounded-md border border-dashed border-border px-1.5 text-[10px] font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          <Plus className="h-3 w-3" /> perfil
        </button>
      </div>

      <button
        onClick={() => remover(usuario)}
        disabled={emOperacao}
        title="Remover usuário"
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
    {mostrarForm && (
      <div className="mt-2">
        <AdicionarPerfilForm
          usuario={usuario}
          rotuloUsuario={rotuloUsuario}
          atribuicoes={atribuicoes}
          siglas={siglas}
          titulares={titulares}
          onAdicionar={adicionarPerfilExtra}
          onConcluir={() => setMostrarForm(false)}
        />
      </div>
    )}
    </div>
  );
}

// Formulário compacto de adicionar um perfil A MAIS a um usuário que já tem
// pelo menos um (ver LinhaUsuario > botão "+ perfil"). Mostra o alerta de
// confirmação (pedido de 2026-09-25: "deve aparecer um alerta informando
// do outro perfil deste usuário para confirmar essa dupla atribuição")
// citando os perfis que o usuário já tem, antes de chamar o backend.
function AdicionarPerfilForm({ usuario, rotuloUsuario, atribuicoes, siglas, titulares, onAdicionar, onConcluir }) {
  const [perfilChave, setPerfilChave] = React.useState("TITULAR");
  const [unidade, setUnidade] = React.useState("");
  const [titular, setTitular] = React.useState("");
  const [ocupado, setOcupado] = React.useState(false);
  const [erroLocal, setErroLocal] = React.useState("");

  const info = PERFIS[perfilChave];

  async function confirmarEAdicionar() {
    const existentes = todosPerfisDoUsuario(usuario, atribuicoes).map((p) => PERFIS[p.perfil]?.nome || p.perfil);
    const confirmado = window.confirm(
      `"${rotuloUsuario(usuario)}" já tem o(s) perfil(is): ${existentes.join(", ")}.\n\nAtribuir também "${info?.nome || perfilChave}"?`
    );
    if (!confirmado) return;

    setOcupado(true);
    setErroLocal("");
    try {
      const dados = { perfil: perfilChave };
      if (info?.daOme && unidade) dados.unidade = unidade;
      if (info?.exigeTitular && titular) {
        dados.titular = titular;
        dados.unidadeConcedida = unidadeDoUsuario(titular, atribuicoes);
      }
      await onAdicionar(usuario, dados);
      onConcluir();
    } catch (e) {
      setErroLocal(e.message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-1.5 rounded-md border border-dashed border-border bg-muted/20 p-2">
      <select
        value={perfilChave}
        onChange={(e) => { setPerfilChave(e.target.value); setUnidade(""); setTitular(""); }}
        disabled={ocupado}
        className={`${CLASSE_CAMPO} h-7 w-36 text-[11.5px]`}
      >
        {Object.entries(PERFIS).map(([chave, p]) => (
          <option key={chave} value={chave}>{p.nome}</option>
        ))}
      </select>
      {info?.daOme && (
        <select value={unidade} onChange={(e) => setUnidade(e.target.value)} disabled={ocupado} className={`${CLASSE_CAMPO} h-7 w-32 text-[11.5px]`}>
          <option value="">Unidade…</option>
          {siglas.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      )}
      {info?.exigeTitular && (
        <select value={titular} onChange={(e) => setTitular(e.target.value)} disabled={ocupado} className={`${CLASSE_CAMPO} h-7 w-36 text-[11.5px]`}>
          <option value="">Titular…</option>
          {titulares.map((t) => <option key={t} value={t}>{rotuloUsuario(t)}</option>)}
        </select>
      )}
      <button
        type="button"
        onClick={confirmarEAdicionar}
        disabled={ocupado}
        className="inline-flex h-7 items-center gap-1 rounded-md bg-primary px-2 text-[11px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        <Plus className="h-3 w-3" /> Adicionar
      </button>
      <button
        type="button"
        onClick={onConcluir}
        disabled={ocupado}
        className="inline-flex h-7 items-center rounded-md px-2 text-[11px] text-muted-foreground hover:text-foreground"
      >
        Cancelar
      </button>
      {erroLocal && <p className="w-full text-[10.5px] text-destructive">{erroLocal}</p>}
    </div>
  );
}

// Unidade de um perfil que a herda da OME do usuário. Enquanto a integração
// automática por matrícula não cobre este caminho, o campo é editável e
// sinalizado como provisório — em vez de aparecer vazio sem explicação.
function UnidadeDaOme({ atribuicao, siglas, onChange, disabled }) {
  const resolvida = resolverOmePorCpf();
  if (resolvida) return <span className="text-[12px] text-muted-foreground">{resolvida}</span>;

  return (
    <div className="space-y-1">
      <select
        value={atribuicao.unidade || ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`${CLASSE_CAMPO} h-8 w-40 text-[12px]`}
      >
        <option value="">Selecione…</option>
        {siglas.map((sigla) => (
          <option key={sigla} value={sigla}>{sigla}</option>
        ))}
      </select>
      <p className="text-[10px] text-muted-foreground">provisório</p>
    </div>
  );
}
