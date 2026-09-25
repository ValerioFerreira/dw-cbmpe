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

      {/* Título fixo (não rola com o conteúdo) + corpo com scroll próprio —
          pedido de 2026-09-25: com header+corpo na mesma caixa rolável
          (overflow-y-auto direto no DialogContent), o título e o X de
          fechar rolavam pra fora da vista assim que um nível era expandido
          e o conteúdo passava de max-h-[85vh]. */}
      <Dialog open={modalAberto === "organograma"} onOpenChange={(v) => setModalAberto(v ? "organograma" : null)}>
        <DialogContent className="flex max-h-[85vh] w-full max-w-3xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
            <DialogTitle>Editar Organograma</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto px-6 py-4">
            <OrganogramaEditor />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={modalAberto === "usuarios"} onOpenChange={(v) => setModalAberto(v ? "usuarios" : null)}>
        <DialogContent className="flex max-h-[85vh] w-full max-w-3xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
            <DialogTitle>Usuários</DialogTitle>
            <DialogDescription>A unidade vem da OME do usuário, resolvida pela matrícula.</DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto px-6 py-4">
            <UsuariosEditor />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
