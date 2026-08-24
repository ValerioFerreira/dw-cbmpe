import React from "react";
import { Navigate } from "react-router-dom";
import { ShieldCheck, Plus, Trash2, Check } from "lucide-react";
import { useCbmpe } from "@/lib/cbmpe-context";
import { useAcessoUsuario } from "@/lib/useAcessoUsuario";
import {
  PERFIS, lerAtribuicoes, salvarAtribuicoes, senhaEsperada,
} from "@/lib/accessControl";
import SectionCard from "@/components/ui/section-card";

// Página /adm — atribuição de perfis de acesso.
//
// Por ora a lista de usuários vive em localStorage (não há backend). Quando o
// app for para o servidor interno, ela passa a vir da base de usuários do
// CBMPE: o que muda é a origem da lista e a persistência, não o modelo de
// perfis nem esta tela.

const CLASSE_CAMPO =
  "h-9 w-full rounded-md border border-border bg-background px-2.5 text-[13px] " +
  "text-foreground outline-none transition-colors focus:border-primary";

export default function Administracao() {
  const { unidades } = useCbmpe();
  const { ehAdministrador } = useAcessoUsuario();

  const [atribuicoes, setAtribuicoes] = React.useState(() => lerAtribuicoes());
  const [novoUsuario, setNovoUsuario] = React.useState("");
  const [salvo, setSalvo] = React.useState(false);

  const siglas = React.useMemo(
    () => unidades.map((u) => u.sigla).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [unidades]
  );

  if (!ehAdministrador) return <Navigate to="/organograma" replace />;

  function aplicar(proximo) {
    setAtribuicoes(proximo);
    salvarAtribuicoes(proximo);
    setSalvo(true);
    window.setTimeout(() => setSalvo(false), 1800);
  }

  function trocarPerfil(usuario, chavePerfil) {
    const perfil = PERFIS[chavePerfil];
    const atual = atribuicoes[usuario] || {};
    aplicar({
      ...atribuicoes,
      // Unidade só faz sentido no perfil Titular — nos demais ela é fixa (DGP,
      // DLog, DF) ou irrelevante (acesso total). Guardar uma unidade órfã
      // confundiria quem lesse a lista depois.
      [usuario]: {
        perfil: chavePerfil,
        ...(perfil?.exigeUnidade ? { unidade: atual.unidade } : {}),
      },
    });
  }

  function trocarUnidade(usuario, sigla) {
    aplicar({
      ...atribuicoes,
      [usuario]: { ...atribuicoes[usuario], unidade: sigla || undefined },
    });
  }

  function remover(usuario) {
    const proximo = { ...atribuicoes };
    delete proximo[usuario];
    aplicar(proximo);
  }

  function adicionar(evento) {
    evento.preventDefault();
    const chave = novoUsuario.trim().toUpperCase();
    if (!chave || atribuicoes[chave]) return;
    aplicar({ ...atribuicoes, [chave]: { perfil: "TITULAR", unidade: undefined } });
    setNovoUsuario("");
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

      <SectionCard
        titulo="Usuários"
        subtitulo="A senha do protótipo é o usuário em maiúsculo seguido de @GSG"
        acoes={
          <form onSubmit={adicionar} className="flex items-center gap-2">
            <input
              value={novoUsuario}
              onChange={(e) => setNovoUsuario(e.target.value)}
              placeholder="Novo usuário"
              className={`${CLASSE_CAMPO} w-40`}
            />
            <button
              type="submit"
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> Adicionar
            </button>
          </form>
        }
        semPadding
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-2.5 font-medium">Usuário</th>
                <th className="px-5 py-2.5 font-medium">Perfil</th>
                <th className="px-5 py-2.5 font-medium">Unidade</th>
                <th className="px-5 py-2.5 font-medium">Senha</th>
                <th className="px-5 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {usuarios.map((usuario) => {
                const atribuicao = atribuicoes[usuario];
                const perfil = PERFIS[atribuicao.perfil];
                const unidadeFixa = perfil?.unidade;
                return (
                  <tr key={usuario} className="border-b border-border/60 last:border-0">
                    <td className="px-5 py-2.5 font-medium text-foreground">{usuario}</td>
                    <td className="px-5 py-2.5">
                      <select
                        value={atribuicao.perfil}
                        onChange={(e) => trocarPerfil(usuario, e.target.value)}
                        className={CLASSE_CAMPO}
                      >
                        {Object.entries(PERFIS).map(([chave, p]) => (
                          <option key={chave} value={chave}>{p.nome}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-2.5">
                      {perfil?.exigeUnidade ? (
                        <select
                          value={atribuicao.unidade || ""}
                          onChange={(e) => trocarUnidade(usuario, e.target.value)}
                          className={CLASSE_CAMPO}
                        >
                          <option value="">Selecione…</option>
                          {siglas.map((sigla) => (
                            <option key={sigla} value={sigla}>{sigla}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-muted-foreground">{unidadeFixa || "—"}</span>
                      )}
                    </td>
                    <td className="px-5 py-2.5 font-mono text-[12px] text-muted-foreground">
                      {senhaEsperada(usuario)}
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

      <p className="text-[12px] leading-relaxed text-muted-foreground">
        As atribuições ficam gravadas neste navegador enquanto o app não tem
        backend. Quando ele for para o servidor interno, a lista passa a vir da
        base de usuários do CBMPE — o modelo de perfis e esta tela continuam
        valendo. Vale lembrar que a verificação de acesso roda no navegador e o
        dado que alimenta o app é servido junto com ele: isto organiza a
        interface, não protege o dado.
      </p>
    </div>
  );
}
