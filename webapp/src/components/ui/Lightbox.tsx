"use client";

import { useEffect } from "react";

export function Lightbox({
  aberto,
  onFechar,
  titulo,
  children,
}: {
  aberto: boolean;
  onFechar: () => void;
  titulo?: string;
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-escuro-1/90 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={titulo ?? "Galeria"}
      onClick={onFechar}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-3xl overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-3 text-white">
          {titulo ? (
            <h2 className="font-serif text-xl font-light">{titulo}</h2>
          ) : (
            <span />
          )}
          <button
            type="button"
            aria-label="Fechar"
            onClick={onFechar}
            className="rounded-full border border-white/20 px-3 py-1 text-sm"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
