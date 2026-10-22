import Link from "next/link";

type Props = {
  /** `false` renderiza só a marca, sem link. */
  href?: string | false;
  tamanho?: number;
  comTexto?: boolean;
  className?: string;
};

export function Logo({
  href = "/",
  tamanho = 36,
  comTexto = false,
  className = "",
}: Props) {
  const marca = (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático em /public */}
      <img
        src="/logo.svg"
        alt={comTexto ? "" : "Como Está Minha Obra"}
        width={tamanho}
        height={tamanho}
        className="shrink-0"
        decoding="async"
      />
      {comTexto ? (
        <span className="font-serif text-lg font-light leading-none">
          Como Está Minha Obra
        </span>
      ) : null}
    </span>
  );

  if (href === false) return marca;

  return (
    <Link
      href={href}
      aria-label={comTexto ? undefined : "Como Está Minha Obra"}
      className="inline-flex"
    >
      {marca}
    </Link>
  );
}
