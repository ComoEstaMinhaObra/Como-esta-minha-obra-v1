export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <p className="rotulo-secao tracking-[0.18em] text-[10px] uppercase text-cinza-2">
        Design tokens
      </p>
      <h1 className="font-serif font-light text-4xl text-tinta">
        Como Está Minha Obra
      </h1>
      <p className="text-cinza-2 max-w-md text-center">
        Fundo greige, tinta, marca âmbar e tipografia Space Grotesk + Source
        Serif 4.
      </p>
      <div className="flex gap-3">
        <span className="rounded-full bg-marca px-5 py-2 text-sm text-white">
          Primário
        </span>
        <span className="rounded-[20px] border border-borda bg-cartao px-5 py-2 text-sm">
          Cartão
        </span>
        <span className="rounded-[20px] bg-escuro px-5 py-2 text-sm text-white">
          Escuro
        </span>
      </div>
    </main>
  );
}
