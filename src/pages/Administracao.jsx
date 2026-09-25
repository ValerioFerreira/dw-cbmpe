import React from "react";
import { Navigate } from "react-router-dom";
import { ShieldCheck, Network, Users } from "lucide-react";
import { useAcessoUsuario } from "@/lib/useAcessoUsuario";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import OrganogramaEditor from "@/components/admin/OrganogramaEditor";
import UsuariosEditor from "@/components/admin/UsuariosEditor";

// Página /adm — redesenhada em 2026-09-25: as duas telas de edição
// (organograma, usuários) eram tabelas sempre expandidas empilhadas na
// página, e cada uma sozinha já ocupava mais altura que a tela — com ~46
// unidades e um número crescente de usuários, virou inviável de navegar.
// Agora a página é só os dois seletores (cartões) abaixo; cada edição
// abre num modal por cima, e o conteúdo de cada modal vem agrupado
// (unidades por nível, usuários por perfil — ver OrganogramaEditor.jsx/
// UsuariosEditor.jsx), retraído por padrão.

function SeletorCard({ icone: Icone, titulo, subtitulo, onClick }) {
  return (
    <button
      onClick={onClick}
      className="group flex items-start gap-4 rounded-xl border border-border bg-card p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary transition-colors group-hover:bg-primary/14">
        <Icone className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-display text-[15px] font-semibold tracking-tight text-foreground">{titulo}</h3>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{subtitulo}</p>
      </div>
    </button>
  );
}

// Modal de edição com título fixo e corpo rolável. Duas garantias (pedido de
// 2026-09-25 — "o modal cresce muito verticalmente [...] fique do mesmo
// tamanho que fica quando não tem nenhum perfil estendido"):
//  - teto de 85% da janela DE VERDADE: o html tem zoom (ver index.css), e
//    em Chrome `85vh` dentro dele vira 85vh × zoom — o antigo max-h-[85vh]
//    já passava da janela. Dividir por --app-zoom corrige.
//  - altura TRAVADA no tamanho com que o modal abre (tudo recolhido): o
//    corpo é medido logo depois de montar e fixado nessa altura; expandir
//    um grupo só rola o corpo, nunca estica o modal.
function ModalEdicao({ aberto, onFechar, titulo, descricao, children }) {
  const corpoRef = React.useRef(null);
  const [alturaCorpo, setAlturaCorpo] = React.useState(null);

  React.useLayoutEffect(() => {
    if (!aberto) {
      setAlturaCorpo(null);
      return undefined;
    }
    // rAF: espera o Radix montar o portal e o conteúdo inicial pintar.
    const id = window.requestAnimationFrame(() => {
      if (corpoRef.current) setAlturaCorpo(corpoRef.current.offsetHeight);
    });
    return () => window.cancelAnimationFrame(id);
  }, [aberto]);

  return (
    <Dialog open={aberto} onOpenChange={(v) => { if (!v) onFechar(); }}>
      <DialogContent className="flex max-h-[calc(85vh/var(--app-zoom))] w-full max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
          <DialogTitle>{titulo}</DialogTitle>
          {descricao && <DialogDescription>{descricao}</DialogDescription>}
        </DialogHeader>
        <div
          ref={corpoRef}
          style={alturaCorpo ? { height: alturaCorpo } : undefined}
          className="min-h-0 overflow-y-auto px-6 py-4"
        >
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Administracao() {
  const { ehAdministrador } = useAcessoUsuario();
  const [modalAberto, setModalAberto] = React.useState(null); // "organograma" | "usuarios" | null

  if (!ehAdministrador) return <Navigate to="/organograma" replace />;

  return (
    <div className="space-y-5 animate-fade-in">
      <header className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/8 text-primary">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight text-foreground">
            Administração
          </h1>
          <p className="text-[12px] text-muted-foreground">
            Estrutura do organograma e atribuição de níveis de acesso
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SeletorCard
          icone={Network}
          titulo="Organograma"
          subtitulo="Subordinação, sigla, criação e exclusão de unidades (OMEs) — agrupadas por nível hierárquico."
          onClick={() => setModalAberto("organograma")}
        />
        <SeletorCard
          icone={Users}
          titulo="Usuários"
          subtitulo="Atribuição de perfil de acesso por matrícula — agrupados por perfil, com resolução automática por CPF."
          onClick={() => setModalAberto("usuarios")}
        />
      </div>

      <ModalEdicao
        aberto={modalAberto === "organograma"}
        onFechar={() => setModalAberto(null)}
        titulo="Editar Organograma"
      >
        <OrganogramaEditor />
      </ModalEdicao>

      <ModalEdicao
        aberto={modalAberto === "usuarios"}
        onFechar={() => setModalAberto(null)}
        titulo="Usuários"
        descricao="A unidade vem da OME do usuário, resolvida pela matrícula."
      >
        <UsuariosEditor />
      </ModalEdicao>
    </div>
  );
}
