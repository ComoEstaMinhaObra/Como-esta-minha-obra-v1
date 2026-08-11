"use client";

import { Botao, CampoMoeda, CampoTexto } from "@/components/ui";
import { formatarBRL } from "@/lib/formatacao";
import {
  calcularFinanceiro,
  proximoRotuloAditivo,
  proximoRotuloMedicao,
} from "@/lib/relatorios/calculos";
import type { RelatorioRascunho } from "@/lib/relatorios/tipos";

export function SecaoFinanceiro({
  dados,
  onChange,
  maxMedicao,
  maxAditivo,
  valorContratadoCentavos,
  pagoPersistidoCentavos,
  aditivosPersistidosCentavos,
}: {
  dados: RelatorioRascunho;
  onChange: (d: RelatorioRascunho) => void;
  maxMedicao: number;
  maxAditivo: number;
  valorContratadoCentavos: number;
  pagoPersistidoCentavos: number;
  aditivosPersistidosCentavos: number;
}) {
  const fin = dados.financeiro;

  const live = calcularFinanceiro({
    valorContratadoCentavos,
    aditivosCentavos: [
      aditivosPersistidosCentavos,
      ...fin.aditivos.map((a) => a.valorCentavos),
    ],
    pagoCentavos: [
      pagoPersistidoCentavos,
      ...fin.medicoes.map((m) => m.valorCentavos),
      ...fin.materiais.map((m) => m.valorCentavos),
      ...fin.estornos
        .filter((e) => e.grupo !== "aditivos")
        .map((e) => -Math.abs(e.valorCentavos)),
    ],
    estornosAditivosCentavos: fin.estornos
      .filter((e) => e.grupo === "aditivos")
      .map((e) => -Math.abs(e.valorCentavos)),
  });

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between">
        <p className="tracking-[0.18em] text-[10px] uppercase text-cinza-2">
          2 · Financeiro
        </p>
        <p className="text-sm text-cinza-2">
          pago: {formatarBRL(live.pagoAcumuladoCentavos)} · {live.pctPago}% do
          contrato
        </p>
      </div>

      <Grupo
        titulo="Pago em medições"
        total={fin.medicoes.reduce((a, m) => a + m.valorCentavos, 0)}
      >
        {fin.medicoes.map((m, i) => (
          <Linha key={i} rotulo={proximoRotuloMedicao(maxMedicao, i)} valor={m.valorCentavos} onRemover={() =>
            onChange({
              ...dados,
              financeiro: {
                ...fin,
                medicoes: fin.medicoes.filter((_, j) => j !== i),
              },
            })
          } />
        ))}
        <Botao
          variante="secundario"
          className="text-xs"
          onClick={() =>
            onChange({
              ...dados,
              financeiro: {
                ...fin,
                medicoes: [...fin.medicoes, { valorCentavos: 0 }],
              },
            })
          }
        >
          + {proximoRotuloMedicao(maxMedicao, fin.medicoes.length)}
        </Botao>
        {fin.medicoes.length > 0 ? (
          <CampoMoeda
            rotulo="Valor da última medição"
            valorCentavos={fin.medicoes[fin.medicoes.length - 1].valorCentavos}
            onChangeCentavos={(v) =>
              onChange({
                ...dados,
                financeiro: {
                  ...fin,
                  medicoes: fin.medicoes.map((m, i) =>
                    i === fin.medicoes.length - 1 ? { valorCentavos: v } : m,
                  ),
                },
              })
            }
          />
        ) : null}
      </Grupo>

      <Grupo
        titulo="Pago em materiais"
        total={fin.materiais.reduce((a, m) => a + m.valorCentavos, 0)}
      >
        {fin.materiais.map((m, i) => (
          <div key={i} className="grid gap-2 min-[800px]:grid-cols-[1fr_140px_auto]">
            <CampoTexto
              rotulo="Rótulo"
              value={m.rotulo}
              onChange={(e) =>
                onChange({
                  ...dados,
                  financeiro: {
                    ...fin,
                    materiais: fin.materiais.map((x, j) =>
                      j === i ? { ...x, rotulo: e.target.value } : x,
                    ),
                  },
                })
              }
            />
            <CampoMoeda
              rotulo="Valor"
              valorCentavos={m.valorCentavos}
              onChangeCentavos={(v) =>
                onChange({
                  ...dados,
                  financeiro: {
                    ...fin,
                    materiais: fin.materiais.map((x, j) =>
                      j === i ? { ...x, valorCentavos: v } : x,
                    ),
                  },
                })
              }
            />
            <button type="button" className="text-cinza-2 self-end pb-2" onClick={() =>
              onChange({
                ...dados,
                financeiro: {
                  ...fin,
                  materiais: fin.materiais.filter((_, j) => j !== i),
                },
              })
            }>×</button>
          </div>
        ))}
        <Botao
          variante="secundario"
          className="text-xs"
          onClick={() =>
            onChange({
              ...dados,
              financeiro: {
                ...fin,
                materiais: [...fin.materiais, { rotulo: "", valorCentavos: 0 }],
              },
            })
          }
        >
          + material
        </Botao>
      </Grupo>

      <Grupo
        titulo="Aditivos"
        total={fin.aditivos.reduce((a, m) => a + m.valorCentavos, 0)}
      >
        {fin.aditivos.map((a, i) => (
          <div key={i} className="space-y-2 rounded-[16px] border border-borda p-3">
            <p className="text-xs text-marca">
              {proximoRotuloAditivo(maxAditivo, i)}
            </p>
            <CampoTexto
              rotulo="Do que se refere?"
              value={a.descricao}
              onChange={(e) =>
                onChange({
                  ...dados,
                  financeiro: {
                    ...fin,
                    aditivos: fin.aditivos.map((x, j) =>
                      j === i ? { ...x, descricao: e.target.value } : x,
                    ),
                  },
                })
              }
            />
            <CampoMoeda
              rotulo="Valor"
              valorCentavos={a.valorCentavos}
              onChangeCentavos={(v) =>
                onChange({
                  ...dados,
                  financeiro: {
                    ...fin,
                    aditivos: fin.aditivos.map((x, j) =>
                      j === i ? { ...x, valorCentavos: v } : x,
                    ),
                  },
                })
              }
            />
            <button
              type="button"
              className="text-xs text-cinza-2"
              onClick={() =>
                onChange({
                  ...dados,
                  financeiro: {
                    ...fin,
                    aditivos: fin.aditivos.filter((_, j) => j !== i),
                  },
                })
              }
            >
              Remover
            </button>
          </div>
        ))}
        <Botao
          variante="secundario"
          className="text-xs"
          onClick={() =>
            onChange({
              ...dados,
              financeiro: {
                ...fin,
                aditivos: [...fin.aditivos, { descricao: "", valorCentavos: 0 }],
              },
            })
          }
        >
          + {proximoRotuloAditivo(maxAditivo, fin.aditivos.length)}
        </Botao>
      </Grupo>

      <details className="text-sm">
        <summary className="cursor-pointer text-cinza-2">estorno/ajuste</summary>
        <div className="mt-3 space-y-2">
          {fin.estornos.map((e, i) => (
            <p key={i} className="text-sm text-cinza-2">
              Estorno — {e.descricao}: -{formatarBRL(e.valorCentavos)} ({e.grupo})
            </p>
          ))}
          <Botao
            variante="secundario"
            className="text-xs"
            onClick={() =>
              onChange({
                ...dados,
                financeiro: {
                  ...fin,
                  estornos: [
                    ...fin.estornos,
                    {
                      grupo: "materiais",
                      descricao: "ajuste",
                      valorCentavos: 0,
                    },
                  ],
                },
              })
            }
          >
            + estorno
          </Botao>
          {fin.estornos.length > 0 ? (
            <>
              <CampoTexto
                rotulo="Descrição do estorno"
                value={fin.estornos[fin.estornos.length - 1].descricao}
                onChange={(ev) =>
                  onChange({
                    ...dados,
                    financeiro: {
                      ...fin,
                      estornos: fin.estornos.map((x, j) =>
                        j === fin.estornos.length - 1
                          ? { ...x, descricao: ev.target.value }
                          : x,
                      ),
                    },
                  })
                }
              />
              <CampoMoeda
                rotulo="Valor (positivo; será subtraído)"
                valorCentavos={fin.estornos[fin.estornos.length - 1].valorCentavos}
                onChangeCentavos={(v) =>
                  onChange({
                    ...dados,
                    financeiro: {
                      ...fin,
                      estornos: fin.estornos.map((x, j) =>
                        j === fin.estornos.length - 1
                          ? { ...x, valorCentavos: v }
                          : x,
                      ),
                    },
                  })
                }
              />
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-cinza-2">Grupo</span>
                <select
                  className="rounded-full border border-borda px-3 py-2"
                  value={fin.estornos[fin.estornos.length - 1].grupo}
                  onChange={(ev) =>
                    onChange({
                      ...dados,
                      financeiro: {
                        ...fin,
                        estornos: fin.estornos.map((x, j) =>
                          j === fin.estornos.length - 1
                            ? {
                                ...x,
                                grupo: ev.target.value as
                                  | "medicoes"
                                  | "materiais"
                                  | "aditivos",
                              }
                            : x,
                        ),
                      },
                    })
                  }
                >
                  <option value="medicoes">medições</option>
                  <option value="materiais">materiais</option>
                  <option value="aditivos">aditivos</option>
                </select>
              </label>
            </>
          ) : null}
        </div>
      </details>
    </section>
  );
}

function Grupo({
  titulo,
  total,
  children,
}: {
  titulo: string;
  total: number;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3 rounded-[20px] border border-borda bg-cartao p-4">
      <div className="flex justify-between text-sm">
        <span>{titulo}</span>
        <span className="text-cinza-2">{formatarBRL(total)}</span>
      </div>
      {children}
    </div>
  );
}

function Linha({
  rotulo,
  valor,
  onRemover,
}: {
  rotulo: string;
  valor: number;
  onRemover: () => void;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="rounded-full bg-marca/10 px-2 py-0.5 text-marca text-xs">
        {rotulo}
      </span>
      <span>{formatarBRL(valor)}</span>
      <button type="button" className="text-cinza-2" onClick={onRemover}>
        ×
      </button>
    </div>
  );
}
