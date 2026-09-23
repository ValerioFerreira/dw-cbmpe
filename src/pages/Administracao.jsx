import React from "react";
import { Navigate } from "react-router-dom";
import { ShieldCheck, Plus, Trash2, Check, AlertTriangle, Search } from "lucide-react";
import { useCbmpe } from "@/lib/cbmpe-context";
import { useAuth } from "@/lib/AuthContext";
import { useAcessoUsuario } from "@/lib/useAcessoUsuario";
import {
  PERFIS, lerAtribuicoes, salvarAtribuicoes, senhaEsperada,
  unidadeDoUsuario, vinculoDoAssessor, resolverOmePorCpf,
} from "@/lib/accessControl";
import { resolverPorCpf } from "@/lib/pessoasClient";
import SectionCard from "@/components/ui/section-card";
import OrganogramaEditor from "@/components/admin/OrganogramaEditor";

// Página /adm — atribuição de perfis de acesso.
//
// A lista de usuários vive em localStorage por ora (não há backend). Quando o
// app for para o servidor interno, ela passa a vir da base do CBMPE: o
// usuário entra com CPF e senha, e a OME dele é resolvida pelo CPF. O modelo
// de perfis e esta tela continuam valendo — muda a origem da lista.

const CLASSE_CAMPO =
  "h-9 w-full rounded-md border border-border bg-background px-2.5 text-[13px] " +
  "text-foreground outline-none transition-colors focus:border-primary";

export default function Administracao() {
  const { unidades } = useCbmpe();
  const { user } = useAuth();
  const { ehAdministrador } = useAcessoUsuario();
  // Mesmo padrão de OrganogramaEditor.jsx: só o admin fixo tem token de
  // admin do backend hoje (ver requireAdmin.js) — resolver-cpf exige esse
  // token, então não adianta mandar o token de um login SGU comum.
  const tokenAdmin = user?.role === "admin" ? user?.token : undefined;

  const [atribuicoes, setAtribuicoes] = React.useState(() => lerAtribuicoes());
  const [novoUsuario, setNovoUsuario] = React.useState("");
  const [novoCpf, setNovoCpf] = React.useState("");
  const [resolvendo, setResolvendo] = React.useState(false);
  const [erroResolucao, setErroResolucao] = React.useState(null);
  const [salvo, setSalvo] = React.useState(false);

  // Preenche "Usuário" com a matrícula resolvida pelo CPF — o admin não
  // precisa já saber a matrícula de cor. A chave da atribuição PRECISA ser
  // a matrícula (não um apelido): é o que useAcessoUsuario.js usa como
  // `usuarioChave` pra buscar o perfil de um login SGU real (nivelAcesso =
  // matrícula, ver authClient.js).
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
    } catch (erro) {
      setErroResolucao(erro.message);
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

  function aplicar(proximo) {
    setAtribuicoes(proximo);
    salvarAtribuicoes(proximo);
    setSalvo(true);
    window.setTimeout(() => setSalvo(false), 1800);
  }

  function atualizar(usuario, mudanca) {
    aplicar({ ...atribuicoes, [usuario]: { ...atribuicoes[usuario], ...mudanca } });
  }

  function trocarPerfil(usuario, chavePerfil) {
    const anterior = atribuicoes[usuario] || {};
    // Só sobrevivem à troca de perfil os campos que continuam fazendo sentido.
    // Guardar um titular órfão numa atribuição de DGP, ou uma unidade num
    // perfil de acesso total, confundiria quem lesse a lista depois.
    aplicar({
      ...atribuicoes,
      [usuario]: { perfil: chavePerfil, cpf: anterior.cpf },
    });
  }

  function vincularAssessor(usuario, titular) {
    // A OME concedida é gravada no momento do vínculo: é ela que permite
    // detectar depois que o titular foi transferido, comparando com a OME
    // atual dele. Sem isso, o assessor continuaria acessando a unidade nova
    // do titular, que não foi o que ele autorizou.
    aplicar({
      ...atribuicoes,
      [usuario]: {
        ...atribuicoes[usuario],
        titular: titular || undefined,
        unidadeConcedida: titular ? unidadeDoUsuario(titular, atribuicoes) : undefined,
      },
    });
  }

  function remover(usuario) {
    const proximo = { ...atribuicoes };
    delete proximo[usuario];
    // Assessor sem titular fica sem acesso, mas a linha continua na lista com
    // o motivo visível — apagar em silêncio esconderia o efeito colateral.
    aplicar(proximo);
  }

  function adicionar(evento) {
    evento.preventDefault();
    const chave = novoUsuario.trim().toUpperCase();
    if (!chave || atribuicoes[chave]) return;
    aplicar({
      ...atribuicoes,
      [chave]: { perfil: "TITULAR", cpf: novoCpf.trim() || undefined },
    });
    setNovoUsuario("");
    setNovoCpf("");
  }

  const usuarios = Object.keys(atribuicoes).sort((a, b) => a.localeCompare(b, "pt-BR"));

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
        {salvo && (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/8 px-2.5 py-1 text-[12px] font-medium text-primary">
            <Check className="h-3.5 w-3.5" /> Salvo
          </span>
        )}
      </header>

      <OrganogramaEditor />

      <SectionCard
        titulo="Usuários"
        subtitulo="A unidade vem da OME do usuário, resolvida pelo CPF"
        acoes={
          <div className="space-y-1.5">
            <form onSubmit={adicionar} className="flex flex-wrap items-center gap-2">
              <input
                value={novoCpf}
                onChange={(e) => setNovoCpf(e.target.value)}
                placeholder="CPF"
                inputMode="numeric"
                className={`${CLASSE_CAMPO} w-36`}
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
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
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
          <table className="w-full min-w-[900px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-2.5 font-medium">Usuário</th>
                <th className="px-5 py-2.5 font-medium">CPF</th>
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
                return (
                  <tr key={usuario} className="border-b border-border/60 align-top last:border-0">
                    <td className="px-5 py-2.5">
                      <div className="font-medium text-foreground">{usuario}</div>
                      <div className="font-mono text-[11px] text-muted-foreground">
                        {senhaEsperada(usuario)}
                      </div>
                    </td>
                    <td className="px-5 py-2.5">
                      <input
                        value={atribuicao.cpf || ""}
                        onChange={(e) => atualizar(usuario, { cpf: e.target.value || undefined })}
                        placeholder="—"
                        inputMode="numeric"
                        className={`${CLASSE_CAMPO} w-36`}
                      />
                    </td>
                    <td className="px-5 py-2.5">
                      <select
                        value={atribuicao.perfil}
                        onChange={(e) => trocarPerfil(usuario, e.target.value)}
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
                          onChange={(sigla) => atualizar(usuario, { unidade: sigla || undefined })}
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
                        title="Remover usuário"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {usuarios.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">
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
          do usuário, resolvida pelo CPF junto à base do CBMPE. Enquanto essa
          integração não existe, o campo pode ser preenchido à mão e fica
          marcado como provisório.
        </p>
        <p>
          As atribuições ficam gravadas neste navegador enquanto o app não tem
          backend. A verificação de acesso também roda no navegador, e o dado
          que alimenta o app é servido junto com ele: isto organiza a
          interface, não protege o dado.
        </p>
      </div>
    </div>
  );
}

// Unidade de um perfil que a herda da OME do usuário. Enquanto a integração
// com a base do CBMPE não existe, o campo é editável e sinalizado como
// provisório — em vez de aparecer vazio sem explicação.
function UnidadeDaOme({ atribuicao, siglas, onChange }) {
  const resolvida = resolverOmePorCpf(atribuicao.cpf);
  if (resolvida) return <span className="text-muted-foreground">{resolvida}</span>;

  return (
    <div className="space-y-1">
      <select
        value={atribuicao.unidade || ""}
        onChange={(e) => onChange(e.target.value)}
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
