import React, { useState } from "react";
import { auth } from "@/lib/authClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, User, Lock, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { safeReturnTo } from "@/lib/authReturnTo";

// Máscara de CPF. Desde 2026-09-25 o login é SÓ por CPF (SGU) — o admin
// fixo e os usuários de demonstração foram removidos (ver authClient.js).
// SO_CPF continua deixando passar texto não numérico sem reescrever (quem
// digitar letras recebe o erro de CPF inválido do authClient, em vez de ver
// o campo "comer" o que digitou).
const SO_CPF = /^[\d.\s-]*$/;

export function mascararCpf(valor) {
  if (!SO_CPF.test(valor)) return valor;
  const d = valor.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** O que vai para o autenticador: CPF sem máscara, qualquer outra coisa
 *  como foi digitada. */
function usuarioParaEnvio(valor) {
  return SO_CPF.test(valor) && /\d/.test(valor) ? valor.replace(/\D/g, "") : valor;
}

export default function Login() {
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Post-login destination (e.g. the MCP OAuth consent page sends users here
  // with returnTo so the grant flow can resume). Same-origin paths only.
  const returnTo = safeReturnTo();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await auth.loginViaEmailPassword(usuarioParaEnvio(usuario), senha);
      window.location.href = returnTo;
    } catch (err) {
      setError(err.message || "Usuário ou senha inválidos");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      icon={LogIn}
      title="Bem-vindo"
      subtitle="Entre com seu CPF e a senha do SGU"
    >
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="usuario">CPF</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="usuario"
              type="text"
              autoComplete="username"
              inputMode="numeric"
              autoFocus
              placeholder="Insira seu CPF"
              value={usuario}
              onChange={(e) => setUsuario(mascararCpf(e.target.value))}
              className="pl-10 h-12 placeholder:text-muted-foreground/60"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="senha">Senha</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="senha"
              type="password"
              autoComplete="current-password"
              placeholder="Insira sua senha"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="pl-10 h-12 placeholder:text-muted-foreground/60"
              required
            />
          </div>
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Entrando...
            </>
          ) : (
            "Entrar"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
