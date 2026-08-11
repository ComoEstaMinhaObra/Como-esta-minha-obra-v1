"use client";

import { useState, useTransition } from "react";
import { Botao, Cartao, CartaoEscuro, Selo } from "@/components/ui";
import { formatarBRL } from "@/lib/formatacao";
import type { Plano, PlanoId } from "@/config/pricing";
import { EMAIL_EXTRA, TRIAL } from "@/config/pricing";
import { agendarTrocaDePlano, iniciarCheckout } from "./actions";

const BENEFICIOS = [
  "Relatórios ilimitados",
  "Página do cliente",
  "PDF do relatório",
  "Clima automático",
] as const;

export function PlanosCliente({
  planos,
  planoAtual,
  status,
  trialDiasRestantes,
  sucesso,
  emailExtraCentavos,
}: {
  planos: Plano[];
  planoAtual: string;
  status: string;
  trialDiasRestantes: number | null;
  sucesso: boolean;
  emailExtraCentavos: number;
}) {
  const recomendado: PlanoId = "obra_3";
  const [selecionado, setSelecionado] = useState<PlanoId>(
    (planoAtual as PlanoId) in { obra_1: 1, obra_3: 1, obra_5: 1 }
      ? (planoAtual as PlanoId)
      : recomendado,
  );
  const [aviso, setAviso] = useState<string | null>(
    sucesso
      ? "Pagamento recebido. Aguardando confirmação do webhook para ativar o plano…"
      : null,
  );
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const assinate = status === "ativa";

  function onAssinar(planoId: PlanoId) {
    setErro(null);
    setAviso(null);
    startTransition(async () => {
      const r = await iniciarCheckout(planoId);
      if (r && !r.ok) {
        setErro(
          r.erro === "PRODUTO_NAO_CONFIGURADO"
            ? "Produtos AbacatePay ainda não configurados (rode o bootstrap)."
            : r.erro === "JA_ASSINANTE"
              ? "Você já tem uma assinatura ativa. Use trocar plano."
              : `Não foi possível iniciar o checkout (${r.erro}).`,
        );
      }
    });
  }

  function onTrocar(planoId: PlanoId) {
    setErro(null);
    setAviso(null);
    startTransition(async () => {
      const r = await agendarTrocaDePlano(planoId);
      if (!r.ok) {
        if (r.erro === "ARQUIVAR_ANTES") {
          setErro(r.mensagem ?? "Arquive obras antes de reduzir o plano.");
        } else {
          setErro(`Não foi possível trocar o plano (${r.erro}).`);
        }
        return;
      }
      setAviso(r.mensagem);
    });
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="font-serif text-3xl font-light">Planos</h1>
        <p className="text-sm text-cinza-2">
          Escolha quantas obras ativas você precisa. Sem cartão no trial.
        </p>
      </header>

      {status === "trial" && (
        <div className="rounded-[16px] border border-marca/30 bg-marca/10 px-4 py-3 text-sm">
          <strong className="font-medium">
            {TRIAL.dias} dias grátis · {TRIAL.limiteRelatorios} relatório
          </strong>
          {trialDiasRestantes != null ? (
            <span className="text-cinza-2">
              {" "}
              · {trialDiasRestantes} dia(s) restantes
            </span>
          ) : null}
        </div>
      )}

      {aviso && (
        <div className="rounded-[16px] border border-sucesso/30 bg-sucesso/10 px-4 py-3 text-sm text-sucesso">
          {aviso}
        </div>
      )}
      {erro && (
        <div className="rounded-[16px] border border-marca/40 bg-marca/10 px-4 py-3 text-sm">
          {erro}
        </div>
      )}

      <div className="grid gap-4 min-[800px]:grid-cols-3">
        {planos.map((plano) => {
          const ehRec = plano.id === recomendado;
          const ehSel = selecionado === plano.id;
          const ehAtual = assinate && planoAtual === plano.id;
          const Wrapper = ehRec ? CartaoEscuro : Cartao;

          return (
            <Wrapper
              key={plano.id}
              className={`relative flex cursor-pointer flex-col p-6 transition ${
                ehSel ? "ring-2 ring-marca" : ""
              }`}
              onClick={() => setSelecionado(plano.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelecionado(plano.id);
                }
              }}
            >
              <div className="mb-4 flex items-start justify-between gap-2">
                <div>
                  <p
                    className={`text-[10px] uppercase tracking-[0.18em] ${
                      ehRec ? "text-white/50" : "text-cinza-2"
                    }`}
                  >
                    Plano
                  </p>
                  <h2 className="mt-1 font-serif text-2xl font-light">
                    {plano.nome}
                  </h2>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {ehRec && <Selo tom="ambar">Recomendado</Selo>}
                  {ehSel && <Selo tom="ambar">✓ selecionado</Selo>}
                  {ehAtual && <Selo tom="verde">Atual</Selo>}
                </div>
              </div>

              <p className="font-serif text-3xl font-light">
                {formatarBRL(plano.precoCentavos)}
                <span
                  className={`text-sm ${ehRec ? "text-white/50" : "text-cinza-2"}`}
                >
                  /mês
                </span>
              </p>

              <ul
                className={`mt-5 flex-1 space-y-2 text-sm ${
                  ehRec ? "text-white/80" : "text-cinza-2"
                }`}
              >
                <li>
                  Até {plano.limiteObras} obra
                  {plano.limiteObras > 1 ? "s" : ""} ativa
                  {plano.limiteObras > 1 ? "s" : ""}
                </li>
                {BENEFICIOS.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>

              <div className="mt-6">
                {assinate ? (
                  ehAtual ? (
                    <Botao
                      className="w-full"
                      variante={ehRec ? "primario" : "secundario"}
                      disabled
                    >
                      Plano atual
                    </Botao>
                  ) : (
                    <Botao
                      className="w-full"
                      variante={ehRec ? "primario" : "terciario"}
                      disabled={pending}
                      onClick={(e) => {
                        e.stopPropagation();
                        onTrocar(plano.id);
                      }}
                    >
                      Trocar para {plano.nome}
                    </Botao>
                  )
                ) : (
                  <Botao
                    className="w-full"
                    variante={ehRec ? "primario" : "terciario"}
                    disabled={pending}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAssinar(plano.id);
                    }}
                  >
                    Assinar {plano.nome}
                  </Botao>
                )}
              </div>
            </Wrapper>
          );
        })}
      </div>

      <p className="text-sm text-cinza-2">
        E-mail extra (2º destinatário em diante):{" "}
        {formatarBRL(emailExtraCentavos || EMAIL_EXTRA.precoCentavos)} por
        ciclo, cobrado na próxima parcela.
      </p>
    </div>
  );
}
