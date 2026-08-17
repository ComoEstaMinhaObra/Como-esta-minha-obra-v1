import { redirect } from "next/navigation";
import { carregarDadosCliente } from "@/lib/cliente/carregar-dados";

export default async function InformacoesPage({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  const result = await carregarDadosCliente(obraId);

  if (!result.ok) {
    if (result.motivo === "nao_autenticado") {
      redirect(`/entrar?next=${encodeURIComponent(`/c/${obraId}`)}`);
    }
    redirect(`/c/${obraId}`);
  }

  redirect(`/c/${obraId}`);
}
