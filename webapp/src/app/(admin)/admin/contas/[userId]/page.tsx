import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReenviarConvitesBotao } from "./ReenviarConvitesBotao";

export default async function AdminContaDetalhePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const supabase = await createClient();
  const [{ data: contas }, { data: obrasJson }] = await Promise.all([
    supabase.rpc("fn_admin_contas"),
    supabase.rpc("fn_admin_obras", { p_owner: userId }),
  ]);
  const conta = (
    (contas ?? []) as {
      userId: string;
      nome: string;
      plano: string;
      status: string;
      obrasAtivas: number;
    }[]
  ).find((c) => c.userId === userId);
  if (!conta) notFound();

  const obras = (
    (obrasJson ?? []) as {
      id: string;
      ownerId?: string;
      nome: string;
      arquivada: boolean;
      criadoEm: string;
    }[]
  )
    .filter((o) => !o.ownerId || o.ownerId === userId)
    .slice(0, 50);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/contas" className="text-sm text-marca">
          ← Contas
        </Link>
        <h1 className="mt-2 font-serif text-3xl font-light">
          {conta.nome || "Sem nome"}
        </h1>
        <p className="font-mono text-xs text-cinza-2">{conta.userId}</p>
      </div>

      <section className="space-y-2 text-sm">
        <p>Plano: {conta.plano}</p>
        <p>Status: {conta.status}</p>
        <p>Obras ativas: {conta.obrasAtivas}</p>
      </section>

      <section>
        <h2 className="font-serif text-xl font-light">Obras (resumo)</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {obras.map((o) => (
            <li key={o.id} className="flex justify-between border-b border-divisor py-2">
              <span>{o.nome}</span>
              <span className="text-cinza-2">
                {o.arquivada ? "arquivada" : "ativa"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <ReenviarConvitesBotao userId={userId} />
    </div>
  );
}
