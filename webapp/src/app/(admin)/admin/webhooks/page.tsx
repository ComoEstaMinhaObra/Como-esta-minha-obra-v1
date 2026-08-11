import { createClient } from "@/lib/supabase/server";
import { formatarDataBr } from "@/lib/datas";
import { ReprocessarWebhookBotao } from "./ReprocessarWebhookBotao";

export default async function AdminWebhooksPage() {
  const supabase = await createClient();
  const { data: logs } = await supabase
    .from("webhooks_log")
    .select("id, evento, processado, erro, recebido_em, provedor")
    .order("recebido_em", { ascending: false })
    .limit(200);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-3xl font-light">Webhooks</h1>
        <p className="mt-1 text-sm text-cinza-2">
          Últimos 200 eventos · AbacatePay
        </p>
      </header>

      <div className="overflow-x-auto rounded-[16px] border border-borda">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="border-b border-divisor bg-cartao text-[10px] uppercase tracking-[0.14em] text-cinza-2">
            <tr>
              <th className="px-4 py-3 font-medium">Evento</th>
              <th className="px-4 py-3 font-medium">Processado</th>
              <th className="px-4 py-3 font-medium">Erro</th>
              <th className="px-4 py-3 font-medium">Recebido</th>
              <th className="px-4 py-3 font-medium">Ação</th>
            </tr>
          </thead>
          <tbody>
            {(logs ?? []).length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-cinza-2">
                  Nenhum webhook registrado
                </td>
              </tr>
            ) : (
              (logs ?? []).map((l) => (
                <tr key={l.id} className="border-b border-divisor last:border-0">
                  <td className="px-4 py-3 font-mono text-xs">{l.evento}</td>
                  <td className="px-4 py-3">
                    {l.processado ? "sim" : "não"}
                  </td>
                  <td className="max-w-[240px] truncate px-4 py-3 text-xs text-cinza-2">
                    {l.erro || "—"}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {formatarDataBr(l.recebido_em.slice(0, 10))}{" "}
                    <span className="text-cinza-3">
                      {l.recebido_em.slice(11, 19)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <ReprocessarWebhookBotao logId={l.id} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
