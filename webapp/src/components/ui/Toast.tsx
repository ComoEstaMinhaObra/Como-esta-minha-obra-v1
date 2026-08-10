"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

type ToastCtx = {
  toast: (mensagem: string) => void;
};

const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [mensagem, setMensagem] = useState<string | null>(null);

  const toast = useCallback((texto: string) => {
    setMensagem(texto);
  }, []);

  useEffect(() => {
    if (!mensagem) return;
    const t = window.setTimeout(() => setMensagem(null), 2800);
    return () => window.clearTimeout(t);
  }, [mensagem]);

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      {mensagem ? (
        <div
          role="status"
          className="pointer-events-none fixed inset-x-0 bottom-8 z-[60] flex justify-center px-4"
        >
          <div className="rounded-full bg-escuro-1 px-5 py-2.5 text-sm text-white shadow-lg">
            {mensagem}
          </div>
        </div>
      ) : null}
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast precisa estar dentro de ToastProvider");
  return ctx;
}
