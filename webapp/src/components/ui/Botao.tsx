import { type ButtonHTMLAttributes } from "react";

type Variante = "primario" | "secundario" | "terciario";

const estilos: Record<Variante, string> = {
  primario:
    "bg-marca text-white hover:bg-marca-hover disabled:opacity-50",
  secundario:
    "border border-borda bg-transparent text-tinta hover:bg-white/60 disabled:opacity-50",
  terciario:
    "bg-tinta text-white hover:bg-escuro-1 disabled:opacity-50",
};

export interface BotaoProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
}

export function Botao({
  variante = "primario",
  className = "",
  children,
  type = "button",
  ...rest
}: BotaoProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-normal transition-colors ${estilos[variante]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
