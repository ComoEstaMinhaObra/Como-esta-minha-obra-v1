import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const NAV = [
  { href: "/admin", label: "KPIs" },
  { href: "/admin/contas", label: "Contas" },
  { href: "/admin/webhooks", label: "Webhooks" },
] as const;

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) notFound();

  const { data: ehAdmin } = await supabase.rpc("is_admin");
  if (!ehAdmin) notFound();

  return (
    <div className="min-h-screen bg-fundo">
      <header className="border-b border-divisor">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-4 px-4 py-4">
          <Link href="/admin" className="font-serif text-lg font-light">
            Admin
          </Link>
          <nav className="flex flex-1 gap-3 text-sm">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-cinza-2 hover:text-tinta"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <Link href="/obras" className="text-sm text-marca">
            Voltar ao app
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-[1240px] px-4 py-8">{children}</main>
    </div>
  );
}
