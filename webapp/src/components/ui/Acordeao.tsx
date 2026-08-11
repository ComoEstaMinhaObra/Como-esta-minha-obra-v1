"use client";

import { createContext, useContext, useId, useState } from "react";

type AcordeaoCtx = {
  aberto: Set<string>;
  toggle: (id: string) => void;
  abrirTodos: () => void;
  fecharTodos: () => void;
};

const Ctx = createContext<AcordeaoCtx | null>(null);

export function Acordeao({
  children,
  className = "",
  ids = [],
}: {
  children: React.ReactNode;
  className?: string;
  ids?: string[];
}) {
  const [aberto, setAberto] = useState<Set<string>>(new Set());

  return (
    <Ctx.Provider
      value={{
        aberto,
        toggle: (id) =>
          setAberto((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          }),
        abrirTodos: () => setAberto(new Set(ids)),
        fecharTodos: () => setAberto(new Set()),
      }}
    >
      <div className={`divide-y divide-divisor ${className}`}>{children}</div>
    </Ctx.Provider>
  );
}

export function AcordeaoItem({
  id,
  titulo,
  children,
  nivel = 1,
  resumo,
}: {
  id: string;
  titulo: string;
  children: React.ReactNode;
  nivel?: 1 | 2;
  resumo?: React.ReactNode;
}) {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("AcordeaoItem precisa estar dentro de Acordeao");
  const estaAberto = ctx.aberto.has(id);
  const itemId = useId();

  return (
    <div className={nivel === 2 ? "pl-3" : ""}>
      <button
        type="button"
        aria-expanded={estaAberto}
        aria-controls={itemId}
        onClick={() => ctx.toggle(id)}
        className="flex w-full items-center justify-between gap-3 py-3 text-left"
      >
        <span
          className={
            nivel === 1
              ? "font-serif text-base font-light"
              : "text-sm text-cinza-2"
          }
        >
          {titulo}
        </span>
        <span className="flex items-center gap-2">
          {resumo ? (
            <span className="text-xs text-marca">{resumo}</span>
          ) : null}
          <span className="text-cinza-3 text-lg leading-none" aria-hidden>
            {estaAberto ? "−" : "+"}
          </span>
        </span>
      </button>
      {estaAberto ? (
        <div id={itemId} className="pb-4 text-sm">
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function useAcordeao() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAcordeao precisa estar dentro de Acordeao");
  return ctx;
}
