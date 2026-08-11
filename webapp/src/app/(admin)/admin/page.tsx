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

  const [
    { data: assinaturas },
    { count: obrasAtivas },
    { count: relatorios30d },
  ] = await Promise.all([
    supabase.from("assinaturas").select("status, plano, trial_fim"),
    supabase
      .from("obras")
      .select("id", { count: "exact", head: true })
      .is("arquivada_em", null),
    supabase
      .from("relatorios")
      .select("id", { count: "exact", head: true })
      .eq("status", "enviado")
      .gte(
        "enviado_em",
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      ),
  ]);

  const lista = assinaturas ?? [];
  const agora = Date.now();

  const porStatus: Record<string, number> = {};
  const porPlano: Record<string, number> = {};
  let mrrCentavos = 0;
  let trialsAtivos = 0;
  let trialsExpirados = 0;

  for (const a of lista) {
    porStatus[a.status] = (porStatus[a.status] ?? 0) + 1;
    porPlano[a.plano] = (porPlano[a.plano] ?? 0) + 1;

    if (a.status === "ativa") {
      mrrCentavos += precoPlanoAtivo(a.plano);
    }

    if (a.status === "trial") {
      const fim = a.trial_fim ? new Date(a.trial_fim).getTime() : 0;
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
      valor: String(obrasAtivas ?? 0),
      detalhe: "não arquivadas",
    },
    {
      titulo: "Relatórios (30d)",
      valor: String(relatorios30d ?? 0),
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
      detalhe: "status trial · trial_fim passado",
    },
  ];

  return (
    <div className="space-y-10">
      <header>
        <h1 className="font-serif text-3xl font-light">Painel</h1>
        <p className="mt-1 text-sm text-cinza-2">
          Visão operacional · dados ao vivo via RLS admin
        </p>
      </header>

      <section className="grid gap-3 min-[640px]:grid-cols-2 min-[960px]:grid-cols-3">
        {kpis.map((k) => (
          <div
            key={k.titulo}
            className="rounded-[16px] border border-borda bg-cartao p-4"
          >
            <p className="text-[10px] uppercase tracking-[0.16em] text-cinza-2">
              {k.titulo}
            </p>
            <p className="mt-2 font-serif text-2xl font-light">{k.valor}</p>
            <p className="mt-1 text-xs text-cinza-3">{k.detalhe}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 min-[800px]:grid-cols-2">
        <div>
          <h2 className="font-serif text-xl font-light">Assinantes por status</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {Object.entries(porStatus).length === 0 ? (
              <li className="text-cinza-2">Nenhuma assinatura</li>
            ) : (
              Object.entries(porStatus).map(([status, n]) => (
                <li
                  key={status}
                  className="flex justify-between border-b border-divisor py-2"
                >
                  <span>{status}</span>
                  <span className="tabular-nums">{n}</span>
                </li>
              ))
            )}
          </ul>
        </div>
        <div>
          <h2 className="font-serif text-xl font-light">Assinantes por plano</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {Object.entries(porPlano).length === 0 ? (
              <li className="text-cinza-2">Nenhuma assinatura</li>
            ) : (
              Object.entries(porPlano).map(([plano, n]) => (
                <li
                  key={plano}
                  className="flex justify-between border-b border-divisor py-2"
                >
                  <span>{plano}</span>
                  <span className="tabular-nums">{n}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}
