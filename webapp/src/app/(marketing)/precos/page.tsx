import Link from "next/link";
import type { Metadata } from "next";
import { Botao } from "@/components/ui";
import {
  EMAIL_ADICIONAL,
  OBRA_ATIVA,
  TRIAL,
  calcularTotalMensal,
} from "@/config/pricing";
import { formatarBRL } from "@/lib/formatacao";

export const metadata: Metadata = {
  title: "Preços",
  description:
    "Uma assinatura mensal por obra ativa, sem limite de obras. Trial sem cartão. E-mail adicional a partir do segundo destinatário.",
  openGraph: {
    title: "Preços · Como Está Minha Obra",
    description: "Uma assinatura mensal por obra ativa. Trial sem cartão.",
    type: "website",
  },
};

const INCLUI = [
  "Relatórios ilimitados",
  "Página do cliente",
  "PDF do relatório",
  "Clima automático",
  "1 e-mail com acesso por obra, sem custo",
] as const;

export default function PrecosPage() {
  return (
    <div className="mx-auto max-w-[1240px] px-4 py-16">
      <header className="max-w-2xl space-y-3">
        <h1 className="font-serif text-4xl font-light">Preços</h1>
        <p className="text-cinza-2">
          {TRIAL.dias} dias grátis com emissão de {TRIAL.limiteRelatorios}{" "}
          relatório, sem cartão. Depois, uma assinatura mensal por obra ativa,
          em reais.
        </p>
      </header>

      <div className="mt-12 grid gap-4 min-[800px]:grid-cols-3">
        <div className="flex flex-col rounded-[20px] bg-escuro p-6 text-white">
          <h2 className="font-serif text-2xl font-light">Obra ativa</h2>
          <p className="mt-3 font-serif text-4xl font-light">
            {formatarBRL(OBRA_ATIVA.precoCentavos)}
            <span className="text-sm text-white/50">/mês por obra</span>
          </p>
          <ul className="mt-5 flex-1 space-y-2 text-sm text-white/75">
            {INCLUI.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
          <Link href="/entrar" className="mt-6 block">
            <Botao className="w-full" variante="primario">
              Começar grátis
            </Botao>
          </Link>
        </div>

        <div className="rounded-[20px] border border-borda bg-cartao p-6 min-[800px]:col-span-2">
          <h2 className="font-serif text-2xl font-light">Quanto fica</h2>
          <table className="mt-4 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-divisor text-cinza-2">
                <th className="py-2 pr-4 font-normal">Obras ativas</th>
                <th className="py-2 font-normal">Total por mês</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map((n) => (
                <tr key={n} className="border-b border-divisor">
                  <td className="py-2 pr-4">{n}</td>
                  <td className="py-2 text-cinza-2">
                    {formatarBRL(calcularTotalMensal(n))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 text-sm text-cinza-2">
            Não há limite de obras nem faixas de plano. Cada obra ativa tem a
            sua assinatura e a sua fatura, com data de cobrança própria. Você
            cancela só as obras que quiser: cada uma mantém todos os recursos até
            o fim do período que você já pagou e depois fica somente leitura. Não
            há devolução proporcional.
          </p>
        </div>
      </div>

      <section className="mt-16 max-w-xl border-t border-divisor pt-10">
        <h2 className="font-serif text-2xl font-light">E-mail adicional</h2>
        <p className="mt-3 text-sm text-cinza-2">
          O primeiro e-mail com acesso por obra é gratuito. Cada acesso adicional
          custa{" "}
          <strong className="text-tinta">
            {formatarBRL(EMAIL_ADICIONAL.precoCentavos)}
          </strong>{" "}
          a cada 30 dias, cobrado na fatura da obra a partir do momento em que o
          convidado aceita o acesso. Remover o acesso encerra a renovação.
        </p>
      </section>
    </div>
  );
}
