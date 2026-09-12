"use client";

import { useEffect, useRef } from "react";
import { publicEnv } from "@/config/env";

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
        },
      ) => string;
      reset: (id?: string) => void;
    };
  }
}

export function TurnstileCampo({
  onToken,
}: {
  onToken: (token: string | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const siteKey = publicEnv.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!siteKey || !ref.current) return;
    const render = () => {
      if (!ref.current || !window.turnstile || widget.current) return;
      widget.current = window.turnstile.render(ref.current, {
        sitekey: siteKey,
        callback: (token) => onToken(token),
        "expired-callback": () => onToken(null),
      });
    };
    if (window.turnstile) {
      render();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    script.onload = render;
    document.head.appendChild(script);
  }, [onToken, siteKey]);

  if (!siteKey) return null;
  return <div ref={ref} className="flex justify-center" />;
}

export function resetarTurnstile(): void {
  window.turnstile?.reset();
}
