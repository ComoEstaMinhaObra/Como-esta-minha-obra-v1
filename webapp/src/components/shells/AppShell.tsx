"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function Logo() {
  return (
    <Link href="/obras" aria-label="Como Está Minha Obra" className="block">
      <span className="relative flex h-9 w-9 items-center justify-center rounded-md bg-marca">
        <span
          className="h-0 w-0 border-l-[7px] border-r-[7px] border-b-[12px] border-l-transparent border-r-transparent border-b-white"
          aria-hidden
        />
      </span>
    </Link>
  );
}

function IconObras() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
      <rect x="3" y="4" width="18" height="14" rx="2" />
      <path d="M3 10h18" />
    </svg>
  );
}

function IconNova() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function IconPlanos() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M7 10h4M7 14h10" />
    </svg>
  );
}

const nav = [
  { href: "/obras", label: "Minhas obras", Icon: IconObras, match: (p: string) => p === "/obras" || (p.startsWith("/obras/") && !p.startsWith("/obras/nova")) },
  { href: "/obras/nova", label: "Nova obra", Icon: IconNova, match: (p: string) => p.startsWith("/obras/nova") },
  { href: "/planos", label: "Planos", Icon: IconPlanos, match: (p: string) => p.startsWith("/planos") },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen">
      <aside className="fixed left-0 top-0 z-30 hidden h-screen w-[76px] flex-col items-center border-r border-divisor py-5 min-[800px]:flex">
        <Logo />
        <nav className="mt-8 flex flex-1 flex-col items-center gap-2">
          {nav.map(({ href, label, Icon, match }) => {
            const ativo = match(pathname);
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                aria-current={ativo ? "page" : undefined}
                className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors ${
                  ativo ? "bg-tinta text-white" : "text-cinza-2 hover:text-tinta"
                }`}
              >
                <Icon />
              </Link>
            );
          })}
        </nav>
        <Link href="/conta" aria-label="Conta" className="mt-auto">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-escuro-2 text-[11px] text-white">
            EU
          </span>
        </Link>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-divisor bg-fundo/80 px-2 py-2 backdrop-blur-md min-[800px]:hidden">
        {[
          ...nav,
          {
            href: "/conta",
            label: "Conta",
            Icon: () => (
              <span className="text-[10px] font-medium" aria-hidden>
                EU
              </span>
            ),
            match: (p: string) => p.startsWith("/conta"),
          },
        ].map(({ href, label, Icon, match }) => {
          const ativo = match(pathname);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={ativo ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-1 py-1 text-[10px] ${
                ativo ? "text-marca" : "text-cinza-2"
              }`}
            >
              <Icon />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mx-auto max-w-[1240px] px-4 pb-24 pt-6 min-[800px]:pl-[100px] min-[800px]:pb-10">
        {children}
      </div>
    </div>
  );
}
