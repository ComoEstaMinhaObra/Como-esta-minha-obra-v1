import { EMAIL_ADICIONAL, OBRA_ATIVA } from "@/config/pricing";
import { montarResumoCobranca } from "@/lib/cobranca/estado";
import { createClient } from "@/lib/supabase/server";
import { CobrancaCliente } from "./CobrancaCliente";

export const metadata = { title: "Cobrança" };

export default async function CobrancaPage({
  searchParams,
}: {
  searchParams: Promise<{ sucesso?: string; obra?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: obras }, { data: cobrancas }, { data: conta }, { data: vaga }] =
    user
      ? await Promise.all([
          supabase
            .from("obras")
            .select("id, nome, arquivada_em")
            .eq("owner_id", user.id)
            .order("criado_em", { ascending: true }),
          supabase
            .from("cobrancas_obra")
            .select(
              "obra_id, status, valor_centavos, periodo_fim, primeira_cobranca_em, inadimplente_desde, acesso_ate, criado_em",
            )
            .eq("user_id", user.id),
          supabase
            .from("assinaturas")
            .select("status, trial_fim, relatorios_enviados_trial")
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase.rpc("fn_vaga_paga_disponivel"),
        ])
      : [
          { data: null },
          { data: null },
          { data: null },
          { data: null },
        ];

  const resumo = montarResumoCobranca(obras ?? [], cobrancas ?? [], conta ?? null);
  const v = vaga as { disponivel?: boolean; dias?: number; acessoAte?: string } | null;

  return (
    <CobrancaCliente
      resumo={resumo}
      precoObraCentavos={OBRA_ATIVA.precoCentavos}
      precoEmailCentavos={EMAIL_ADICIONAL.precoCentavos}
      vagaPaga={
        v?.disponivel && v.acessoAte
          ? { acessoAte: new Date(v.acessoAte), dias: v.dias ?? 0 }
          : null
      }
      sucesso={sp.sucesso === "1"}
      obraDestaque={sp.obra ?? null}
    />
  );
}
