import Link from "next/link";
import { Selo } from "@/components/ui";
import { formatarChavePix } from "@/lib/afiliados/pix";
import { ROTULO_TIPO_CHAVE, type SaqueAdmin } from "@/lib/afiliados/tipos";
import { formatarBRL } from "@/lib/formatacao";
import { createClient } from "@/lib/supabase/server";
import { SaqueAcoes } from "./SaqueAcoes";

export const metadata = { title: "Saques de afiliados · Admin" };

const data = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  });

export default async function AdminSaquesPage() {
  const supabase = await createClient();
  const { data: bruto, error } = await supabase.rpc("fn_admin_saques");
  const saques = (error ? [] : (bruto ?? [])) as unknown as SaqueAdmin[];

  return (
    <div className="space-y-6">
      <header>
        <Link href="/admin/afiliados" className="text-sm text-cinza-2 hover:text-tinta">
          ← Afiliados
        </Link>
        <h1 className="mt-2 font-serif text-3xl font-light">Saques</h1>
        <p className="mt-1 text-sm text-cinza-2">
          Faça o Pix para a chave informada e confirme aqui. A chave aparece completa só nesta tela.
        </p>
        {error ? <p className="mt-2 text-sm text-marca">Não foi possível carregar os saques.</p> : null}
      </header>

      <div className="overflow-x-auto rounded-[16px] border border-borda">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-divisor bg-cartao text-[10px] uppercase tracking-[0.14em] text-cinza-2">
            <tr>
              <th className="px-4 py-3 font-medium">Pedido</th>
              <th className="px-4 py-3 font-medium">Afiliado</th>
              <th className="px-4 py-3 font-medium">Valor</th>
              <th className="px-4 py-3 font-medium">Chave Pix</th>
              <th className="px-4 py-3 font-medium">Situação</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {saques.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-cinza-2">
                  Nenhum pedido de saque.
                </td>
              </tr>
            ) : (
              saques.map((s) => (
                <tr key={s.id} className="border-b border-divisor last:border-0 align-top">
                  <td className="px-4 py-3 tabular-nums">{data(s.solicitadoEm)}</td>
                  <td className="px-4 py-3">
                    <p>{s.afiliadoNome || "—"}</p>
                    <p className="text-xs text-cinza-2">{s.afiliadoEmail}</p>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{formatarBRL(s.valorCentavos)}</td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-cinza-2">{ROTULO_TIPO_CHAVE[s.tipoChave]}</p>
                    <p className="break-all font-mono text-xs">
                      {formatarChavePix(s.tipoChave, s.chavePix)}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {s.status === "solicitado" ? (
                      <Selo tom="ambar">para pagar</Selo>
                    ) : s.status === "pago" ? (
                      <Selo tom="verde">pago</Selo>
                    ) : (
                      <Selo tom="cinza">recusado</Selo>
                    )}
                    {s.resolvidoEm ? (
                      <p className="mt-1 text-xs text-cinza-2">{data(s.resolvidoEm)}</p>
                    ) : null}
                    {s.observacao ? <p className="mt-1 text-xs text-cinza-2">{s.observacao}</p> : null}
                  </td>
                  <td className="px-4 py-3">
                    {s.status === "solicitado" ? (
                      <SaqueAcoes saqueId={s.id} chave={formatarChavePix(s.tipoChave, s.chavePix)} />
                    ) : null}
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
