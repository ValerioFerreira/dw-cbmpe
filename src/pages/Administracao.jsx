import React from "react";
import { Navigate } from "react-router-dom";
import { ShieldCheck, Plus, Trash2, Check, AlertTriangle, Search } from "lucide-react";
import { useCbmpe } from "@/lib/cbmpe-context";
import { useAcessoUsuario } from "@/lib/useAcessoUsuario";
import {
  PERFIS, unidadeDoUsuario, vinculoDoAssessor, resolverOmePorCpf, senhaEsperada,
} from "@/lib/accessControl";
import { definirAtribuicao, removerAtribuicao } from "@/lib/atribuicoesClient";
import { resolverPorCpf } from "@/lib/pessoasClient";
import SectionCard from "@/components/ui/section-card";
import OrganogramaEditor from "@/components/admin/OrganogramaEditor";

// Página /adm — atribuição de perfis de acesso.
//
// As atribuições vivem no backend desde 2026-09-23 (ver
// backend/services/atribuicoesService.js, migrado de localStorage): uma
// atribuição feita aqui precisa valer quando o usuário atribuído logar no
// PRÓPRIO navegador dele, não só no navegador de quem atribuiu — e é o que
// dá ao backend (requireAdmin.js) visibilidade real de quem tem perfil
// ADMINISTRADOR, permitindo que esses usuários também editem organograma e
// outras atribuições, não só o login administrativo fixo.

const CLASSE_CAMPO =
  "h-9 w-full rounded-md border border-border bg-background px-2.5 text-[13px] " +
  "text-foreground outline-none transition-colors focus:border-primary";

export default function Administracao() {
  const { unidades, atribuicoes, recarregar } = useCbmpe();
  const { ehAdministrador, tokenAdmin, restrito } = useAcessoUsuario();

  const [novoUsuario, setNovoUsuario] = React.useState("");
  const [novoCpf, setNovoCpf] = React.useState("");
  const [resolvendo, setResolvendo] = React.useState(false);
  const [erroResolucao, setErroResolucao] = React.useState(null);
  const [ocupado, setOcupado] = React.useState(null); // usuário em operação, ou "novo"
  const [erro, setErro] = React.useState("");
  const [ok, setOk] = React.useState("");

  // Preenche "Usuário" com a matrícula resolvida pelo CPF — o admin não
  // precisa já saber a matrícula de cor. O CPF em si nunca é gravado na
  // atribuição (nem aqui, nem no backend) — só serve pra descobrir a
  // matrícula, que é a chave de verdade (nivelAcesso = matrícula num login
  // SGU real, ver authClient.js).
  async function resolverUsuarioPorCpf() {
    const cpfLimpo = novoCpf.trim();
    if (!cpfLimpo) return;
    setResolvendo(true);
    setErroResolucao(null);
    try {
      const { matricula, ome } = await resolverPorCpf(cpfLimpo, tokenAdmin);
      if (!matricula) {
        setErroResolucao("CPF não encontrado no SGP.");
        return;
      }
      setNovoUsuario(matricula);
      if (!ome) {
        setErroResolucao(`Matrícula ${matricula} resolvida, mas sem OME atual no DW (efetivo inativo ou não carregado).`);
      }
    } catch (erroResolver) {
      setErroResolucao(erroResolver.message);
    } finally {
      setResolvendo(false);
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

  if (!ehAdministrador) return <Navigate to="/organograma" replace />;

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

  // Ponto único de escrita: sempre manda `perfil` (o backend precisa dele
  // pra decidir quais outros campos sobrevivem — ver atribuicoesService.js)
  // — se não veio em `dados`, usa o perfil atual do usuário.
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
    // Só o perfil — o backend descarta sozinho os campos que não fazem mais
    // sentido pro perfil novo (ex. um `titular` órfão numa atribuição de
    // DGP), mesma regra de antes.
    aplicar(usuario, { perfil: chavePerfil }, `Perfil de "${usuario}" alterado.`);
  }

  function vincularAssessor(usuario, titular) {
    // A OME concedida é gravada no momento do vínculo: é ela que permite
    // detectar depois que o titular foi transferido, comparando com a OME
    // atual dele.
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

  async function adicionar(evento) {
    evento.preventDefault();
    const chave = novoUsuario.trim().toUpperCase();
    if (!chave || atribuicoes[chave]) return;
    setOcupado("novo");
    try {
      await definirAtribuicao(chave, { perfil: "TITULAR" }, tokenAdmin);
      await recarregar();
      confirmarOk(`"${chave}" adicionado.`);
      setNovoUsuario("");
      setNovoCpf("");
    } catch (e) {
      avisar(e.message);
    } finally {
      setOcupado(null);
    }
  }

  const usuarios = Object.keys(atribuicoes).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const semToken = !tokenAdmin;

  return (
    <div className="space-y-5 animate-fade-in">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/8 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold tracking-tight text-foreground">
              Administração
            </h1>
            <p className="text-[12px] text-muted-foreground">
              Atribuição de níveis de acesso aos usuários
            </p>
          </div>
        </div>
        {ok && (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/8 px-2.5 py-1 text-[12px] font-medium text-primary">
            <Check className="h-3.5 w-3.5" /> {ok}
          </span>
        )}
      </header>

      {semToken && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-[12px] text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {restrito
              ? "Sessão sem token de administrador do backend — a edição só funciona logado com CPF real (SGU), não com o login de demonstração."
              : "Sessão sem token de administrador do backend — confira se o backend está no ar e se VITE_AUTH_API_URL está configurado, depois saia e entre novamente."}
          </span>
        </div>
      )}
      {erro && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-[12px] text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {erro}
        </div>
      )}

      <OrganogramaEditor />

      <SectionCard
        titulo="Usuários"
        subtitulo="A unidade vem da OME do usuário, resolvida pela matrícula"
        acoes={
          <div className="space-y-1.5">
            <form onSubmit={adicionar} className="flex flex-wrap items-center gap-2">
              <input
                value={novoCpf}
                onChange={(e) => setNovoCpf(e.target.value)}
                placeholder="CPF (só pra resolver a matrícula)"
                inputMode="numeric"
                className={`${CLASSE_CAMPO} w-52`}
              />
              <button
                type="button"
                onClick={resolverUsuarioPorCpf}
                disabled={resolvendo || !novoCpf.trim()}
                title="Resolver matrícula e OME a partir do CPF"
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
              >
                <Search className="h-3.5 w-3.5" /> {resolvendo ? "Resolvendo…" : "Resolver"}
              </button>
              <input
                value={novoUsuario}
                onChange={(e) => setNovoUsuario(e.target.value)}
                placeholder="Matrícula (usuário)"
                className={`${CLASSE_CAMPO} w-36`}
              />
              <button
                type="submit"
                disabled={ocupado === "novo"}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                <Plus className="h-4 w-4" /> Adicionar
              </button>
            </form>
            {erroResolucao && (
              <p className="text-[11px] text-muted-foreground">{erroResolucao}</p>
            )}
          </div>
        }
        semPadding
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-2.5 font-medium">Usuário</th>
                <th className="px-5 py-2.5 font-medium">Perfil</th>
                <th className="px-5 py-2.5 font-medium">Unidade</th>
                <th className="px-5 py-2.5 font-medium">Vínculo</th>
                <th className="px-5 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {usuarios.map((usuario) => {
                const atribuicao = atribuicoes[usuario];
                const perfil = PERFIS[atribuicao.perfil];
                const unidade = unidadeDoUsuario(usuario, atribuicoes);
                const vinculo = vinculoDoAssessor(usuario, atribuicoes);
                const emOperacao = ocupado === usuario;
                return (
                  <tr key={usuario} className="border-b border-border/60 align-top last:border-0">
                    <td className="px-5 py-2.5">
                      <div className="font-medium text-foreground">{usuario}</div>
                      <div className="font-mono text-[11px] text-muted-foreground">
                        {senhaEsperada(usuario)}
                      </div>
                    </td>
                    <td className="px-5 py-2.5">
                      <select
                        value={atribuicao.perfil}
                        onChange={(e) => trocarPerfil(usuario, e.target.value)}
                        disabled={emOperacao}
                        className={`${CLASSE_CAMPO} w-56`}
                      >
                        {Object.entries(PERFIS).map(([chave, p]) => (
                          <option key={chave} value={chave}>{p.nome}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-2.5">
                      {perfil?.unidade ? (
                        <span className="text-muted-foreground">{perfil.unidade}</span>
                      ) : perfil?.exigeTitular ? (
                        <span className="text-muted-foreground">
                          {vinculo?.valido ? vinculo.unidade : "—"}
                        </span>
                      ) : perfil?.daOme ? (
                        <UnidadeDaOme
                          atribuicao={atribuicao}
                          siglas={siglas}
                          disabled={emOperacao}
                          onChange={(sigla) => atualizar(usuario, { unidade: sigla || null })}
                        />
                      ) : (
                        <span className="text-muted-foreground">{unidade || "—"}</span>
                      )}
                    </td>
                    <td className="px-5 py-2.5">
                      {perfil?.exigeTitular ? (
                        <div className="space-y-1">
                          <select
                            value={atribuicao.titular || ""}
                            onChange={(e) => vincularAssessor(usuario, e.target.value)}
                            disabled={emOperacao}
                            className={`${CLASSE_CAMPO} w-44`}
                          >
                            <option value="">Selecione o titular…</option>
                            {titulares.map((t) => (
                              <option key={t} value={t}>
                                {t}{unidadeDoUsuario(t, atribuicoes) ? ` — ${unidadeDoUsuario(t, atribuicoes)}` : ""}
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
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <button
                        onClick={() => remover(usuario)}
                        disabled={emOperacao}
                        title="Remover usuário"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {usuarios.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">
                    Nenhum usuário cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard titulo="O que cada perfil enxerga">
        <ul className="space-y-2.5">
          {Object.entries(PERFIS).map(([chave, perfil]) => (
            <li key={chave} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-[13px] font-medium text-foreground">{perfil.nome}</span>
              <span className="text-[13px] text-muted-foreground">— {perfil.descricao}</span>
            </li>
          ))}
        </ul>
      </SectionCard>

      <div className="space-y-2 text-[12px] leading-relaxed text-muted-foreground">
        <p>
          <strong className="text-foreground">Assessor.</strong> O fluxo é: o
          administrador dá o perfil de Titular a um militar; esse titular pede
          um ou mais assessores e informa quem são; o administrador cria cada
          um vinculado a ele. O acesso do assessor vale enquanto aquele titular
          continuar titular da mesma OME — se ele for transferido ou perder o
          perfil, o acesso do assessor cai sozinho, sem depender de alguém
          lembrar de revogar.
        </p>
        <p>
          <strong className="text-foreground">Unidade.</strong> Ela vem da OME
          do usuário, resolvida pela matrícula junto ao data warehouse quando
          ele loga pelo SGU real. Enquanto o usuário não tem essa integração
          (login de demonstração), o campo pode ser preenchido à mão e fica
          marcado como provisório.
        </p>
        <p>
          As atribuições ficam gravadas no backend — um usuário atribuído
          como Administrador consegue editar organograma e outras
          atribuições a partir do próprio login dele (com CPF real via SGU),
          não só quem atribuiu. A verificação de acesso de VISUALIZAÇÃO
          ainda roda no navegador: organiza a interface, não é, por si só,
          controle de acesso ao dado.
        </p>
      </div>
    </div>
  );
}

// Unidade de um perfil que a herda da OME do usuário. Enquanto a integração
// automática por matrícula não cobre este caminho, o campo é editável e
// sinalizado como provisório — em vez de aparecer vazio sem explicação.
function UnidadeDaOme({ atribuicao, siglas, onChange, disabled }) {
  const resolvida = resolverOmePorCpf();
  if (resolvida) return <span className="text-muted-foreground">{resolvida}</span>;

  return (
    <div className="space-y-1">
      <select
        value={atribuicao.unidade || ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`${CLASSE_CAMPO} w-40`}
      >
        <option value="">Selecione…</option>
        {siglas.map((sigla) => (
          <option key={sigla} value={sigla}>{sigla}</option>
        ))}
      </select>
      <p className="text-[11px] text-muted-foreground">provisório — aguarda o CPF</p>
    </div>
  );
}
