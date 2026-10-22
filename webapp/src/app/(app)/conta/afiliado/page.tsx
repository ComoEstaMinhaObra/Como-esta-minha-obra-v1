import { notFound } from "next/navigation";
import { publicEnv } from "@/config/env";
import { carregarPainelAfiliado } from "@/lib/afiliados/painel";
import { PainelAfiliado } from "./PainelAfiliado";

export const metadata = { title: "Programa de afiliados" };

export default async function AfiliadoPage() {
  const r = await carregarPainelAfiliado();
  if (!r.ok && r.motivo === "NAO_AFILIADO") notFound();
  if (!r.ok) {
    return (
      <div className="max-w-lg space-y-2">
        <h1 className="font-serif text-3xl font-light">Programa de afiliados</h1>
        <p className="text-sm text-cinza-2">
          Não foi possível carregar seus dados agora. Tente novamente em instantes.
        </p>
      </div>
    );
  }
  return (
    <PainelAfiliado
      painel={r.painel}
      baseUrl={publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}
    />
  );
}
