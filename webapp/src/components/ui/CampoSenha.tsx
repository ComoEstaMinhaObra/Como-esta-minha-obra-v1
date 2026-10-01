"use client";

import { type InputHTMLAttributes, type ReactNode, useId, useState } from "react";

export interface CampoSenhaProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "type"> {
  rotulo: string;
  erro?: string;
  id?: string;
  /** Conteúdo abaixo do campo (ex.: indicador de força). */
  children?: ReactNode;
}

function IconeOlho({ riscado }: { riscado: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {riscado ? <path d="M4 4l16 16" /> : null}
    </svg>
  );
}

export function CampoSenha({
  rotulo,
  erro,
  className = "",
  id,
  children,
  ...rest
}: CampoSenhaProps) {
  const autoId = useId();
  const campoId = id ?? autoId;
  const [visivel, setVisivel] = useState(false);

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="text-sm text-cinza-2" htmlFor={campoId}>
        {rotulo}
      </label>
      <div className="relative">
        <input
          id={campoId}
          type={visivel ? "text" : "password"}
          className="w-full rounded-full border border-borda bg-white py-2.5 pl-4 pr-11 text-sm text-tinta outline-none focus:border-marca"
          {...rest}
        />
        <button
          type="button"
          onClick={() => setVisivel((v) => !v)}
          aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={visivel}
          className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-cinza-2 transition-colors hover:text-tinta focus-visible:outline focus-visible:outline-2 focus-visible:outline-marca"
        >
          <IconeOlho riscado={visivel} />
        </button>
      </div>
      {erro ? <span className="text-xs text-marca">{erro}</span> : null}
      {children}
    </div>
  );
}
