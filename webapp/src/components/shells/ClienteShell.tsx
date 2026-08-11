"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "inicio", label: "Início" },
  { href: "linha-do-tempo", label: "Linha do tempo" },
  { href: "galeria", label: "Galeria" },
  { href: "perfil", label: "Perfil" },
] as const;

export function ClienteShell({
  obraId,
  children,
}: {
  obraId: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const base = `/c/${obraId}`;

  return (
    <div className="mx-auto min-h-screen w-full max-w-[390px] bg-fundo pb-24">
      <div className="px-4 pt-4">{children}</div>
      <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-[390px] border-t border-divisor bg-fundo/85 px-1 py-2 backdrop-blur-md">
        {tabs.map((tab) => {
          const href =
            tab.href === "inicio" ? base : `${base}/${tab.href}`;
          const ativo =
            tab.href === "inicio"
              ? pathname === base
              : pathname.startsWith(href);
          return (
            <Link
              key={tab.href}
              href={href}
              aria-label={tab.label}
              aria-current={ativo ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-1 py-1 text-[10px] ${
                ativo ? "text-marca" : "text-cinza-2"
              }`}
            >
              <span
                className={`h-1 w-1 rounded-full ${ativo ? "bg-marca" : "bg-transparent"}`}
                aria-hidden
              />
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
