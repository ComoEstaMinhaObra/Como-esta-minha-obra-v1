export function GradeFotos({
  urls,
  onAnexar,
  max = 12,
  className = "",
}: {
  urls: string[];
  onAnexar?: () => void;
  max?: number;
  className?: string;
}) {
  return (
    <div className={`grid grid-cols-3 gap-2 ${className}`}>
      {urls.map((url) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={url}
          src={url}
          alt=""
          className="aspect-square w-full rounded-xl object-cover"
        />
      ))}
      {onAnexar && urls.length < max ? (
        <button
          type="button"
          onClick={onAnexar}
          className="aspect-square rounded-xl border border-dashed border-borda text-cinza-2 text-sm"
        >
          + foto
        </button>
      ) : null}
    </div>
  );
}
