import { Suspense } from "react";
import { carregarRefDoCookie } from "@/lib/afiliados/ref";
import { FormEntrar } from "./FormEntrar";

export default async function EntrarPage() {
  // Link de afiliado do cookie (se válido): vai no cadastro e mostra o desconto.
  const refAfiliado = await carregarRefDoCookie();
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <Suspense>
        <FormEntrar refAfiliado={refAfiliado} />
      </Suspense>
    </main>
  );
}
