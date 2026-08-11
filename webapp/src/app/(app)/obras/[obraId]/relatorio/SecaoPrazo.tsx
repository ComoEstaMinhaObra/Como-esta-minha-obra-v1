"use client";

import { Botao, CampoTexto } from "@/components/ui";
import { calcularNovaDataTermino } from "@/lib/relatorios/calculos";
import type { MotivoAditivo, RelatorioRascunho } from "@/lib/relatorios/tipos";

const MOTIVOS: { value: MotivoAditivo; label: string }[] = [
  { value: "chuvas", label: "Chuvas acima da média" },
  { value: "aditivo_escopo", label: "Aditivo de escopo" },
  { value: "atraso_materiais", label: "Atraso no fornecimento de materiais" },
  { value: "licencas", label: "Licenças e aprovações de órgãos públicos" },
  { value: "interferencias", label: "Interferências imprevistas" },
  { value: "forca_maior", label: "Caso fortuito ou força maior" },
  { value: "outro", label: "Outro" },
];

export function SecaoPrazo({
  dados,
  onChange,
  terminoContratual,
  diasAditivadosPersistidos,
}: {
  dados: RelatorioRascunho;
  onChange: (d: RelatorioRascunho) => void;
  terminoContratual: string;
  diasAditivadosPersistidos: number;
}) {
  const pendentes = dados.prazo.reduce((a, p) => a + p.dias, 0);
  const novaData = calcularNovaDataTermino(terminoContratual, [
    diasAditivadosPersistidos,
    ...dados.prazo.map((p) => p.dias),
  ]);
  const [y, m, d] = novaData.split("-");

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between">
        <p className="tracking-[0.18em] text-[10px] uppercase text-cinza-2">
          4 · Prazo
        </p>
        <p className="text-sm text-cinza-2">
          novo término previsto: {d}/{m}/{y}
        </p>
      </div>

      <ul className="space-y-2">
        {dados.prazo.map((linha, i) => (
          <li
            key={i}
            className="space-y-2 rounded-[16px] border border-borda p-3"
          >
            <select
              className="w-full rounded-full border border-borda px-3 py-2 text-sm"
              value={linha.motivo}
              onChange={(e) =>
                onChange({
                  ...dados,
                  prazo: dados.prazo.map((p, j) =>
                    j === i
                      ? { ...p, motivo: e.target.value as MotivoAditivo }
                      : p,
                  ),
                })
              }
            >
              {MOTIVOS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              className="w-full rounded-full border border-borda px-3 py-2 text-sm"
              value={linha.dias}
              onChange={(e) =>
                onChange({
                  ...dados,
                  prazo: dados.prazo.map((p, j) =>
                    j === i
                      ? { ...p, dias: Math.max(1, Number(e.target.value) || 1) }
                      : p,
                  ),
                })
              }
              aria-label="Dias"
            />
            {linha.motivo === "outro" ? (
              <CampoTexto
                rotulo="Descrição"
                value={linha.descricao ?? ""}
                onChange={(e) =>
                  onChange({
                    ...dados,
                    prazo: dados.prazo.map((p, j) =>
                      j === i ? { ...p, descricao: e.target.value } : p,
                    ),
                  })
                }
              />
            ) : null}
            <button
              type="button"
              className="text-xs text-cinza-2"
              onClick={() =>
                onChange({
                  ...dados,
                  prazo: dados.prazo.filter((_, j) => j !== i),
                })
              }
            >
              Remover
            </button>
          </li>
        ))}
      </ul>

      <Botao
        variante="secundario"
        onClick={() =>
          onChange({
            ...dados,
            prazo: [
              ...dados.prazo,
              { motivo: "chuvas", dias: 1 },
            ],
          })
        }
      >
        + dias aditivados
      </Botao>
      <p className="text-xs text-cinza-3">
        Persistidos: {diasAditivadosPersistidos} · neste rascunho: {pendentes}
      </p>
    </section>
  );
}
