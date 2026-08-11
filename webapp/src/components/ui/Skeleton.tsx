export function Skeleton({
  className = "",
  "aria-label": ariaLabel = "Carregando",
}: {
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <div
      role="status"
      aria-label={ariaLabel}
      className={`animate-pulse rounded-[12px] bg-divisor/80 ${className}`}
    />
  );
}

export function SkeletonFeed({ linhas = 3 }: { linhas?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Carregando lista">
      {Array.from({ length: linhas }, (_, i) => (
        <Skeleton key={i} className="h-24 w-full" />
      ))}
    </div>
  );
}

export function SkeletonGrade({ itens = 6 }: { itens?: number }) {
  return (
    <div
      className="grid grid-cols-2 gap-3 min-[800px]:grid-cols-3"
      aria-busy="true"
      aria-label="Carregando grade"
    >
      {Array.from({ length: itens }, (_, i) => (
        <Skeleton key={i} className="aspect-[4/3] w-full" />
      ))}
    </div>
  );
}
