import { avaliarSenha, type NivelSenha } from "@/lib/auth/forca-senha";

const ROTULOS: Record<Exclude<NivelSenha, "vazia">, string> = {
  fraca: "fraca",
  media: "média",
  forte: "forte",
};

const SEGMENTOS_ATIVOS: Record<Exclude<NivelSenha, "vazia">, number> = {
  fraca: 1,
  media: 2,
  forte: 3,
};

const COR: Record<Exclude<NivelSenha, "vazia">, string> = {
  fraca: "bg-marca",
  media: "bg-marca-clara",
  forte: "bg-sucesso",
};

export function IndicadorForcaSenha({ senha }: { senha: string }) {
  const { nivel, faltando } = avaliarSenha(senha);

  return (
    <div className="space-y-1.5" aria-live="polite">
      {nivel === "vazia" ? null : (
        <>
          <div className="flex gap-1.5" aria-hidden="true">
            {[1, 2, 3].map((posicao) => (
              <span
                key={posicao}
                className={`h-1 flex-1 rounded-full ${
                  posicao <= SEGMENTOS_ATIVOS[nivel]
                    ? COR[nivel]
                    : "bg-borda"
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-cinza-2">
            Força da senha: <strong className="text-tinta">{ROTULOS[nivel]}</strong>
            {faltando.length > 0 ? ` — falta: ${faltando.join(", ")}` : null}
          </p>
        </>
      )}
    </div>
  );
}
