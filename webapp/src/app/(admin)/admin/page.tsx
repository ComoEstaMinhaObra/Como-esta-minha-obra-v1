import { PLANOS, type PlanoId } from "@/config/pricing";
import { formatarBRL } from "@/lib/formatacao";
import { createClient } from "@/lib/supabase/server";

function precoPlanoAtivo(plano: string): number {
  if (plano === "trial") return 0;
  const p = PLANOS.find((x) => x.id === (plano as PlanoId));
  return p?.precoCentavos ?? 0;
}

export default async function AdminKpisPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("fn_admin_kpis");
  const payload = (data ?? {}) as {
    assinaturas?: { status: string; plano: string; trialFim: string | null }[];
    obrasAtivas?: number;
    relatorios30d?: number;
  };

  const lista = payload.assinaturas ?? [];
  const agora = Date.now();

  const porStatus: Record<string, number> = {};
  const porPlano: Record<string, number> = {};
  let mrrCentavos = 0;
  let trialsAtivos = 0;
  let trialsExpirados = 0;

  for (const a of lista) {
    porStatus[a.status] = (porStatus[a.status] ?? 0) + 1;
    porPlano[a.plano] = (porPlano[a.plano] ?? 0) + 1;
    if (a.status === "ativa") mrrCentavos += precoPlanoAtivo(a.plano);
    if (a.status === "trial") {
      const fim = a.trialFim ? new Date(a.trialFim).getTime() : 0;
      if (fim > agora) trialsAtivos += 1;
      else trialsExpirados += 1;
    }
  }

  const kpis = [
    {
      titulo: "MRR estimado",
      valor: formatarBRL(mrrCentavos),
      detalhe: "Σ preço dos planos ativos (pricing.ts)",
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
            Por status
          </p>
          <ul className="mt-2 space-y-1">
            {Object.entries(porStatus).map(([k, v]) => (
              <li key={k} className="flex justify-between">
                <span>{k}</span>
                <span className="tabular-nums">{v}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-cinza-2">
            Por plano
          </p>
          <ul className="mt-2 space-y-1">
            {Object.entries(porPlano).map(([k, v]) => (
              <li key={k} className="flex justify-between">
                <span>{k}</span>
                <span className="tabular-nums">{v}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
