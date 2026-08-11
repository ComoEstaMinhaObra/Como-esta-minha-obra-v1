"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Botao, Cartao, ModalBase, Selo, useToast } from "@/components/ui";
import { ModalUpsellLimite } from "@/components/ui/ModalUpsellLimite";
import { formatarBRLCompacto } from "@/lib/formatacao";
import { enviarRelatorioAction } from "./enviar-relatorio-action";

type RelatorioCard = {
  id: string;
  numero: number;
  status: "rascunho" | "enviado";
  geral_antes: number | null;
  geral_depois: number | null;
  enviado_em: string | null;
  criado_em: string;
  pdf_path?: string | null;
  snapshot?: {
    financeiro?: { pagoAcumuladoCentavos?: number };
    avancoFisico?: {
      geralAntes?: number;
      geralDepois?: number;
      etapas?: { nome: string; pctAnterior: number; pctNovo: number }[];
    };
  } | null;
};

export function FeedRelatorios({
  obraId,
  relatorios,
}: {
  obraId: string;
  relatorios: RelatorioCard[];
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmarId, setConfirmarId] = useState<string | null>(null);
  const [upsell, setUpsell] = useState(false);

  if (relatorios.length === 0) {
    return (
      <Cartao className="p-5 text-sm text-cinza-2">
        Publique o primeiro relatório para ativar a página do cliente.
      </Cartao>
    );
  }

  function enviar(id: string) {
    startTransition(async () => {
      const r = await enviarRelatorioAction(id);
      setConfirmarId(null);
      if (!r.ok) {
        if (
          r.erro === "TRIAL_LIMITE" ||
          r.erro === "TRIAL_EXPIRADO" ||
          r.erro === "ASSINATURA_INATIVA"
        ) {
          setUpsell(true);
          return;
        }
        toast(r.erro === "ERRO_GENERICO" ? "Não foi possível enviar" : r.erro);
        return;
      }
      toast(`Relatório nº ${r.numero} enviado · cliente notificado por e-mail`);
      router.refresh();
    });
  }

  return (
    <>
      <div className="space-y-3">
        {relatorios.map((r) => {
          const antes =
            r.geral_antes ?? r.snapshot?.avancoFisico?.geralAntes ?? 0;
          const depois =
            r.geral_depois ?? r.snapshot?.avancoFisico?.geralDepois ?? 0;
          const delta = depois - antes;
          const etapasTrab =
            r.snapshot?.avancoFisico?.etapas?.filter(
              (e) => e.pctNovo !== e.pctAnterior,
            ) ?? [];
          const pago =
            r.snapshot?.financeiro?.pagoAcumuladoCentavos ?? null;

          return (
            <Cartao key={r.id} className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-serif text-lg font-light">
                  Relatório nº {r.numero}
                </h3>
                {r.status === "rascunho" ? (
                  <Selo tom="ambar">Rascunho</Selo>
                ) : (
                  <Selo tom="verde">Enviado</Selo>
                )}
              </div>

              {r.status === "enviado" ? (
                <>
                  <p className="text-sm text-cinza-2">
                    avanço {antes}% → {depois}%{" "}
                    {delta >= 0 ? `+${delta}%` : `${delta}%`}
                  </p>
                  {pago != null ? (
                    <p className="text-sm text-cinza-2">
                      financeiro {formatarBRLCompacto(pago)}
                    </p>
                  ) : null}
                  {etapasTrab.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {etapasTrab.slice(0, 6).map((e) => (
                        <Selo key={e.nome} tom="ambar">
                          {e.nome}
                        </Selo>
                      ))}
                    </div>
                  ) : null}
                  <p className="text-xs text-cinza-3">
                    ✓ enviado por e-mail ao cliente
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/c/${obraId}`}
                      className="text-xs underline text-cinza-2"
                    >
                      Ver relatório do cliente
                    </Link>
                    <a
                        href={`/api/relatorios/${r.id}/pdf`}
                        className="text-xs underline text-cinza-2"
                      >
                        Baixar PDF
                      </a>
                  </div>
                </>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Botao
                    variante="secundario"
                    className="text-xs py-2"
                    onClick={() =>
                      toast("Preview do cliente completa em S2.7+")
                    }
                  >
                    Visualizar como cliente
                  </Botao>
                  <Link href={`/obras/${obraId}?editarRelatorio=${r.id}`}>
                    <Botao variante="secundario" className="text-xs py-2">
                      Editar
                    </Botao>
                  </Link>
                  <Botao
                    variante="primario"
                    className="text-xs py-2"
                    disabled={pending}
                    onClick={() => setConfirmarId(r.id)}
                  >
                    Enviar ao cliente
                  </Botao>
                </div>
              )}
            </Cartao>
          );
        })}
      </div>

      <ModalBase
        aberto={confirmarId != null}
        onFechar={() => setConfirmarId(null)}
        titulo="Enviar relatório?"
      >
        <p className="mb-4 text-sm text-cinza-2">
          O cliente receberá o relatório por e-mail. Esta ação não pode ser
          desfeita.
        </p>
        <div className="flex gap-2">
          <Botao variante="secundario" onClick={() => setConfirmarId(null)}>
            Cancelar
          </Botao>
          <Botao
            disabled={pending || !confirmarId}
            onClick={() => confirmarId && enviar(confirmarId)}
          >
            {pending ? "Enviando…" : "Confirmar envio"}
          </Botao>
        </div>
      </ModalBase>

      <ModalUpsellLimite
        aberto={upsell}
        onFechar={() => setUpsell(false)}
        titulo="Assinatura necessária"
        mensagem="Seu trial não permite mais envios. Assine um plano para continuar publicando relatórios."
      />
    </>
  );
}
