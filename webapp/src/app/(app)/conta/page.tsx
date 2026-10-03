import Link from "next/link";
import { Botao } from "@/components/ui";
import { montarResumoCobranca } from "@/lib/cobranca/estado";
import { formatarBRL } from "@/lib/formatacao";
import { createClient } from "@/lib/supabase/server";
import { sair } from "./actions";
import { CancelarAssinatura } from "./CancelarAssinatura";

export default async function ContaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: assinatura }, { data: obras }, { data: cobrancas }] =
    user
      ? await Promise.all([
          supabase.from("profiles").select("nome").eq("id", user.id).maybeSingle(),
          supabase
            .from("assinaturas")
            .select("status, trial_fim, relatorios_enviados_trial")
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase.from("obras").select("id, nome, arquivada_em").eq("owner_id", user.id),
          supabase
            .from("cobrancas_obra")
            .select(
              "obra_id, status, valor_centavos, periodo_fim, primeira_cobranca_em, inadimplente_desde, acesso_ate, criado_em",
            )
            .eq("user_id", user.id),
        ])
      : [{ data: null }, { data: null }, { data: null }, { data: null }];

  const resumo = montarResumoCobranca(obras ?? [], cobrancas ?? [], assinatura ?? null);
  const ativas = resumo.linhas.filter((l) => l.estado === "ativa").length;
  const pendentes = resumo.linhas.filter((l) => l.estado === "inadimplente").length;

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
          <dt className="text-cinza-2">Cobrança</dt>
          <dd>
            {resumo.trial
              ? `Trial · ${resumo.trial.diasRestantes} dia(s) restantes`
              : ativas + pendentes > 0
                ? `${ativas} obra${ativas === 1 ? "" : "s"} com cobrança ativa · ${formatarBRL(resumo.totalMensalCentavos)}/mês${pendentes > 0 ? ` · ${pendentes} com pagamento pendente` : ""}`
                : assinatura?.status === "ativa"
                  ? "Assinatura anterior ativa"
                  : "Nenhuma cobrança ativa"}{" "}
            <Link href="/cobranca" className="underline">
              Ver cobrança
            </Link>
          </dd>
        </div>
      </dl>

      {/* Assinatura do modelo antigo (conta inteira): sai na limpeza da E5. */}
      {assinatura?.status === "ativa" ? <CancelarAssinatura /> : null}

      <form action={sair}>
        <Botao type="submit" variante="secundario">
          Sair
        </Botao>
      </form>
    </div>
  );
}
