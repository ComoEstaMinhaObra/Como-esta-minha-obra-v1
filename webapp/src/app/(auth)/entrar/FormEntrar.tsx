"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Botao, CampoSenha, CampoTexto, useToast } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { publicEnv } from "@/config/env";
import {
  TurnstileCampo,
  resetarTurnstile,
} from "@/components/auth/TurnstileCampo";
import { BotoesSociais } from "@/components/auth/BotoesSociais";
import { IndicadorForcaSenha } from "@/components/auth/IndicadorForcaSenha";
import {
  MENSAGEM_REGRA_SENHA,
  TAMANHO_MINIMO_SENHA,
  senhaAceita,
} from "@/lib/auth/forca-senha";
import { emailNaoConfirmado, mensagemDeErro } from "@/lib/auth/mensagens-erro";
import {
  SEGUNDOS_ESPERA_REENVIO,
  rotuloReenvio,
  segundosRestantes,
} from "@/lib/auth/reenvio-confirmacao";

type Modo = "entrar" | "criar" | "recuperar";

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
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [reenviando, setReenviando] = useState(false);
  const [liberaReenvioEm, setLiberaReenvioEm] = useState(0);
  const [restantes, setRestantes] = useState(0);

  useEffect(() => {
    if (liberaReenvioEm === 0) return;
    const atualizar = () =>
      setRestantes(segundosRestantes(liberaReenvioEm, Date.now()));
    atualizar();
    const id = window.setInterval(atualizar, 1000);
    return () => window.clearInterval(id);
  }, [liberaReenvioEm]);

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
          if (emailNaoConfirmado(error.message)) {
            setEnviado("confirmacao");
            return;
          }
          toast(mensagemDeErro(error.message, error.code));
          return;
        }
        window.location.assign(urlCallback);
        return;
      }

      if (modo === "criar") {
        if (!senhaAceita(senha)) {
          toast(MENSAGEM_REGRA_SENHA);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password: senha,
          options: {
            data: { nome: nome.trim() },
            emailRedirectTo: urlCallback,
            captchaToken: captcha ?? undefined,
          },
        });
        resetarTurnstile();
        setCaptcha(null);
        if (error) {
          toast(mensagemDeErro(error.message, error.code));
          return;
        }
        setLiberaReenvioEm(Date.now() + SEGUNDOS_ESPERA_REENVIO * 1000);
        setEnviado("confirmacao");
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: `${publicEnv.NEXT_PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent("/auth/nova-senha")}`,
          captchaToken: captcha ?? undefined,
        },
      );
      resetarTurnstile();
      setCaptcha(null);
      if (error) {
        toast(mensagemDeErro(error.message, error.code));
        return;
      }
      setEnviado("recuperacao");
    } finally {
      setCarregando(false);
    }
  }

  async function reenviarConfirmacao() {
    setReenviando(true);
    try {
      const { error } = await createClient().auth.resend({
        type: "signup",
        email: email.trim(),
        options: {
          emailRedirectTo: urlCallback,
          captchaToken: captcha ?? undefined,
        },
      });
      resetarTurnstile();
      setCaptcha(null);
      if (error) {
        toast(mensagemDeErro(error.message, error.code));
        return;
      }
      setLiberaReenvioEm(Date.now() + SEGUNDOS_ESPERA_REENVIO * 1000);
      toast("Reenviamos o link de confirmação.");
    } finally {
      setReenviando(false);
    }
  }

  function voltarPara(destino: Modo) {
    setEnviado(null);
    setSenha("");
    setCaptcha(null);
    setModo(destino);
  }

  if (enviado === "confirmacao") {
    const aguardandoCaptcha =
      Boolean(publicEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY) && !captcha;
    return (
      <div className="w-full max-w-sm space-y-5 text-center">
        <div className="space-y-3">
          <h1 className="font-serif text-3xl font-light">Confirme seu e-mail</h1>
          <p className="text-sm text-cinza-2">
            Se for um cadastro novo, enviamos um link de confirmação para{" "}
            <strong className="text-tinta">{email}</strong>. Abra o e-mail e
            toque no link para ativar sua conta.
          </p>
          <p className="text-sm text-cinza-2">
            Se esse e-mail já tiver conta, nenhum link é enviado — use as
            opções abaixo.
          </p>
        </div>

        <TurnstileCampo onToken={setCaptcha} />

        <Botao
          type="button"
          className="w-full"
          disabled={reenviando || restantes > 0 || aguardandoCaptcha}
          onClick={reenviarConfirmacao}
        >
          {rotuloReenvio(restantes, reenviando)}
        </Botao>

        <div className="space-y-2 text-sm">
          <button
            type="button"
            className="block w-full text-tinta underline-offset-2 hover:underline"
            onClick={() => voltarPara("entrar")}
          >
            Já tenho conta — entrar
          </button>
          <button
            type="button"
            className="block w-full text-cinza-2 underline-offset-2 hover:underline"
            onClick={() => voltarPara("recuperar")}
          >
            Esqueci minha senha
          </button>
        </div>
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

      {modo !== "recuperar" ? (
        <BotoesSociais redirectTo={urlCallback} desabilitado={carregando} />
      ) : null}

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
        <CampoSenha
          key={modo}
          rotulo="Senha"
          required
          minLength={modo === "criar" ? TAMANHO_MINIMO_SENHA : undefined}
          autoComplete={modo === "criar" ? "new-password" : "current-password"}
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          placeholder={
            modo === "criar"
              ? "Mínimo 8 caracteres, maiúscula, minúscula e número"
              : "Sua senha"
          }
        >
          {modo === "criar" ? <IndicadorForcaSenha senha={senha} /> : null}
        </CampoSenha>
      ) : null}

      {modo === "criar" || modo === "recuperar" ? (
        <TurnstileCampo onToken={setCaptcha} />
      ) : null}

      <Botao
        type="submit"
        className="w-full"
        disabled={carregando || (modo === "criar" && !senhaAceita(senha))}
      >
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
