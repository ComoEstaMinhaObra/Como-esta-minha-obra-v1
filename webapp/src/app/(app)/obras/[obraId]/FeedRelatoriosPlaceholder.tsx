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
  relatorios,
}: {
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
            <p className="text-sm text-cinza-2">
              avanço {antes}% → {depois}% {delta >= 0 ? `+${delta}%` : `${delta}%`}
            </p>
            <p className="text-xs text-cinza-3">
              {r.status === "enviado"
                ? "✓ enviado por e-mail ao cliente"
                : "Salvo — ainda não enviado (ações em S2.7)"}
            </p>
          </Cartao>
        );
      })}
    </div>
  );
}
