import { formatarBRL } from "@/lib/formatacao";
import { createClient } from "@/lib/supabase/server";

type PayloadKpis = {
  assinaturas?: { status: string; trialFim: string | null }[];
  obrasAtivas?: number;
  relatorios30d?: number;
};

type PayloadCobranca = {
  mrrCentavos?: number;
  porStatus?: Record<string, number>;
  inadimplentes?: { obraNome: string; responsavel: string; desde: string }[];
  canceladasSemPedido30d?: number;
  eventosComErro30d?: number;
};

const ROTULO_STATUS: Record<string, string> = {
  ativa: "ativa",
  inadimplente: "pagamento pendente",
  cancelamento_agendado: "cancelamento agendado",
  cancelada: "cancelada",
};

export default async function AdminKpisPage() {
  const supabase = await createClient();
  const [{ data }, { data: cobrancaData }] = await Promise.all([
    supabase.rpc("fn_admin_kpis"),
    supabase.rpc("fn_admin_cobranca"),
  ]);
  const payload = (data ?? {}) as PayloadKpis;
  const cobranca = (cobrancaData ?? {}) as PayloadCobranca;

  const agora = Date.now();
  let trialsAtivos = 0;
  let trialsExpirados = 0;
  for (const a of payload.assinaturas ?? []) {
    if (a.status === "trial") {
      const fim = a.trialFim ? new Date(a.trialFim).getTime() : 0;
      if (fim > agora) trialsAtivos += 1;
      else trialsExpirados += 1;
    }
  }

  const porStatus = cobranca.porStatus ?? {};
  const inadimplentes = cobranca.inadimplentes ?? [];

  const kpis = [
    {
      titulo: "MRR estimado",
      valor: formatarBRL(cobranca.mrrCentavos ?? 0),
      detalhe: "Σ cobranças por obra ativas e com pagamento pendente",
    },
    {
      titulo: "Obras ativas",
      valor: String(payload.obrasAtivas ?? 0),
      detalhe: "não arquivadas",
    },
    {
      titulo: "Relatórios (30d)",
      valor: String(payload.relatorios30d ?? 0),
      detalhe: "enviados nos últimos 30 dias",
    },
    {
      titulo: "Trials ativos",
      valor: String(trialsAtivos),
      detalhe: "status trial · trial_fim no futuro",
    },
    {
      titulo: "Trials expirados",
      valor: String(trialsExpirados),
      detalhe: "status trial · trial_fim no passado",
    },
    {
      titulo: "Cancelamentos sem pedido (30d)",
      valor: String(cobranca.canceladasSemPedido30d ?? 0),
      detalhe: "tentativas esgotadas ou cancelamento direto no AbacatePay; conferir no painel",
    },
  ];

  return (
    <div className="space-y-8">
      <h1 className="font-serif text-3xl font-light">KPIs</h1>
      <ul className="grid gap-4 min-[800px]:grid-cols-3">
        {kpis.map((k) => (
          <li key={k.titulo} className="border-b border-divisor pb-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-cinza-2">
              {k.titulo}
            </p>
            <p className="mt-2 font-serif text-3xl font-light">{k.valor}</p>
            <p className="mt-1 text-xs text-cinza-3">{k.detalhe}</p>
          </li>
        ))}
      </ul>
      <div className="grid gap-6 min-[800px]:grid-cols-2 text-sm">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-cinza-2">
            Cobranças por status
          </p>
          <ul className="mt-2 space-y-1">
            {Object.entries(porStatus).map(([k, v]) => (
              <li key={k} className="flex justify-between">
                <span>{ROTULO_STATUS[k] ?? k}</span>
                <span className="tabular-nums">{v}</span>
              </li>
            ))}
            {Object.keys(porStatus).length === 0 && (
              <li className="text-cinza-2">Nenhuma cobrança por obra ainda.</li>
            )}
          </ul>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-cinza-2">
            Obras com pagamento pendente
          </p>
          <ul className="mt-2 space-y-1">
            {inadimplentes.map((i) => (
              <li key={`${i.obraNome}-${i.desde}`} className="flex justify-between gap-4">
                <span>
                  {i.obraNome}
                  {i.responsavel ? ` · ${i.responsavel}` : ""}
                </span>
                <span className="tabular-nums text-cinza-2">
                  desde {new Date(i.desde).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                </span>
              </li>
            ))}
            {inadimplentes.length === 0 && <li className="text-cinza-2">Nenhuma.</li>}
          </ul>
          {(cobranca.eventosComErro30d ?? 0) > 0 && (
            <p className="mt-3 text-xs text-marca">
              {cobranca.eventosComErro30d} evento(s) de assinatura com erro nos últimos 30 dias
              (ver webhooks_log).
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
