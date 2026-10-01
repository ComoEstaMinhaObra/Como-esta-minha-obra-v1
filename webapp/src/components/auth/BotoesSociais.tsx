"use client";

import { useState } from "react";
import { Botao, useToast } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

type Provedor = "google" | "azure";

function LogoGoogle() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5Z"
      />
      <path
        fill="#4285F4"
        d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5Z"
      />
      <path
        fill="#FBBC05"
        d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1Z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48Z"
      />
    </svg>
  );
}

function LogoMicrosoft() {
  return (
    <svg width="18" height="18" viewBox="0 0 23 23" aria-hidden="true">
      <path fill="#F25022" d="M1 1h10v10H1z" />
      <path fill="#7FBA00" d="M12 1h10v10H12z" />
      <path fill="#00A4EF" d="M1 12h10v10H1z" />
      <path fill="#FFB900" d="M12 12h10v10H12z" />
    </svg>
  );
}

export function BotoesSociais({
  redirectTo,
  desabilitado = false,
}: {
  redirectTo: string;
  desabilitado?: boolean;
}) {
  const { toast } = useToast();
  const [iniciando, setIniciando] = useState<Provedor | null>(null);

  async function entrarCom(provedor: Provedor) {
    setIniciando(provedor);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: provedor,
      options: {
        redirectTo,
        // O Azure só devolve o e-mail se o escopo for pedido explicitamente.
        ...(provedor === "azure" ? { scopes: "email" } : {}),
      },
    });
    if (error) {
      toast("Não foi possível iniciar o login. Tente novamente.");
      setIniciando(null);
    }
    // Sem erro, o navegador já está indo para o provedor.
  }

  const bloqueado = desabilitado || iniciando !== null;

  return (
    <div className="space-y-3">
      <Botao
        variante="secundario"
        className="w-full"
        disabled={bloqueado}
        onClick={() => entrarCom("google")}
      >
        <LogoGoogle />
        Continuar com Google
      </Botao>
      <Botao
        variante="secundario"
        className="w-full"
        disabled={bloqueado}
        onClick={() => entrarCom("azure")}
      >
        <LogoMicrosoft />
        Continuar com Microsoft
      </Botao>
      <div className="flex items-center gap-3 text-xs text-cinza-3" aria-hidden="true">
        <span className="h-px flex-1 bg-divisor" />
        ou
        <span className="h-px flex-1 bg-divisor" />
      </div>
    </div>
  );
}
