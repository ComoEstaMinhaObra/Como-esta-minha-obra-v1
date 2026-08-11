import { EMAIL_EXTRA, PLANOS } from "@/config/pricing";
import { createClient } from "@/lib/supabase/server";
import { PlanosCliente } from "./PlanosCliente";

export default async function PlanosPage({
  searchParams,
}: {
  searchParams: Promise<{ sucesso?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: assinatura } = user
    ? await supabase
        .from("assinaturas")
        .select("status, plano, trial_fim, limite_obras")
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };

  const trialDiasRestantes =
    assinatura?.status === "trial" && assinatura.trial_fim
      ? Math.max(
          0,
          Math.ceil(
            (new Date(assinatura.trial_fim).getTime() - Date.now()) /
              (1000 * 60 * 60 * 24),
          ),
        )
      : null;

  return (
    <PlanosCliente
      planos={PLANOS}
      planoAtual={assinatura?.plano ?? "trial"}
      status={assinatura?.status ?? "trial"}
      trialDiasRestantes={trialDiasRestantes}
      sucesso={sp.sucesso === "1"}
      emailExtraCentavos={EMAIL_EXTRA.precoCentavos}
    />
  );
}
