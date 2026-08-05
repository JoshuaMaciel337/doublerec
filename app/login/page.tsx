"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const ERROR_MESSAGES: Record<string, string> = {
  "Invalid login credentials": "E-mail ou senha incorretos.",
  "Email not confirmed": "E-mail ainda não confirmado. Verifique sua caixa de entrada.",
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(
        ERROR_MESSAGES[signInError.message] ??
          "Não foi possível entrar. Tente novamente.",
      );
      setLoading(false);
      return;
    }

    // navegação completa para o proxy reavaliar a sessão pelos cookies
    window.location.assign("/");
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-black px-4 text-zinc-100">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-red-500/15 ring-1 ring-red-500/30">
            <span className="h-5 w-5 rounded-full bg-red-500" />
          </div>
          <h1 className="text-xl font-semibold tracking-wide">
            DoubleRec Studio
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Grave uma vez. Publique em qualquer lugar.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-3xl bg-zinc-900 p-6 ring-1 ring-white/10"
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
              E-mail
            </span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
              className="w-full rounded-lg bg-white/8 px-3 py-2.5 text-sm text-zinc-100 outline-none ring-1 ring-white/10 placeholder:text-zinc-500 focus:ring-white/40"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
              Senha
            </span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg bg-white/8 px-3 py-2.5 text-sm text-zinc-100 outline-none ring-1 ring-white/10 placeholder:text-zinc-500 focus:ring-white/40"
            />
          </label>

          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400 ring-1 ring-red-500/20">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-zinc-200 disabled:opacity-50"
          >
            {loading && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" />
            )}
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-zinc-500">
          Acesso restrito. Solicite suas credenciais ao administrador.
        </p>
      </div>
    </div>
  );
}
