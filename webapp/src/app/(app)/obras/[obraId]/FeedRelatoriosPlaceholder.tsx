import Link from "next/link";
import { Cartao, Selo } from "@/components/ui";

type RelatorioResumo = {
  id: string;
  numero: number;
  status: "rascunho" | "enviado";
  geral_antes: number | null;
  geral_depois: number | null;
  enviado_em: string | null;
  criado_em: string;
};

export function FeedRelatoriosPlaceholder({
  obraId,
  relatorios,
}: {
  obraId: string;
  relatorios: RelatorioResumo[];
}) {
  if (relatorios.length === 0) {
    return (
      <Cartao className="p-5 text-sm text-cinza-2">
        Publique o primeiro relatório para ativar a página do cliente.
      </Cartao>
    );
  }

  return (
    <div className="space-y-3">
      {relatorios.map((r) => {
        const antes = r.geral_antes ?? 0;
        const depois = r.geral_depois ?? 0;
        const delta = depois - antes;
        return (
          <Cartao key={r.id} className="space-y-2 p-4">
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
              <p className="text-sm text-cinza-2">
                avanço {antes}% → {depois}%{" "}
                {delta >= 0 ? `+${delta}%` : `${delta}%`}
              </p>
            ) : null}
            {r.status === "rascunho" ? (
              <div className="flex flex-wrap gap-2 pt-1">
                <Link
                  href={`/obras/${obraId}?editarRelatorio=${r.id}`}
                  className="text-xs underline text-cinza-2"
                >
                  Editar
                </Link>
                <span className="text-xs text-cinza-3">
                  Enviar / preview em S2.7–S2.8
                </span>
              </div>
            ) : (
              <p className="text-xs text-cinza-3">
                ✓ enviado por e-mail ao cliente
              </p>
            )}
          </Cartao>
        );
      })}
    </div>
  );
}
