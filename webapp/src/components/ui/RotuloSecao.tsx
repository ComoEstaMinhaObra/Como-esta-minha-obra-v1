export function RotuloSecao({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`tracking-[0.18em] text-[10px] uppercase text-cinza-2 ${className}`}
    >
      {children}
    </p>
  );
}
