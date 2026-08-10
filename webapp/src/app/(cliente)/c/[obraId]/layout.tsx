import { ClienteShell } from "@/components/shells/ClienteShell";

export default async function ClienteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  return <ClienteShell obraId={obraId}>{children}</ClienteShell>;
}
