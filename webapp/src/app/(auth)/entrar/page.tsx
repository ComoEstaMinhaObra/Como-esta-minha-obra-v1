import { Suspense } from "react";
import { Logo } from "@/components/brand/Logo";
import { carregarRefDoCookie } from "@/lib/afiliados/ref";
import { FormEntrar } from "./FormEntrar";

export default async function EntrarPage() {
  // Link de afiliado do cookie (se válido): vai no cadastro e mostra o desconto.
  const refAfiliado = await carregarRefDoCookie();
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 p-8">
      <Logo href="/" tamanho={48} />
      <Suspense>
        <FormEntrar refAfiliado={refAfiliado} />
      </Suspense>
    </main>
  );
}
