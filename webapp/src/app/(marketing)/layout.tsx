import Link from "next/link";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-divisor">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between px-4 py-4">
          <Link href="/" className="font-serif text-lg font-light">
            Como Está Minha Obra
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/precos" className="text-cinza-2 hover:text-tinta">
              Preços
            </Link>
            <Link href="/blog" className="text-cinza-2 hover:text-tinta">
              Blog
            </Link>
            <Link
              href="/entrar"
              className="rounded-full bg-marca px-4 py-2 text-white hover:bg-marca-hover"
            >
              Entrar
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-divisor">
        <div className="mx-auto flex max-w-[1240px] flex-wrap gap-4 px-4 py-8 text-sm text-cinza-2">
          <Link href="/politica-de-privacidade">Política de privacidade</Link>
          <Link href="/termos">Termos</Link>
          <span className="ml-auto">© Como Está Minha Obra</span>
        </div>
      </footer>
    </div>
  );
}
