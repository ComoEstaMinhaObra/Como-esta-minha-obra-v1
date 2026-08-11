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
      className={`sticky top-0 z-20 -mx-4 mb-4 bg-fundo/90 px-4 pb-3 pt-2 backdrop-blur-md transition-[border-color] ${
        scrolled ? "border-b border-borda" : "border-b border-transparent"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-cinza-2">{saudacao}</p>
          <h1 className="truncate font-serif text-[26px] font-light leading-tight text-tinta">
            {nomeObra}
          </h1>
        </div>
        <Avatar nome={nomeUsuario} tamanho={40} />
      </div>
    </header>
  );
}
