"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * Formulário de cartão do Mercado Pago (Card Payment Brick). Os dados do cartão são digitados
 * dentro do iframe do Mercado Pago e viram um token no navegador: o app e o servidor só veem o
 * token (uso único). O SDK precisa vir do domínio oficial, por isso é carregado por script e não
 * empacotado.
 */

interface BrickController {
  unmount: () => void;
}

interface DadosCartao {
  token?: string;
}

interface MercadoPagoInstancia {
  bricks: () => {
    create: (
      tipo: "cardPayment",
      idContainer: string,
      config: {
        initialization: { amount: number };
        customization?: {
          paymentMethods?: { minInstallments?: number; maxInstallments?: number };
          visual?: { texts?: { formSubmit?: string } };
        };
        callbacks: {
          onReady?: () => void;
          onSubmit: (dados: DadosCartao) => Promise<void>;
          onError?: (erro: unknown) => void;
        };
      },
    ) => Promise<BrickController>;
  };
}

declare global {
  interface Window {
    MercadoPago?: new (chavePublica: string, opcoes?: { locale?: string }) => MercadoPagoInstancia;
  }
}

const URL_SDK = "https://sdk.mercadopago.com/js/v2";
let carregamento: Promise<void> | null = null;

function carregarSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("SEM_JANELA"));
  if (window.MercadoPago) return Promise.resolve();
  if (carregamento) return carregamento;
  carregamento = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = URL_SDK;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      carregamento = null;
      s.remove();
      reject(new Error("SDK_INDISPONIVEL"));
    };
    document.head.appendChild(s);
  });
  return carregamento;
}

export function FormularioCartao({
  chavePublica,
  valorCentavos,
  rotuloBotao,
  onToken,
}: {
  chavePublica: string | null;
  valorCentavos: number;
  rotuloBotao: string;
  /** Recebe o token; deve rejeitar quando o pagamento não for concluído para o formulário liberar nova tentativa. */
  onToken: (token: string) => Promise<void>;
}) {
  const idContainer = `cartao-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [estado, setEstado] = useState<"carregando" | "pronto" | "indisponivel">(
    chavePublica ? "carregando" : "indisponivel",
  );
  // O callback muda a cada render; o Brick guarda o primeiro, então lemos sempre o mais recente.
  const onTokenRef = useRef(onToken);
  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!chavePublica) return;
    let cancelado = false;
    let controlador: BrickController | null = null;

    carregarSdk()
      .then(async () => {
        if (cancelado || !window.MercadoPago) return;
        const mp = new window.MercadoPago(chavePublica, { locale: "pt-BR" });
        const brick = await mp.bricks().create("cardPayment", idContainer, {
          initialization: { amount: valorCentavos / 100 },
          customization: {
            // Assinatura mensal: sem parcelamento.
            paymentMethods: { minInstallments: 1, maxInstallments: 1 },
            visual: { texts: { formSubmit: rotuloBotao } },
          },
          callbacks: {
            onReady: () => {
              if (!cancelado) setEstado("pronto");
            },
            onSubmit: async (dados) => {
              if (!dados.token) throw new Error("SEM_TOKEN");
              await onTokenRef.current(dados.token);
            },
            onError: () => {
              /* erros de preenchimento aparecem no próprio formulário */
            },
          },
        });
        if (cancelado) brick.unmount();
        else controlador = brick;
      })
      .catch(() => {
        if (!cancelado) setEstado("indisponivel");
      });

    return () => {
      cancelado = true;
      controlador?.unmount();
    };
  }, [chavePublica, valorCentavos, rotuloBotao, idContainer]);

  if (estado === "indisponivel") {
    return (
      <p role="alert" className="rounded-xl border border-borda p-3 text-sm text-cinza-2">
        O pagamento não está disponível agora. Tente novamente em alguns minutos.
      </p>
    );
  }

  return (
    <div>
      {estado === "carregando" && (
        <p className="text-sm text-cinza-2" aria-live="polite">
          Carregando o formulário de pagamento…
        </p>
      )}
      <div id={idContainer} />
    </div>
  );
}
