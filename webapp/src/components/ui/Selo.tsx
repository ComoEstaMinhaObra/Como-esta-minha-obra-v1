type Tom = "ambar" | "verde" | "cinza" | "preto";

const tons: Record<Tom, string> = {
  ambar: "bg-marca/15 text-marca",
  verde: "bg-sucesso/15 text-sucesso",
  cinza: "bg-divisor text-cinza-2",
  preto: "bg-tinta text-white",
};

export function Selo({
  children,
  tom = "cinza",
  className = "",
}: {
  children: React.ReactNode;
  tom?: Tom;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-normal ${tons[tom]} ${className}`}
    >
      {children}
    </span>
  );
}
