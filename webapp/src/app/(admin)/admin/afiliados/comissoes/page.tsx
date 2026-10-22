import Link from "next/link";
import { Selo } from "@/components/ui";
import { formatarBps } from "@/lib/afiliados/formatar";
import type { ComissaoAdmin } from "@/lib/afiliados/tipos";
import { formatarBRL } from "@/lib/formatacao";
import { createClient } from "@/lib/supabase/server";
import { EstornarBotao } from "./EstornarBotao";

export const metadata = { title: "Comissões de afiliados · Admin" };

const data = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

export default async function AdminComissoesPage() {
  const supabase = await createClient();
  const { data: bruto, error } = await supabase.rpc("fn_admin_afiliado_comissoes", {
    p_limite: 200,
  });
  const comissoes = (error ? [] : (bruto ?? [])) as unknown as ComissaoAdmin[];
  const agora = Date.now();

  return (
    <div className="space-y-6">
      <header>
        <Link href="/admin/afiliados" className="text-sm text-cinza-2 hover:text-tinta">
          ← Afiliados
        </Link>
        <h1 className="mt-2 font-serif text-3xl font-light">Comissões</h1>
        <p className="mt-1 text-sm text-cinza-2">
          Últimas 200. Estorne quando o pagamento for reembolsado ou contestado.
        </p>
        {error ? <p className="mt-2 text-sm text-marca">Não foi possível carregar as comissões.</p> : null}
      </header>

      <div className="overflow-x-auto rounded-[16px] border border-borda">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-b border-divisor bg-cartao text-[10px] uppercase tracking-[0.14em] text-cinza-2">
            <tr>
              <th className="px-4 py-3 font-medium">Data</th>
              <th className="px-4 py-3 font-medium">Afiliado</th>
              <th className="px-4 py-3 font-medium">Indicado</th>
              <th className="px-4 py-3 font-medium">Pagamento</th>
              <th className="px-4 py-3 font-medium">Comissão</th>
              <th className="px-4 py-3 font-medium">Situação</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {comissoes.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-cinza-2">
                  Nenhuma comissão ainda.
                </td>
              </tr>
            ) : (
              comissoes.map((c) => (
                <tr key={c.id} className="border-b border-divisor last:border-0 align-top">
                  <td className="px-4 py-3 tabular-nums">{data(c.em)}</td>
                  <td className="px-4 py-3">
                    <p>{c.afiliadoNome || "—"}</p>
                    <p className="font-mono text-xs text-cinza-2">/r/{c.linkCodigo}</p>
                  </td>
                  <td className="px-4 py-3">{c.indicadoNome || "—"}</td>
                  <td className="px-4 py-3">
                    <p className="tabular-nums">
                      {c.baseCentavos !== null ? formatarBRL(c.baseCentavos) : "—"}
                    </p>
                    <p className="font-mono text-xs text-cinza-2">{c.pagamentoId}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="tabular-nums">{formatarBRL(c.valorCentavos)}</p>
                    {c.comissaoBps !== null ? (
                      <p className="text-xs text-cinza-2">{formatarBps(c.comissaoBps)}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {c.estornada ? (
                      <Selo tom="cinza">estornada</Selo>
                    ) : new Date(c.disponivelEm).getTime() > agora ? (
                      <Selo tom="ambar">libera em {data(c.disponivelEm)}</Selo>
                    ) : (
                      <Selo tom="verde">liberada</Selo>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {c.estornada ? null : <EstornarBotao lancamentoId={c.id} />}
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
