"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui";

export function ClienteHeader({
  saudacao,
  nomeObra,
  nomeUsuario,
}: {
  saudacao: string;
  nomeObra: string;
  nomeUsuario: string;
}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-20 mb-0 bg-[linear-gradient(180deg,rgba(253,239,232,0.94),rgba(250,250,249,0.9))] px-7 pb-4 pt-7 backdrop-blur-md transition-[border-color] md:px-8 lg:px-10 ${
        scrolled ? "border-b border-borda" : "border-b border-transparent"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] tracking-[0.22em] uppercase text-cinza-2">
            {saudacao}
          </p>
          <h1 className="mt-2.5 font-serif text-[32px] font-normal leading-[1.05] tracking-[-0.01em] text-tinta xl:text-[40px]">
            {nomeObra}
          </h1>
        </div>
        <Avatar nome={nomeUsuario} tamanho={36} className="mt-1 lg:hidden" />
      </div>
    </header>
  );
}
