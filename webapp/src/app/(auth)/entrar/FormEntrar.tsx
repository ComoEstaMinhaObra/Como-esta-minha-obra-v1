"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Botao, CampoTexto, useToast } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { publicEnv } from "@/config/env";

type Modo = "entrar" | "criar" | "recuperar";

function mensagemDeErro(mensagem: string): string {
  if (mensagem.includes("Invalid login credentials")) {
    return "E-mail ou senha incorretos.";
  }
  if (mensagem.includes("Email not confirmed")) {
    return "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.";
  }
  if (mensagem.includes("Password should be at least")) {
    return "A senha precisa ter pelo menos 6 caracteres.";
  }
  return mensagem;
}

export function FormEntrar() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");

  const [modo, setModo] = useState<Modo>("entrar");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [enviado, setEnviado] = useState<"confirmacao" | "recuperacao" | null>(
    null,
  );
  const [carregando, setCarregando] = useState(false);

  const urlCallback = `${publicEnv.NEXT_PUBLIC_APP_URL}/auth/callback${
    next && next.startsWith("/") ? `?next=${encodeURIComponent(next)}` : ""
  }`;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    try {
      const supabase = createClient();

      if (modo === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: senha,
        });
        if (error) {
          toast(mensagemDeErro(error.message));
          return;
        }
        window.location.assign(urlCallback);
        return;
      }

      if (modo === "criar") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: senha,
          options: {
            data: { nome: nome.trim() },
            emailRedirectTo: urlCallback,
          },
        });
        if (error) {
          toast(mensagemDeErro(error.message));
          return;
        }
        if (data.user && data.user.identities?.length === 0) {
          toast("Este e-mail já possui conta. Entre com sua senha.");
          setModo("entrar");
          return;
        }
        if (data.session) {
          window.location.assign(urlCallback);
          return;
        }
        setEnviado("confirmacao");
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: `${publicEnv.NEXT_PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent("/auth/nova-senha")}`,
        },
      );
      if (error) {
        toast(mensagemDeErro(error.message));
        return;
      }
      setEnviado("recuperacao");
    } finally {
      setCarregando(false);
    }
  }

  if (enviado === "confirmacao") {
    return (
      <div className="space-y-3 text-center">
        <h1 className="font-serif text-3xl font-light">Confirme seu e-mail</h1>
        <p className="text-sm text-cinza-2">
          Enviamos um link de confirmação para{" "}
          <strong className="text-tinta">{email}</strong>. Abra o e-mail e
          toque no link para ativar sua conta.
        </p>
      </div>
    );
  }

  if (enviado === "recuperacao") {
    return (
      <div className="space-y-3 text-center">
        <h1 className="font-serif text-3xl font-light">Verifique seu e-mail</h1>
        <p className="text-sm text-cinza-2">
          Se houver conta para{" "}
          <strong className="text-tinta">{email}</strong>, você receberá um
          link para definir uma nova senha.
        </p>
      </div>
    );
  }

  const titulo =
    modo === "entrar"
      ? "Entrar"
      : modo === "criar"
        ? "Criar conta"
        : "Recuperar senha";
  const subtitulo =
    modo === "entrar"
      ? "Acesse com seu e-mail e senha."
      : modo === "criar"
        ? "Comece grátis — 14 dias de teste."
        : "Enviaremos um link para definir uma nova senha.";

  return (
    <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5">
      <div className="space-y-2 text-center">
        <h1 className="font-serif text-3xl font-light">{titulo}</h1>
        <p className="text-sm text-cinza-2">{subtitulo}</p>
      </div>

      {modo === "criar" ? (
        <CampoTexto
          rotulo="Nome"
          type="text"
          required
          autoComplete="name"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Seu nome"
        />
      ) : null}

      <CampoTexto
        rotulo="E-mail"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="voce@empresa.com"
      />

      {modo !== "recuperar" ? (
        <CampoTexto
          rotulo="Senha"
          type="password"
          required
          minLength={6}
          autoComplete={modo === "criar" ? "new-password" : "current-password"}
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          placeholder={modo === "criar" ? "Mínimo 6 caracteres" : "Sua senha"}
        />
      ) : null}

      <Botao type="submit" className="w-full" disabled={carregando}>
        {carregando
          ? "Aguarde…"
          : modo === "entrar"
            ? "Entrar"
            : modo === "criar"
              ? "Criar conta"
              : "Enviar link"}
      </Botao>

      <div className="space-y-2 text-center text-sm">
        {modo === "entrar" ? (
          <>
            <button
              type="button"
              className="block w-full text-cinza-2 underline-offset-2 hover:underline"
              onClick={() => setModo("recuperar")}
            >
              Esqueci minha senha
            </button>
            <button
              type="button"
              className="block w-full text-tinta underline-offset-2 hover:underline"
              onClick={() => setModo("criar")}
            >
              Não tem conta? Criar conta
            </button>
          </>
        ) : (
          <button
            type="button"
            className="block w-full text-cinza-2 underline-offset-2 hover:underline"
            onClick={() => setModo("entrar")}
          >
            Já tenho conta — entrar
          </button>
        )}
      </div>
    </form>
  );
}
