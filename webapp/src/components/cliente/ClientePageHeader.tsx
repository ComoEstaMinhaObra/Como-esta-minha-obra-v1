export function ClientePageHeader({
  eyebrow,
  titulo,
  subtitulo,
}: {
  eyebrow: string;
  titulo: string;
  subtitulo?: string;
}) {
  return (
    <header className="max-w-[680px]">
      <p className="text-[11px] tracking-[0.22em] uppercase text-cinza-2">
        {eyebrow}
      </p>
      <h1 className="mt-2.5 font-serif text-[32px] font-normal leading-[1.05] xl:text-[40px]">
        {titulo}
      </h1>
      {subtitulo ? (
        <p className="mt-[6px] text-[12px] text-cinza-3">{subtitulo}</p>
      ) : null}
    </header>
  );
}
