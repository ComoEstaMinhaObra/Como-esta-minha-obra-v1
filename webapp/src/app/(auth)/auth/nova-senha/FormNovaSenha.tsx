"use client";

import { useEffect, useState } from "react";
import { Botao, CampoTexto, useToast } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

export function FormNovaSenha() {
  const { toast } = useToast();
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [temSessao, setTemSessao] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setTemSessao(true);
      } else {
        window.location.assign("/entrar?erro=auth");
      }
    });
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (senha !== confirmacao) {
      toast("As senhas não coincidem.");
      return;
    }
    setCarregando(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) {
        toast(
          error.message.includes("should be different")
            ? "A nova senha precisa ser diferente da atual."
            : error.message,
        );
        return;
      }
      window.location.assign("/auth/callback");
    } finally {
      setCarregando(false);
    }
  }

  if (temSessao === null) {
    return null;
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5">
      <div className="space-y-2 text-center">
        <h1 className="font-serif text-3xl font-light">Definir nova senha</h1>
        <p className="text-sm text-cinza-2">
          Escolha uma nova senha para a sua conta.
        </p>
      </div>
      <CampoTexto
        rotulo="Nova senha"
        type="password"
        required
        minLength={6}
        autoComplete="new-password"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        placeholder="Mínimo 6 caracteres"
      />
      <CampoTexto
        rotulo="Confirmar senha"
        type="password"
        required
        minLength={6}
        autoComplete="new-password"
        value={confirmacao}
        onChange={(e) => setConfirmacao(e.target.value)}
        placeholder="Repita a nova senha"
      />
      <Botao type="submit" className="w-full" disabled={carregando}>
        {carregando ? "Salvando…" : "Salvar nova senha"}
      </Botao>
    </form>
  );
}
