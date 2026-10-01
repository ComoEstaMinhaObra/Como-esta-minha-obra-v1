"use client";

import { Botao, CampoMoeda, CampoTexto } from "@/components/ui";
import { formatarBRL } from "@/lib/formatacao";
import {
  MENSAGENS_PROBLEMA_FINANCEIRO,
  calcularFinanceiroProjetado,
  problemasFinanceiros,
  proximoRotuloAditivo,
  proximoRotuloMedicao,
  proximoRotuloSupressao,
  type SaldoEstornavel,
} from "@/lib/relatorios/calculos";
import type {
  LancamentoPersistido,
  RelatorioRascunho,
} from "@/lib/relatorios/tipos";

type Financeiro = RelatorioRascunho["financeiro"];

function maxNumero(lancamentos: LancamentoPersistido[], tipo: string) {
  return Math.max(
    0,
    ...lancamentos.filter((l) => l.tipo === tipo).map((l) => l.numero ?? 0),
  );
}

export function SecaoFinanceiro({
  dados,
  onChange,
  valorContratadoCentavos,
  lancamentos,
  saldoEstornavel,
}: {
  dados: RelatorioRascunho;
  onChange: (d: RelatorioRascunho) => void;
  valorContratadoCentavos: number;
  lancamentos: LancamentoPersistido[];
  saldoEstornavel: SaldoEstornavel[];
}) {
  const fin = dados.financeiro;
  const setFin = (parcial: Partial<Financeiro>) =>
    onChange({ ...dados, financeiro: { ...fin, ...parcial } });

  const maxMedicao = maxNumero(lancamentos, "medicao");
  const maxAditivo = maxNumero(lancamentos, "aditivo");
  const maxSupressao = maxNumero(lancamentos, "supressao");

  const live = calcularFinanceiroProjetado({
    valorContratadoCentavos,
    lancamentos,
    financeiro: fin,
  });
  const problemas = problemasFinanceiros({
    valorContratadoCentavos,
    lancamentos,
    financeiro: fin,
  });

  const doTipo = (...tipos: string[]) =>
    lancamentos
      .filter((l) => tipos.includes(l.tipo))
      .sort((a, b) => (a.numero ?? 0) - (b.numero ?? 0));
  const soma = (itens: { valorCentavos: number }[]) =>
    itens.reduce((a, m) => a + m.valorCentavos, 0);

  // Saldo estornável descontando os estornos já lançados neste rascunho.
  const saldoLivre = (origemId: string, ignorarIndice?: number) => {
    const base =
      saldoEstornavel.find((s) => s.id === origemId)?.saldoCentavos ?? 0;
    const usadoNoRascunho = fin.estornos
      .filter((e, i) => e.origemId === origemId && i !== ignorarIndice)
      .reduce((total, e) => total + Math.abs(e.valorCentavos), 0);
    return Math.max(0, base - usadoNoRascunho);
  };
  const origensDisponiveis = saldoEstornavel.filter(
    (s) => saldoLivre(s.id) > 0,
  );

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between">
        <p className="tracking-[0.18em] text-[10px] uppercase text-cinza-2">
          2 · Financeiro
        </p>
        <p className="text-sm text-cinza-2">
          pago: {formatarBRL(live.pagoAcumuladoCentavos)} de{" "}
          {formatarBRL(live.contratadoTotalCentavos)} · {live.pctPago}% do
          contrato
        </p>
      </div>

      {problemas.length > 0 ? (
        <ul
          role="alert"
          className="space-y-1 rounded-[16px] border border-marca/40 bg-marca/5 p-3 text-sm text-marca"
        >
          {problemas.map((p) => (
            <li key={p}>{MENSAGENS_PROBLEMA_FINANCEIRO[p]}</li>
          ))}
        </ul>
      ) : null}

      <Grupo
        titulo="Pago em medições"
        total={soma(doTipo("sinal", "medicao")) + soma(fin.medicoes)}
      >
        {doTipo("sinal", "medicao").map((l) => (
          <Linha key={l.id} rotulo={l.rotulo} valor={l.valorCentavos} />
        ))}
        {fin.medicoes.map((m, i) => (
          <div
            key={i}
            className="grid items-end gap-2 min-[800px]:grid-cols-[auto_140px_auto]"
          >
            <span className="self-center rounded-full bg-marca/10 px-2 py-0.5 text-xs text-marca">
              {proximoRotuloMedicao(maxMedicao, i)}
            </span>
            <CampoMoeda
              rotulo="Valor"
              valorCentavos={m.valorCentavos}
              onChangeCentavos={(v) =>
                setFin({
                  medicoes: fin.medicoes.map((x, j) =>
                    j === i ? { valorCentavos: v } : x,
                  ),
                })
              }
            />
            <button
              type="button"
              className="pb-2 text-cinza-2"
              aria-label="Remover medição"
              onClick={() =>
                setFin({ medicoes: fin.medicoes.filter((_, j) => j !== i) })
              }
            >
              ×
            </button>
          </div>
        ))}
        <Botao
          variante="secundario"
          className="text-xs"
          onClick={() =>
            setFin({ medicoes: [...fin.medicoes, { valorCentavos: 0 }] })
          }
        >
          + {proximoRotuloMedicao(maxMedicao, fin.medicoes.length)}
        </Botao>
      </Grupo>

      <Grupo
        titulo="Pago em materiais"
        total={soma(doTipo("material")) + soma(fin.materiais)}
      >
        {doTipo("material").map((l) => (
          <Linha key={l.id} rotulo={l.rotulo} valor={l.valorCentavos} />
        ))}
        {fin.materiais.map((m, i) => (
          <div
            key={i}
            className="grid gap-2 min-[800px]:grid-cols-[1fr_140px_auto]"
          >
            <CampoTexto
              rotulo="Rótulo"
              value={m.rotulo}
              onChange={(e) =>
                setFin({
                  materiais: fin.materiais.map((x, j) =>
                    j === i ? { ...x, rotulo: e.target.value } : x,
                  ),
                })
              }
            />
            <CampoMoeda
              rotulo="Valor"
              valorCentavos={m.valorCentavos}
              onChangeCentavos={(v) =>
                setFin({
                  materiais: fin.materiais.map((x, j) =>
                    j === i ? { ...x, valorCentavos: v } : x,
                  ),
                })
              }
            />
            <button
              type="button"
              className="self-end pb-2 text-cinza-2"
              aria-label="Remover material"
              onClick={() =>
                setFin({ materiais: fin.materiais.filter((_, j) => j !== i) })
              }
            >
              ×
            </button>
          </div>
        ))}
        <Botao
          variante="secundario"
          className="text-xs"
          onClick={() =>
            setFin({
              materiais: [...fin.materiais, { rotulo: "", valorCentavos: 0 }],
            })
          }
        >
          + material
        </Botao>
      </Grupo>

      <Grupo
        titulo="Aditivos"
        total={soma(doTipo("aditivo")) + soma(fin.aditivos)}
      >
        {doTipo("aditivo").map((l) => (
          <Linha key={l.id} rotulo={l.rotulo} valor={l.valorCentavos} />
        ))}
        {fin.aditivos.map((a, i) => (
          <div
            key={i}
            className="space-y-2 rounded-[16px] border border-borda p-3"
          >
            <p className="text-xs text-marca">
              {proximoRotuloAditivo(maxAditivo, i)}
            </p>
            <CampoTexto
              rotulo="Do que se refere?"
              value={a.descricao}
              onChange={(e) =>
                setFin({
                  aditivos: fin.aditivos.map((x, j) =>
                    j === i ? { ...x, descricao: e.target.value } : x,
                  ),
                })
              }
            />
            <CampoMoeda
              rotulo="Valor"
              valorCentavos={a.valorCentavos}
              onChangeCentavos={(v) =>
                setFin({
                  aditivos: fin.aditivos.map((x, j) =>
                    j === i ? { ...x, valorCentavos: v } : x,
                  ),
                })
              }
            />
            <button
              type="button"
              className="text-xs text-cinza-2"
              onClick={() =>
                setFin({ aditivos: fin.aditivos.filter((_, j) => j !== i) })
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
            setFin({
              aditivos: [...fin.aditivos, { descricao: "", valorCentavos: 0 }],
            })
          }
        >
          + {proximoRotuloAditivo(maxAditivo, fin.aditivos.length)}
        </Botao>
      </Grupo>

      <Grupo
        titulo="Supressões"
        total={soma(doTipo("supressao")) + soma(fin.supressoes)}
      >
        <p className="text-xs text-cinza-3">
          Reduzem o escopo e o valor contratado vigente, que precisa continuar
          maior que zero e não inferior ao total já pago.
        </p>
        {doTipo("supressao").map((l) => (
          <Linha key={l.id} rotulo={l.rotulo} valor={l.valorCentavos} />
        ))}
        {fin.supressoes.map((x, i) => (
          <div
            key={i}
            className="space-y-2 rounded-[16px] border border-borda p-3"
          >
            <p className="text-xs text-marca">
              {proximoRotuloSupressao(maxSupressao, i)}
            </p>
            <CampoTexto
              rotulo="Do que se refere?"
              value={x.descricao}
              onChange={(e) =>
                setFin({
                  supressoes: fin.supressoes.map((y, j) =>
                    j === i ? { ...y, descricao: e.target.value } : y,
                  ),
                })
              }
            />
            <CampoMoeda
              rotulo="Valor"
              valorCentavos={x.valorCentavos}
              onChangeCentavos={(v) =>
                setFin({
                  supressoes: fin.supressoes.map((y, j) =>
                    j === i ? { ...y, valorCentavos: v } : y,
                  ),
                })
              }
            />
            <button
              type="button"
              className="text-xs text-cinza-2"
              onClick={() =>
                setFin({
                  supressoes: fin.supressoes.filter((_, j) => j !== i),
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
            setFin({
              supressoes: [
                ...fin.supressoes,
                { descricao: "", valorCentavos: 0 },
              ],
            })
          }
        >
          + {proximoRotuloSupressao(maxSupressao, fin.supressoes.length)}
        </Botao>
      </Grupo>

      <Grupo titulo="Estornos e devoluções" total={soma(doTipo("estorno")) - soma(fin.estornos)}>
        {doTipo("estorno").map((l) => (
          <Linha key={l.id} rotulo={l.rotulo} valor={l.valorCentavos} />
        ))}
        {fin.estornos.map((e, i) => {
          const maximo = saldoLivre(e.origemId, i);
          return (
            <div
              key={i}
              className="space-y-2 rounded-[16px] border border-borda p-3"
            >
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-cinza-2">Lançamento estornado</span>
                <select
                  className="rounded-full border border-borda px-3 py-2"
                  value={e.origemId}
                  onChange={(ev) =>
                    setFin({
                      estornos: fin.estornos.map((x, j) =>
                        j === i ? { ...x, origemId: ev.target.value } : x,
                      ),
                    })
                  }
                >
                  <option value="">Escolha…</option>
                  {saldoEstornavel
                    .filter((s) => saldoLivre(s.id, i) > 0 || s.id === e.origemId)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.rotulo} — saldo {formatarBRL(saldoLivre(s.id, i))}
                      </option>
                    ))}
                </select>
              </label>
              <CampoTexto
                rotulo="Descrição do estorno"
                value={e.descricao}
                onChange={(ev) =>
                  setFin({
                    estornos: fin.estornos.map((x, j) =>
                      j === i ? { ...x, descricao: ev.target.value } : x,
                    ),
                  })
                }
              />
              <CampoMoeda
                rotulo={
                  e.origemId
                    ? `Valor (máximo ${formatarBRL(maximo)})`
                    : "Valor"
                }
                valorCentavos={e.valorCentavos}
                onChangeCentavos={(v) =>
                  setFin({
                    estornos: fin.estornos.map((x, j) =>
                      j === i
                        ? {
                            ...x,
                            valorCentavos: e.origemId ? Math.min(v, maximo) : v,
                          }
                        : x,
                    ),
                  })
                }
              />
              <button
                type="button"
                className="text-xs text-cinza-2"
                onClick={() =>
                  setFin({ estornos: fin.estornos.filter((_, j) => j !== i) })
                }
              >
                Remover
              </button>
            </div>
          );
        })}
        <Botao
          variante="secundario"
          className="text-xs"
          disabled={origensDisponiveis.length === 0}
          onClick={() =>
            setFin({
              estornos: [
                ...fin.estornos,
                {
                  origemId: origensDisponiveis[0]?.id ?? "",
                  descricao: "",
                  valorCentavos: 0,
                },
              ],
            })
          }
        >
          + estorno
        </Botao>
        {origensDisponiveis.length === 0 ? (
          <p className="text-xs text-cinza-3">
            Não há lançamento com saldo para estornar.
          </p>
        ) : null}
      </Grupo>
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

function Linha({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="rounded-full bg-marca/10 px-2 py-0.5 text-xs text-marca">
        {rotulo}
      </span>
      <span>{formatarBRL(valor)}</span>
    </div>
  );
}
