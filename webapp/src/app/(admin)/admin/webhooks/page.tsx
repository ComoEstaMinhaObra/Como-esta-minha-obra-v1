import { createClient } from "@/lib/supabase/server";
import { formatarDataBr } from "@/lib/datas";
import { ReprocessarWebhookBotao } from "./ReprocessarWebhookBotao";

export default async function AdminWebhooksPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("fn_admin_webhooks");
  const payload = (data ?? {}) as {
    webhooks?: {
      id: string;
      eventId: string;
      evento: string;
      processado: boolean;
      erro: string | null;
      recebidoEm: string;
    }[];
    outbox?: {
      id: string;
      operacao: string;
      status: string;
      tentativas: number;
      erro: string | null;
      criadoEm: string;
    }[];
  };
  const logs = payload.webhooks ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-3xl font-light">Webhooks</h1>
        <p className="mt-1 text-sm text-cinza-2">
          Eventos sanitizados · reprocessar só estados não processados
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
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-cinza-2">
                  Nenhum webhook registrado
                </td>
              </tr>
            ) : (
              logs.map((l) => (
                <tr key={l.id} className="border-b border-divisor last:border-0">
                  <td className="px-4 py-3 font-mono text-xs">{l.evento}</td>
                  <td className="px-4 py-3">{l.processado ? "sim" : "não"}</td>
                  <td className="max-w-[240px] truncate px-4 py-3 text-xs text-cinza-2">
                    {l.erro || "—"}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {formatarDataBr(l.recebidoEm.slice(0, 10))}
                  </td>
                  <td className="px-4 py-3">
                    {!l.processado ? <ReprocessarWebhookBotao logId={l.id} /> : "—"}
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
