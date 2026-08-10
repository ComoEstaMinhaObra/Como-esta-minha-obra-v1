"use client";

import { useState } from "react";
import { Botao, CampoTexto, useToast } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { publicEnv } from "@/config/env";

export function FormEntrar() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [carregando, setCarregando] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${publicEnv.NEXT_PUBLIC_APP_URL}/auth/callback`,
        },
      });
      if (error) {
        toast(error.message);
        return;
      }
      setEnviado(true);
    } finally {
      setCarregando(false);
    }
  }

  if (enviado) {
    return (
      <div className="space-y-3 text-center">
        <h1 className="font-serif text-3xl font-light">Verifique seu e-mail</h1>
        <p className="text-sm text-cinza-2">
          Enviamos um link de acesso para <strong className="text-tinta">{email}</strong>.
          Abra o e-mail e toque no link para entrar.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5">
      <div className="space-y-2 text-center">
        <h1 className="font-serif text-3xl font-light">Entrar</h1>
        <p className="text-sm text-cinza-2">
          Receba um link mágico no seu e-mail — sem senha.
        </p>
      </div>
      <CampoTexto
        rotulo="E-mail"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="voce@empresa.com"
      />
      <Botao type="submit" className="w-full" disabled={carregando}>
        {carregando ? "Enviando…" : "Entrar"}
      </Botao>
    </form>
  );
}
