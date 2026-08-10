import { type HTMLAttributes } from "react";

export function Cartao({
  className = "",
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-[20px] border border-borda bg-cartao ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CartaoEscuro({
  className = "",
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-[20px] bg-escuro text-white ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
