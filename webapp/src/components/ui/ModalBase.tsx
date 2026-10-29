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

  // `onFechar` costuma chegar como função inline (nova a cada render): fica numa ref para que
  // digitar num campo (re-render do pai) não reexecute o efeito e roube o foco do campo.
  const onFecharRef = useRef(onFechar);
  useEffect(() => {
    onFecharRef.current = onFechar;
  });

  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFecharRef.current();
    };
    window.addEventListener("keydown", onKey);
    painelRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [aberto]);

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
        className={`max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-[20px] border border-borda bg-fundo p-5 outline-none ${className}`}
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
