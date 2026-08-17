"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const tabs = [
  { href: "inicio", label: "Início", icon: "home" },
  { href: "linha-do-tempo", label: "Linha do tempo", icon: "calendar" },
  { href: "galeria", label: "Galeria", icon: "gallery" },
] as const;

const perfil = { href: "perfil", label: "Perfil", icon: "user" } as const;

type NomeIcone = (typeof tabs)[number]["icon"] | typeof perfil.icon;

function IconeTab({ nome }: { nome: NomeIcone }) {
  const comum = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.3,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (nome === "home") {
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden
        className="h-5 w-5 flex-none"
        {...comum}
      >
        <path d="M4 11.5 12 4l8 7.5" />
        <path d="M6.5 10v9.5h11V10" />
      </svg>
    );
  }
  if (nome === "calendar") {
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden
        className="h-5 w-5 flex-none"
        {...comum}
      >
        <rect x="4" y="5.5" width="16" height="15" rx="1.5" />
        <path d="M8 3.5v4M16 3.5v4M4 10h16" />
      </svg>
    );
  }
  if (nome === "gallery") {
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden
        className="h-5 w-5 flex-none"
        {...comum}
      >
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <circle cx="9.2" cy="9.2" r="1.6" />
        <path d="M4 16.5 9 12l4.5 4 3-2.5L20 17" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-5 w-5 flex-none"
      {...comum}
    >
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 19.5a7 7 0 0 1 14 0" />
    </svg>
  );
}

export function ClienteShell({
  obraId,
  children,
}: {
  obraId: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const base = `/c/${obraId}`;
  const [menuRecolhido, setMenuRecolhido] = useState(false);

  const hrefDaTab = (href: string) =>
    href === "inicio" ? base : `${base}/${href}`;

  const estaAtiva = (href: string) => {
    const destino = hrefDaTab(href);
    return href === "inicio" ? pathname === base : pathname.startsWith(destino);
  };

  const classeDaTab = (ativa: boolean) =>
    `flex flex-col items-center gap-[5px] text-[8.5px] tracking-[0.12em] uppercase lg:w-full lg:flex-row lg:gap-3 lg:px-5 lg:py-3 lg:text-[11px] ${menuRecolhido ? "lg:justify-center lg:px-0" : "lg:items-center"} ${ativa ? "text-marca" : "text-cinza-3"}`;

  return (
    <div
      data-cliente-shell
      className={`mx-auto min-h-screen w-full max-w-[390px] bg-fundo pb-[92px] md:max-w-[760px] lg:grid lg:max-w-none ${menuRecolhido ? "lg:grid-cols-[64px_minmax(0,1fr)]" : "lg:grid-cols-[216px_minmax(0,1fr)]"} lg:pb-0`}
    >
      <main className="min-w-0 lg:col-start-2">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto grid max-w-[390px] grid-cols-4 items-center gap-1 border-t border-divisor bg-fundo/90 px-[22px] pb-[calc(20px+env(safe-area-inset-bottom))] pt-3 backdrop-blur-md md:max-w-[760px] lg:sticky lg:top-0 lg:col-start-1 lg:row-start-1 lg:mx-0 lg:flex lg:h-dvh lg:max-w-none lg:flex-col lg:items-stretch lg:border-r lg:border-t-0 lg:border-divisor lg:px-0 lg:py-4">
        <button
          type="button"
          onClick={() => setMenuRecolhido((recolhido) => !recolhido)}
          aria-label={menuRecolhido ? "Expandir menu" : "Recolher menu"}
          title={menuRecolhido ? "Expandir menu" : "Recolher menu"}
          className={`mb-5 hidden h-8 items-center text-cinza-2 transition-colors hover:text-tinta lg:flex ${menuRecolhido ? "lg:justify-center" : "lg:pl-5"}`}
        >
          <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d={menuRecolhido ? "m9 18 6-6-6-6" : "m15 18-6-6 6-6"} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="contents lg:flex lg:flex-col lg:gap-1">
          {tabs.map((tab) => {
            const href = hrefDaTab(tab.href);
            const ativo = estaAtiva(tab.href);
          return (
            <Link
              key={tab.href}
              href={href}
              aria-label={tab.label}
              aria-current={ativo ? "page" : undefined}
              className={classeDaTab(ativo)}
            >
              <IconeTab nome={tab.icon} />
              <span className={`whitespace-nowrap ${menuRecolhido ? "lg:hidden" : ""}`}>{tab.label}</span>
            </Link>
          );
          })}
        </div>
        <div className="contents lg:mt-auto lg:block">
          <Link
            href={hrefDaTab(perfil.href)}
            aria-label={perfil.label}
            aria-current={estaAtiva(perfil.href) ? "page" : undefined}
            className={classeDaTab(estaAtiva(perfil.href))}
          >
            <IconeTab nome={perfil.icon} />
            <span className={`whitespace-nowrap ${menuRecolhido ? "lg:hidden" : ""}`}>{perfil.label}</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
