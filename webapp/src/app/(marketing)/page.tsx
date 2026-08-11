import Link from "next/link";
import { Botao } from "@/components/ui";
import { EMAIL_EXTRA, PLANOS, TRIAL } from "@/config/pricing";
import { formatarBRL } from "@/lib/formatacao";

const FAQ = [
  {
    q: "O trial pede cartão?",
    a: `Não. Você tem ${TRIAL.dias} dias e ${TRIAL.limiteRelatorios} envio de relatório sem cartão. O checkout só aparece na conversão.`,
  },
  {
    q: "Posso cancelar quando quiser?",
    a: "Sim. Em Conta você cancela a assinatura. A conta fica em modo somente leitura: obras e PDFs continuam acessíveis.",
  },
  {
    q: "O que é e-mail extra?",
    a: `O primeiro destinatário por obra é grátis. Do segundo em diante cobramos ${formatarBRL(EMAIL_EXTRA.precoCentavos)} por ciclo, na próxima parcela.`,
  },
  {
    q: "E se eu precisar de mais obras?",
    a: "Faça upgrade em Planos. A troca entra no próximo ciclo, sem pró-rata. No downgrade, arquive obras excedentes antes.",
  },
  {
    q: "Meus dados estão seguros?",
    a: "Usamos Supabase (RLS), Storage privado e operadores alinhados à LGPD. Detalhes em Política de privacidade.",
  },
] as const;

export default function LandingPage() {
  return (
    <div>
      {/* Hero full-bleed */}
      <section className="relative isolate min-h-[calc(100svh-65px)] overflow-hidden bg-escuro text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 80% 60% at 70% 40%, #4a3327 0%, transparent 55%), linear-gradient(120deg, transparent 40%, rgba(242,92,31,0.18) 100%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(-18deg, #fff 0 1px, transparent 1px 14px)",
          }}
        />
        <div className="relative mx-auto flex min-h-[calc(100svh-65px)] max-w-[1240px] flex-col justify-end px-4 pb-16 pt-24 min-[800px]:justify-center min-[800px]:pb-24">
          <p className="font-serif text-2xl font-light tracking-tight min-[800px]:text-3xl animate-[fadeUp_0.7s_ease_both]">
            Como Está Minha Obra
          </p>
          <h1 className="mt-4 max-w-xl font-serif text-4xl font-light leading-[1.1] min-[800px]:text-6xl animate-[fadeUp_0.8s_ease_0.08s_both]">
            Da fundação à entrega, tudo registrado.
          </h1>
          <p className="mt-5 max-w-md text-base text-white/70 min-[800px]:text-lg animate-[fadeUp_0.8s_ease_0.16s_both]">
            Relatórios semanais com avanço físico, financeiro, fotos e clima —
            o cliente acompanha sem WhatsApp eterno.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 animate-[fadeUp_0.8s_ease_0.24s_both]">
            <Link href="/entrar">
              <Botao variante="primario">
                Começar grátis — {TRIAL.dias} dias
              </Botao>
            </Link>
            <Link href="/precos">
              <Botao
                variante="secundario"
                className="border-white/30 text-white hover:bg-white/10"
              >
                Ver preços
              </Botao>
            </Link>
          </div>
        </div>
      </section>

      {/* Problema → solução */}
      <section className="mx-auto max-w-[1240px] px-4 py-20">
        <p className="text-[10px] uppercase tracking-[0.18em] text-cinza-2">
          Proposta de valor
        </p>
        <h2 className="mt-3 max-w-2xl font-serif text-3xl font-light min-[800px]:text-4xl">
          Pare de gerenciar obra no WhatsApp.
        </h2>
        <div className="mt-10 grid gap-10 min-[800px]:grid-cols-2">
          <div>
            <h3 className="font-serif text-xl font-light text-cinza-2">
              Sem a plataforma
            </h3>
            <ul className="mt-4 space-y-3 text-sm text-cinza-2">
              <li>Fotos espalhadas em grupos e conversas privadas</li>
              <li>Cliente pergunta “e o prazo?” toda semana</li>
              <li>Avanço físico e financeiro vivem em planilhas soltas</li>
              <li>Histórico se perde quando o celular troca</li>
            </ul>
          </div>
          <div>
            <h3 className="font-serif text-xl font-light">Com a plataforma</h3>
            <ul className="mt-4 space-y-3 text-sm">
              <li>Um relatório semanal estruturado, com PDF</li>
              <li>Página do proprietário com linha do tempo e galeria</li>
              <li>Avanço ponderado, medições e clima no mesmo lugar</li>
              <li>Convite por e-mail — acesso controlado, não link público</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Como funciona */}
      <section className="border-y border-divisor bg-cartao">
        <div className="mx-auto max-w-[1240px] px-4 py-20">
          <h2 className="font-serif text-3xl font-light">Como funciona</h2>
          <ol className="mt-10 grid gap-8 min-[800px]:grid-cols-3">
            {[
              {
                n: "01",
                t: "Crie a obra",
                d: "Ficha completa, etapas com peso e equipe. Em minutos.",
              },
              {
                n: "02",
                t: "Envie o relatório",
                d: "Avanço, financeiro, fotos, prazo e clima — um envio por semana.",
              },
              {
                n: "03",
                t: "Cliente acompanha",
                d: "Página dedicada no celular, sem instalar app.",
              },
            ].map((p) => (
              <li key={p.n}>
                <p className="font-serif text-4xl font-light text-marca">{p.n}</p>
                <h3 className="mt-3 font-serif text-xl font-light">{p.t}</h3>
                <p className="mt-2 text-sm text-cinza-2">{p.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-[1240px] px-4 py-20">
        <h2 className="font-serif text-3xl font-light">O que entra no relatório</h2>
        <ul className="mt-10 grid gap-6 min-[800px]:grid-cols-3">
          {[
            "Avanço físico ponderado por etapa",
            "Financeiro: medições, materiais, aditivos",
            "Fotos organizadas por atividade",
            "Clima dos últimos dias (Open-Meteo)",
            "PDF gerado no envio",
            "Linha do tempo para o proprietário",
          ].map((f) => (
            <li
              key={f}
              className="border-t border-divisor pt-4 text-sm min-[800px]:text-base"
            >
              {f}
            </li>
          ))}
        </ul>
      </section>

      {/* Planos */}
      <section className="border-t border-divisor bg-escuro text-white">
        <div className="mx-auto max-w-[1240px] px-4 py-20">
          <h2 className="font-serif text-3xl font-light">Planos mensais</h2>
          <p className="mt-2 text-sm text-white/60">
            Trial de {TRIAL.dias} dias · {TRIAL.limiteRelatorios} relatório ·
            sem cartão
          </p>
          <div className="mt-10 grid gap-6 min-[800px]:grid-cols-3">
            {PLANOS.map((p) => (
              <div
                key={p.id}
                className={`rounded-[20px] p-6 ${
                  p.id === "obra_3"
                    ? "bg-marca text-white"
                    : "border border-white/15 bg-white/5"
                }`}
              >
                {p.id === "obra_3" && (
                  <p className="mb-2 text-[10px] uppercase tracking-[0.18em]">
                    Recomendado
                  </p>
                )}
                <h3 className="font-serif text-2xl font-light">{p.nome}</h3>
                <p className="mt-2 font-serif text-3xl font-light">
                  {formatarBRL(p.precoCentavos)}
                  <span className="text-sm opacity-70">/mês</span>
                </p>
                <p className="mt-4 text-sm opacity-80">
                  Até {p.limiteObras} obra{p.limiteObras > 1 ? "s" : ""} ·
                  relatórios ilimitados
                </p>
              </div>
            ))}
          </div>
          <div className="mt-8">
            <Link href="/entrar">
              <Botao variante="primario">Começar grátis</Botao>
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-[1240px] px-4 py-20">
        <h2 className="font-serif text-3xl font-light">Perguntas frequentes</h2>
        <dl className="mt-10 space-y-6">
          {FAQ.map((item) => (
            <div key={item.q} className="border-t border-divisor pt-4">
              <dt className="font-medium">{item.q}</dt>
              <dd className="mt-2 text-sm text-cinza-2">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
