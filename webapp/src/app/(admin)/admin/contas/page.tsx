import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type ContaRow = {
  userId: string;
  nome: string;
  plano: string;
  status: string;
  nObras: number;
};

export default async function AdminContasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const busca = (q ?? "").trim().toLowerCase();
  const supabase = await createClient();
  const { data } = await supabase.rpc("fn_admin_contas");
  const lista = (data ?? []) as {
    userId: string;
    nome: string;
    plano: string;
    status: string;
    obrasAtivas: number;
  }[];

  let rows: ContaRow[] = lista.map((p) => ({
    userId: p.userId,
    nome: p.nome || "—",
    plano: p.plano,
    status: p.status,
    nObras: p.obrasAtivas,
  }));

  if (busca) {
    rows = rows.filter(
      (r) =>
        r.nome.toLowerCase().includes(busca) ||
        r.userId.toLowerCase().includes(busca),
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-3xl font-light">Contas</h1>
        <p className="mt-1 text-sm text-cinza-2">
          IDs, nome mínimo, plano e contagens — sem e-mail ou conteúdo de obra
        </p>
      </header>
      <form>
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por nome ou ID"
          className="w-full max-w-md rounded-[12px] border border-borda px-3 py-2 text-sm"
        />
      </form>
      <div className="overflow-x-auto rounded-[16px] border border-borda">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-divisor bg-cartao text-[10px] uppercase tracking-[0.14em] text-cinza-2">
            <tr>
              <th className="px-4 py-3 font-medium">ID</th>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Plano</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Obras</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-cinza-2">
                  Nenhuma conta
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.userId} className="border-b border-divisor last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/admin/contas/${r.userId}`} className="font-mono text-xs underline">
                      {r.userId.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{r.nome}</td>
                  <td className="px-4 py-3">{r.plano}</td>
                  <td className="px-4 py-3">{r.status}</td>
                  <td className="px-4 py-3 tabular-nums">{r.nObras}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
