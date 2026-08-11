import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formatarDataBr } from "@/lib/datas";

type ContaRow = {
  userId: string;
  nome: string;
  email: string;
  plano: string;
  status: string;
  nObras: number;
  criadoEm: string;
};

export default async function AdminContasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const busca = (q ?? "").trim().toLowerCase();

  const supabase = await createClient();
  const admin = createAdminClient();

  const [{ data: profiles }, { data: assinaturas }, { data: obras }] =
    await Promise.all([
      supabase.from("profiles").select("id, nome, criado_em").order("criado_em", {
        ascending: false,
      }),
      supabase.from("assinaturas").select("user_id, plano, status"),
      supabase
        .from("obras")
        .select("owner_id")
        .is("arquivada_em", null),
    ]);

  const emailPorUser = new Map<string, string>();
  const { data: authList } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  for (const u of authList?.users ?? []) {
    if (u.email) emailPorUser.set(u.id, u.email);
  }

  const assinaturaPorUser = new Map(
    (assinaturas ?? []).map((a) => [a.user_id, a]),
  );
  const obrasPorOwner = new Map<string, number>();
  for (const o of obras ?? []) {
    obrasPorOwner.set(o.owner_id, (obrasPorOwner.get(o.owner_id) ?? 0) + 1);
  }

  let rows: ContaRow[] = (profiles ?? []).map((p) => {
    const a = assinaturaPorUser.get(p.id);
    return {
      userId: p.id,
      nome: p.nome || "—",
      email: emailPorUser.get(p.id) ?? "—",
      plano: a?.plano ?? "—",
      status: a?.status ?? "—",
      nObras: obrasPorOwner.get(p.id) ?? 0,
      criadoEm: p.criado_em,
    };
  });

  if (busca) {
    rows = rows.filter(
      (r) =>
        r.email.toLowerCase().includes(busca) ||
        r.nome.toLowerCase().includes(busca),
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-light">Contas</h1>
          <p className="mt-1 text-sm text-cinza-2">
            {rows.length} resultado{rows.length === 1 ? "" : "s"}
          </p>
        </div>
        <form className="flex gap-2" method="get">
          <label className="sr-only" htmlFor="q">
            Buscar por e-mail ou nome
          </label>
          <input
            id="q"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Buscar e-mail ou nome"
            className="min-w-[220px] rounded-full border border-borda bg-cartao px-4 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-marca"
          />
          <button
            type="submit"
            className="rounded-full bg-tinta px-4 py-2 text-sm text-white"
          >
            Buscar
          </button>
        </form>
      </header>

      <div className="overflow-x-auto rounded-[16px] border border-borda">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-divisor bg-cartao text-[10px] uppercase tracking-[0.14em] text-cinza-2">
            <tr>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">E-mail</th>
              <th className="px-4 py-3 font-medium">Plano</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Obras</th>
              <th className="px-4 py-3 font-medium">Criado em</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-cinza-2">
                  Nenhuma conta encontrada
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.userId} className="border-b border-divisor last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/contas/${r.userId}`}
                      className="text-marca hover:underline"
                    >
                      {r.nome}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{r.email}</td>
                  <td className="px-4 py-3">{r.plano}</td>
                  <td className="px-4 py-3">{r.status}</td>
                  <td className="px-4 py-3 tabular-nums">{r.nObras}</td>
                  <td className="px-4 py-3">
                    {formatarDataBr(r.criadoEm.slice(0, 10))}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
