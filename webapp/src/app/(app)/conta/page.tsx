import { Botao } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { sair } from "./actions";
import { CancelarAssinatura } from "./CancelarAssinatura";

export default async function ContaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("nome").eq("id", user.id).maybeSingle()
    : { data: null };

  const { data: assinatura } = user
    ? await supabase
        .from("assinaturas")
        .select("status, plano, trial_fim, limite_obras")
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };

  const diasTrial =
    assinatura?.trial_fim != null
      ? Math.max(
          0,
          Math.ceil(
            (new Date(assinatura.trial_fim).getTime() - Date.now()) /
              (1000 * 60 * 60 * 24),
          ),
        )
      : null;

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="font-serif text-3xl font-light">Conta</h1>
      <dl className="space-y-3 text-sm">
        <div>
          <dt className="text-cinza-2">Nome</dt>
          <dd>{profile?.nome || "—"}</dd>
        </div>
        <div>
          <dt className="text-cinza-2">E-mail</dt>
          <dd>{user?.email ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-cinza-2">Plano</dt>
          <dd>
            {assinatura?.plano ?? "—"} · {assinatura?.status ?? "—"}
            {assinatura?.status === "trial" && diasTrial != null
              ? ` · ${diasTrial} dia(s) restantes`
              : null}
          </dd>
        </div>
      </dl>

      {assinatura?.status === "ativa" ? <CancelarAssinatura /> : null}

      <form action={sair}>
        <Botao type="submit" variante="secundario">
          Sair
        </Botao>
      </form>
    </div>
  );
}
