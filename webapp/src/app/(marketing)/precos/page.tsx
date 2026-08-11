import Link from "next/link";
import type { Metadata } from "next";
import { Botao } from "@/components/ui";
import { EMAIL_EXTRA, PLANOS, TRIAL } from "@/config/pricing";
import { formatarBRL } from "@/lib/formatacao";

export const metadata: Metadata = {
  title: "Preços",
  description:
    "Planos mensais por número de obras ativas. Trial sem cartão. E-mail extra a partir do segundo destinatário.",
  openGraph: {
    title: "Preços · Como Está Minha Obra",
    description:
      "Planos mensais por número de obras ativas. Trial sem cartão.",
    type: "website",
  },
};

const FEATURES = [
  { nome: "Obras ativas", valores: PLANOS.map((p) => String(p.limiteObras)) },
  { nome: "Relatórios", valores: ["Ilimitados", "Ilimitados", "Ilimitados"] },
  { nome: "Página do cliente", valores: ["Sim", "Sim", "Sim"] },
  { nome: "PDF", valores: ["Sim", "Sim", "Sim"] },
  { nome: "Clima automático", valores: ["Sim", "Sim", "Sim"] },
  {
    nome: "1º e-mail por obra",
    valores: ["Grátis", "Grátis", "Grátis"],
  },
] as const;

export default function PrecosPage() {
  return (
    <div className="mx-auto max-w-[1240px] px-4 py-16">
      <header className="max-w-2xl space-y-3">
        <h1 className="font-serif text-4xl font-light">Preços</h1>
        <p className="text-cinza-2">
          {TRIAL.dias} dias grátis com {TRIAL.limiteRelatorios} relatório. Sem
          cartão no trial. Valores em reais, cobrados mensalmente.
        </p>
      </header>

      <div className="mt-12 grid gap-4 min-[800px]:grid-cols-3">
        {PLANOS.map((p) => (
          <div
            key={p.id}
            className={`flex flex-col rounded-[20px] p-6 ${
              p.id === "obra_3"
                ? "bg-escuro text-white"
                : "border border-borda bg-cartao"
            }`}
          >
            {p.id === "obra_3" && (
              <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-marca-clara">
                Recomendado
              </p>
            )}
            <h2 className="font-serif text-2xl font-light">{p.nome}</h2>
            <p className="mt-3 font-serif text-4xl font-light">
              {formatarBRL(p.precoCentavos)}
              <span
                className={`text-sm ${p.id === "obra_3" ? "text-white/50" : "text-cinza-2"}`}
              >
                /mês
              </span>
            </p>
            <ul
              className={`mt-5 flex-1 space-y-2 text-sm ${
                p.id === "obra_3" ? "text-white/75" : "text-cinza-2"
              }`}
            >
              <li>
                Até {p.limiteObras} obra{p.limiteObras > 1 ? "s" : ""} ativa
                {p.limiteObras > 1 ? "s" : ""}
              </li>
              <li>Relatórios ilimitados</li>
              <li>Página do cliente + PDF + clima</li>
            </ul>
            <Link href="/entrar" className="mt-6 block">
              <Botao
                className="w-full"
                variante={p.id === "obra_3" ? "primario" : "terciario"}
              >
                Começar grátis
              </Botao>
            </Link>
          </div>
        ))}
      </div>

      <section className="mt-16 overflow-x-auto">
        <h2 className="font-serif text-2xl font-light">Comparativo</h2>
        <table className="mt-6 w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-divisor text-cinza-2">
              <th className="py-3 pr-4 font-normal">Recurso</th>
              {PLANOS.map((p) => (
                <th key={p.id} className="py-3 px-2 font-normal">
                  {p.nome}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FEATURES.map((row) => (
              <tr key={row.nome} className="border-b border-divisor">
                <td className="py-3 pr-4">{row.nome}</td>
                {row.valores.map((v, i) => (
                  <td key={PLANOS[i].id} className="py-3 px-2 text-cinza-2">
                    {v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-16 max-w-xl border-t border-divisor pt-10">
        <h2 className="font-serif text-2xl font-light">E-mail extra</h2>
        <p className="mt-3 text-sm text-cinza-2">
          O primeiro e-mail com acesso por obra é gratuito. Cada destinatário
          adicional custa{" "}
          <strong className="text-tinta">
            {formatarBRL(EMAIL_EXTRA.precoCentavos)}
          </strong>{" "}
          por ciclo, consolidado na próxima parcela da assinatura (sem
          pró-rata).
        </p>
      </section>
    </div>
  );
}
