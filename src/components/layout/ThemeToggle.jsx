import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const atual = mounted ? resolvedTheme || theme : "light";
  const escuro = atual === "dark";

  const label = escuro ? "Alternar para modo claro" : "Alternar para modo escuro";

  return (
    <button
      type="button"
      onClick={() => setTheme(escuro ? "light" : "dark")}
      aria-label={label}
      title={label}
      className="inline-flex h-11 w-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-border bg-card text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-10 lg:w-auto lg:flex-row lg:gap-1.5 lg:px-3 lg:py-2.5"
    >
      {escuro ? <Sun className="h-4 w-4 shrink-0" /> : <Moon className="h-4 w-4 shrink-0" />}
      <span className="text-[8px] font-medium leading-none lg:hidden">{escuro ? "Claro" : "Escuro"}</span>
      <span className="hidden whitespace-nowrap lg:inline">{label}</span>
    </button>
  );
}