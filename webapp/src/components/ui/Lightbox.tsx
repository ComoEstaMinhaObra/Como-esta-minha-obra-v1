"use client";

import { useEffect } from "react";

export type LightboxVariante = "compacto" | "midia" | "atividade" | "pdf";

const MAX_WIDTH: Record<LightboxVariante, string> = {
  compacto: "max-w-[390px]",
  midia: "max-w-[390px] md:max-w-[760px]",
  atividade: "max-w-[390px] lg:max-w-[840px]",
  pdf: "max-w-[390px] md:max-w-[calc(100vw-40px)] lg:max-w-[1000px]",
};

export function Lightbox({
  aberto,
  onFechar,
  titulo,
  preencher = false,
  variante = "compacto",
  children,
}: {
  aberto: boolean;
  onFechar: () => void;
  titulo?: string;
  preencher?: boolean;
  variante?: LightboxVariante;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aberto, onFechar]);

  if (!aberto) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-center bg-escuro-1/90 p-5 backdrop-blur-[4px] ${preencher ? "items-stretch pb-7 pt-6" : "items-center overflow-y-auto py-6"}`}
      role="dialog"
      aria-modal="true"
      aria-label={titulo ?? "Galeria"}
      onClick={onFechar}
    >
      <div
        className={`relative w-full ${MAX_WIDTH[variante]} ${preencher ? "flex min-h-0 flex-col" : "max-h-[90vh]"} ${variante === "pdf" ? "md:h-[calc(100dvh-64px)]" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-3 text-white">
          {titulo ? (
            <h2 className="font-serif text-xl font-normal">{titulo}</h2>
          ) : (
            <span />
          )}
          <button
            type="button"
            aria-label="Fechar"
            onClick={onFechar}
            className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-full border border-white/30 text-base"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
