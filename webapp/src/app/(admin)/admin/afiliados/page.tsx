import Link from "next/link";
import { Selo } from "@/components/ui";
import { CopiarBotao } from "@/components/afiliados/CopiarBotao";
import { publicEnv } from "@/config/env";
import { descreverComissao, descreverDesconto } from "@/lib/afiliados/formatar";
import type { AdminAfiliados } from "@/lib/afiliados/tipos";
import { formatarBRL } from "@/lib/formatacao";
import { createClient } from "@/lib/supabase/server";
import { ConfigAfiliados } from "./ConfigAfiliados";
import { LinkAfiliadoBotao } from "./LinkAfiliadoBotao";

export const metadata = { title: "Afiliados · Admin" };

export default async function AdminAfiliadosPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_admin_afiliados");
  if (error || !data) {
    return (
      <div className="space-y-2">
        <h1 className="font-serif text-3xl font-light">Afiliados</h1>
        <p className="text-sm text-marca">Não foi possível carregar os afiliados.</p>
      </div>
    );
  }
  const { config, resumo, links } = data as unknown as AdminAfiliados;
  const base = publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

  const kpis = [
    {
      titulo: "Saques para pagar",
      valor: String(resumo.saquesPendentes),
      detalhe: `${formatarBRL(resumo.saquesPendentesCentavos)} em Pix a fazer`,
    },
    {
      titulo: "Saldo dos afiliados",
      valor: formatarBRL(resumo.saldoAfiliadosCentavos),
      detalhe: "disponível + em carência, já descontados saques",
    },
    {
      titulo: "Links ativos",
      valor: String(links.filter((l) => l.ativo).length),
      detalhe: `${links.length} no total`,
    },
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-light">Afiliados</h1>
          <p className="mt-1 text-sm text-cinza-2">
            Links de divulgação, comissões e saques via Pix.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Link href="/admin/afiliados/saques" className="text-marca underline-offset-2 hover:underline">
            Saques{resumo.saquesPendentes > 0 ? ` (${resumo.saquesPendentes})` : ""}
          </Link>
          <Link href="/admin/afiliados/comissoes" className="text-marca underline-offset-2 hover:underline">
            Comissões
          </Link>
          <LinkAfiliadoBotao />
        </div>
      </header>

      <ul className="grid gap-4 min-[800px]:grid-cols-3">
        {kpis.map((k) => (
          <li key={k.titulo} className="border-b border-divisor pb-4">
            <p className="text-[10px] uppercase tracking-[0.18em] text-cinza-2">{k.titulo}</p>
            <p className="mt-2 font-serif text-3xl font-light">{k.valor}</p>
            <p className="mt-1 text-xs text-cinza-3">{k.detalhe}</p>
          </li>
        ))}
      </ul>

      <section className="space-y-3">
        <h2 className="text-[10px] uppercase tracking-[0.18em] text-cinza-2">Regras gerais</h2>
        <ConfigAfiliados
          carenciaDias={config.carenciaDias}
          saqueMinimoCentavos={config.saqueMinimoCentavos}
        />
        <p className="text-xs text-cinza-3">
          A carência vale para comissões novas; o mínimo vale para saques novos.
        </p>
      </section>

      <div className="overflow-x-auto rounded-[16px] border border-borda">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-divisor bg-cartao text-[10px] uppercase tracking-[0.14em] text-cinza-2">
            <tr>
              <th className="px-4 py-3 font-medium">Link</th>
              <th className="px-4 py-3 font-medium">Afiliado</th>
              <th className="px-4 py-3 font-medium">Comissão</th>
              <th className="px-4 py-3 font-medium">Desconto</th>
              <th className="px-4 py-3 font-medium">Cadastros</th>
              <th className="px-4 py-3 font-medium">Assinantes</th>
              <th className="px-4 py-3 font-medium">Ganhos</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {links.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-cinza-2">
                  Nenhum link ainda. Crie o primeiro em “Novo link”.
                </td>
              </tr>
            ) : (
              links.map((l) => (
                <tr key={l.id} className="border-b border-divisor last:border-0 align-top">
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs">/r/{l.codigo}</p>
                    {l.rotulo ? <p className="text-xs text-cinza-2">{l.rotulo}</p> : null}
                    <div className="mt-1.5 flex items-center gap-2">
                      {l.ativo ? <Selo tom="verde">ativo</Selo> : <Selo tom="cinza">inativo</Selo>}
                      <CopiarBotao texto={`${base}/r/${l.codigo}`} rotulo="Copiar link" aviso="Link copiado" />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p>{l.afiliadoNome || "—"}</p>
                    <p className="text-xs text-cinza-2">{l.afiliadoEmail}</p>
                  </td>
                  <td className="px-4 py-3">{descreverComissao(l.comissaoBps, l.vitalicia)}</td>
                  <td className="px-4 py-3">
                    {descreverDesconto(l.descontoBps, l.descontoDuracao) ?? (
                      <span className="text-cinza-3">sem desconto</span>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{l.cadastros}</td>
                  <td className="px-4 py-3 tabular-nums">{l.assinantes}</td>
                  <td className="px-4 py-3 tabular-nums">{formatarBRL(l.ganhosCentavos)}</td>
                  <td className="px-4 py-3 text-right">
                    <LinkAfiliadoBotao link={l} />
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
