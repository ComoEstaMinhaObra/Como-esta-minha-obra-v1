import { publicEnv } from "@/config/env";
import { EMAIL_ADICIONAL, OBRA_ATIVA } from "@/config/pricing";
import { descontoDaObra } from "@/lib/afiliados/desconto";
import { montarResumoCobranca } from "@/lib/cobranca/estado";
import { logSeguro } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { CobrancaCliente, type DescontoTela } from "./CobrancaCliente";

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
            .select("status, trial_fim, relatorios_enviados_trial, conta_livre")
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

  // Desconto de afiliado (link do indicado) das obras que ainda podem ser contratadas. É só
  // exibição: o valor cobrado é decidido de novo, no servidor, na hora de contratar.
  const descontos: Record<string, DescontoTela> = {};
  if (user && !conta?.conta_livre) {
    const comCobranca = new Set(
      (cobrancas ?? []).filter((c) => c.status !== "cancelada").map((c) => c.obra_id),
    );
    const candidatas = (obras ?? []).filter((o) => !o.arquivada_em && !comCobranca.has(o.id));
    try {
      const admin = createAdminClient();
      const lista = await Promise.all(
        candidatas.map(
          async (o) =>
            [o.id, await descontoDaObra(admin, user.id, o.id, OBRA_ATIVA.precoCentavos, false)] as const,
        ),
      );
      for (const [id, d] of lista) {
        if (d.descontoCentavos > 0 && d.duracao) {
          descontos[id] = { descontoCentavos: d.descontoCentavos, duracao: d.duracao };
        }
      }
    } catch {
      logSeguro("error", { evento: "cobranca_desconto_previa" });
    }
  }

  return (
    <CobrancaCliente
      resumo={resumo}
      precoObraCentavos={OBRA_ATIVA.precoCentavos}
      precoEmailCentavos={EMAIL_ADICIONAL.precoCentavos}
      descontos={descontos}
      vagaPaga={
        v?.disponivel && v.acessoAte
          ? { acessoAte: new Date(v.acessoAte), dias: v.dias ?? 0 }
          : null
      }
      sucesso={sp.sucesso === "1"}
      obraDestaque={sp.obra ?? null}
      chavePublicaMp={publicEnv.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY ?? null}
    />
  );
}
