import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { formatarDataBr } from "@/lib/datas";
import { ReenviarConvitesBotao } from "./ReenviarConvitesBotao";

export default async function AdminContaDetalhePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, nome, criado_em")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) notFound();

  const [{ data: assinatura }, { data: obras }, authUser] = await Promise.all([
    supabase
      .from("assinaturas")
      .select(
        "status, plano, limite_obras, trial_fim, relatorios_enviados_trial, abacatepay_subscription_id, abacatepay_customer_id, atualizado_em",
      )
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("obras")
      .select("id, nome, arquivada_em, criado_em")
      .eq("owner_id", userId)
      .order("criado_em", { ascending: false }),
    admin.auth.admin.getUserById(userId),
  ]);

  const email = authUser.data.user?.email ?? "—";

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/contas" className="text-sm text-marca">
          ← Contas
        </Link>
        <h1 className="mt-2 font-serif text-3xl font-light">
          {profile.nome || "Sem nome"}
        </h1>
        <p className="text-sm text-cinza-2">{email}</p>
        <p className="mt-1 text-xs text-cinza-3">
          Criado em {formatarDataBr(profile.criado_em.slice(0, 10))}
        </p>
      </div>

      <section className="rounded-[16px] border border-borda bg-cartao p-5">
        <h2 className="font-serif text-xl font-light">Assinatura</h2>
        {assinatura ? (
          <dl className="mt-4 grid gap-3 text-sm min-[640px]:grid-cols-2">
            <div>
              <dt className="text-[10px] uppercase tracking-[0.14em] text-cinza-2">
                Status
              </dt>
              <dd>{assinatura.status}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-[0.14em] text-cinza-2">
                Plano
              </dt>
              <dd>{assinatura.plano}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-[0.14em] text-cinza-2">
                Limite de obras
              </dt>
              <dd>{assinatura.limite_obras}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-[0.14em] text-cinza-2">
                Trial fim
              </dt>
              <dd>
                {assinatura.trial_fim
                  ? formatarDataBr(assinatura.trial_fim.slice(0, 10))
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-[0.14em] text-cinza-2">
                Relatórios no trial
              </dt>
              <dd>{assinatura.relatorios_enviados_trial}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-[0.14em] text-cinza-2">
                AbacatePay sub
              </dt>
              <dd className="truncate font-mono text-xs">
                {assinatura.abacatepay_subscription_id || "—"}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="mt-3 text-sm text-cinza-2">Sem assinatura</p>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-serif text-xl font-light">Obras</h2>
          <ReenviarConvitesBotao userId={userId} />
        </div>
        <ul className="divide-y divide-divisor rounded-[16px] border border-borda">
          {(obras ?? []).length === 0 ? (
            <li className="px-4 py-6 text-sm text-cinza-2">Nenhuma obra</li>
          ) : (
            (obras ?? []).map((o) => (
              <li
                key={o.id}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <span>{o.nome}</span>
                <span className="text-xs text-cinza-2">
                  {o.arquivada_em ? "arquivada" : "ativa"}
                </span>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
