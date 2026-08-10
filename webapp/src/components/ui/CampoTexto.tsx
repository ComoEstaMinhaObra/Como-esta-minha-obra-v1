import { type InputHTMLAttributes, useId } from "react";

export interface CampoTextoProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  rotulo: string;
  erro?: string;
  id?: string;
}

export function CampoTexto({
  rotulo,
  erro,
  className = "",
  id,
  ...rest
}: CampoTextoProps) {
  const autoId = useId();
  const campoId = id ?? autoId;

  return (
    <label className={`flex flex-col gap-1.5 ${className}`} htmlFor={campoId}>
      <span className="text-sm text-cinza-2">{rotulo}</span>
      <input
        id={campoId}
        className="rounded-full border border-borda bg-white px-4 py-2.5 text-sm text-tinta outline-none focus:border-marca"
        {...rest}
      />
      {erro ? <span className="text-xs text-marca">{erro}</span> : null}
    </label>
  );
}
