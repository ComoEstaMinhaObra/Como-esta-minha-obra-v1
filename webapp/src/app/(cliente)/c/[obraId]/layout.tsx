import Link from "next/link";
import { redirect } from "next/navigation";
import { ClienteShell } from "@/components/shells/ClienteShell";
import { carregarDadosCliente } from "@/lib/cliente/carregar-dados";

export default async function ClienteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  const result = await carregarDadosCliente(obraId);

  if (!result.ok) {
    if (result.motivo === "nao_autenticado") {
      redirect(`/entrar?next=${encodeURIComponent(`/c/${obraId}`)}`);
    }

    return (
      <div className="mx-auto flex min-h-screen w-full max-w-[390px] flex-col items-center justify-center gap-4 bg-fundo px-6 text-center">
        <h1 className="font-serif text-2xl font-light text-tinta">
          Sem acesso a esta obra
        </h1>
        <p className="text-sm text-cinza-2">
          Seu e-mail não tem permissão para ver esta página de acompanhamento,
          ou a obra não está mais disponível.
        </p>
        <Link href="/entrar" className="text-sm text-marca underline">
          Ir para o login
        </Link>
      </div>
    );
  }

  return <ClienteShell obraId={obraId}>{children}</ClienteShell>;
}
