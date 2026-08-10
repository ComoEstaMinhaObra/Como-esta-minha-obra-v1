"use client";

import { useEffect, useRef } from "react";

export function ModalBase({
  aberto,
  onFechar,
  titulo,
  children,
  className = "",
}: {
  aberto: boolean;
  onFechar: () => void;
  titulo?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const painelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar();
    };
    window.addEventListener("keydown", onKey);
    painelRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [aberto, onFechar]);

  if (!aberto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-tinta/40 p-4 min-[800px]:items-center"
      role="presentation"
      onClick={onFechar}
    >
      <div
        ref={painelRef}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
        className={`w-full max-w-lg rounded-[20px] border border-borda bg-fundo p-5 outline-none ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {titulo ? (
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-serif text-xl font-light">{titulo}</h2>
            <button
              type="button"
              aria-label="Fechar"
              onClick={onFechar}
              className="text-cinza-2"
            >
              ×
            </button>
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
