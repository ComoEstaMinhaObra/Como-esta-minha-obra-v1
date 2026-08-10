import { type InputHTMLAttributes, useId } from "react";

export function CampoData({
  rotulo,
  className = "",
  id,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "id"> & {
  rotulo: string;
  id?: string;
}) {
  const autoId = useId();
  const campoId = id ?? autoId;

  return (
    <label className={`flex flex-col gap-1.5 ${className}`} htmlFor={campoId}>
      <span className="text-sm text-cinza-2">{rotulo}</span>
      <input
        id={campoId}
        type="date"
        className="rounded-full border border-borda bg-white px-4 py-2.5 text-sm text-tinta outline-none focus:border-marca"
        {...rest}
      />
    </label>
  );
}
