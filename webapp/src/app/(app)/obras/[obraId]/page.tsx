import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import {
  AnelProgresso,
  BarraProgresso,
  Botao,
  Cartao,
  CartaoEscuro,
  RotuloSecao,
  Selo,
} from "@/components/ui";
import { formatarBRLCompacto } from "@/lib/formatacao";
import {
  calcularAvancoGeral,
  calcularFinanceiro,
  calcularNovaDataTermino,
} from "@/lib/relatorios/calculos";
import type { RelatorioRascunho, RelatorioSnapshot } from "@/lib/relatorios/tipos";
import { createClient } from "@/lib/supabase/server";
import { DetalheAcoes } from "./DetalheAcoes";
import { FeedRelatorios } from "./FeedRelatorios";
import { ModalArquivarObra } from "./ModalArquivarObra";

function formatarDataBr(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

export default async function DetalheObraPage({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: obra } = await supabase
    .from("obras")
    .select(
      "id, nome, endereco, cliente_nome, termino_contratual, valor_contratado_centavos, arquivada_em, owner_id",
    )
    .eq("id", obraId)
    .maybeSingle();

  if (!obra || obra.owner_id !== user.id) notFound();

  const [
    { data: etapas },
    { data: lancamentos },
    { data: diasAditivos },
    { data: relatorios },
    { data: clima },
  ] = await Promise.all([
    supabase
      .from("etapas")
      .select("id, nome, ordem, peso, pct_atual")
      .eq("obra_id", obraId)
      .order("ordem"),
    supabase
      .from("lancamentos")
      .select("tipo, grupo, valor_centavos, numero")
      .eq("obra_id", obraId),
    supabase.from("dias_aditivados").select("dias").eq("obra_id", obraId),
    supabase
      .from("relatorios")
      .select(
        "id, numero, status, geral_antes, geral_depois, enviado_em, criado_em, dados_rascunho, pdf_path, snapshot",
      )
      .eq("obra_id", obraId)
      .order("numero", { ascending: false }),
    supabase
      .from("clima_snapshots")
      .select("data, condicao, prob_chuva")
      .eq("obra_id", obraId)
      .order("data", { ascending: true }),
  ]);

  const listaEtapas = etapas ?? [];
  const avanco = calcularAvancoGeral(
    listaEtapas.map((e) => ({ peso: Number(e.peso), pct: e.pct_atual })),
  );
  const etapasConcluidas = listaEtapas.filter((e) => e.pct_atual === 100).length;

  const aditivos = (lancamentos ?? [])
    .filter((l) => l.tipo === "aditivo")
    .map((l) => l.valor_centavos);
  const estornosAditivos = (lancamentos ?? [])
    .filter((l) => l.tipo === "estorno" && l.grupo === "aditivos")
    .map((l) => l.valor_centavos);
  const pago = (lancamentos ?? [])
    .filter((l) =>
      ["sinal", "medicao", "material", "estorno"].includes(l.tipo),
    )
    .filter((l) => !(l.tipo === "estorno" && l.grupo === "aditivos"))
    .map((l) => l.valor_centavos);

  const fin = calcularFinanceiro({
    valorContratadoCentavos: obra.valor_contratado_centavos,
    aditivosCentavos: aditivos,
    pagoCentavos: pago,
    estornosAditivosCentavos: estornosAditivos,
  });

  const dias = (diasAditivos ?? []).map((d) => d.dias);
  const entregaPrevista = calcularNovaDataTermino(obra.termino_contratual, dias);

  const maxMedicao = Math.max(
    0,
    ...(lancamentos ?? [])
      .filter((l) => l.tipo === "medicao")
      .map((l) => l.numero ?? 0),
  );
  const maxAditivo = Math.max(
    0,
    ...(lancamentos ?? [])
      .filter((l) => l.tipo === "aditivo")
      .map((l) => l.numero ?? 0),
  );
  const proximoNumero =
    Math.max(0, ...(relatorios ?? []).map((r) => r.numero)) + 1;

  const rascunhos = (relatorios ?? [])
    .filter((r) => r.status === "rascunho")
    .map((r) => ({
      id: r.id,
      numero: r.numero,
      status: r.status as "rascunho" | "enviado",
      dados_rascunho: r.dados_rascunho as RelatorioRascunho | null,
    }));

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <div className="flex flex-col gap-4 min-[800px]:flex-row min-[800px]:items-start min-[800px]:justify-between">
          <div className="space-y-2">
            <h1 className="font-serif text-[32px] font-light leading-tight">
              {obra.nome}
            </h1>
            <p className="text-sm text-cinza-2">
              {obra.endereco} · {obra.cliente_nome} · entrega{" "}
              {formatarDataBr(entregaPrevista)}
            </p>
            {obra.arquivada_em ? <Selo tom="cinza">Arquivada</Selo> : null}
          </div>
          <Suspense fallback={<div className="h-10" />}>
            <DetalheAcoes
              obraId={obra.id}
              obraNome={obra.nome}
              endereco={obra.endereco}
              arquivada={obra.arquivada_em != null}
              etapas={listaEtapas.map((e) => ({
                id: e.id,
                nome: e.nome,
                peso: Number(e.peso),
                pct_atual: e.pct_atual,
              }))}
              proximoNumero={proximoNumero}
              maxMedicao={maxMedicao}
              maxAditivo={maxAditivo}
              diasAditivadosPersistidos={dias.reduce((a, b) => a + b, 0)}
              terminoContratual={obra.termino_contratual}
              valorContratadoCentavos={obra.valor_contratado_centavos}
              pagoPersistidoCentavos={fin.pagoAcumuladoCentavos}
              aditivosPersistidosCentavos={aditivos.reduce((a, b) => a + b, 0)}
              climaDias={clima ?? []}
              rascunhos={rascunhos}
            />
          </Suspense>
        </div>
      </header>

      <CartaoEscuro className="grid gap-6 p-6 min-[800px]:grid-cols-[auto_1fr]">
        <AnelProgresso pct={avanco} />
        <div className="space-y-4">
          <BarraProgresso pct={avanco} className="bg-white/15" />
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <RotuloSecao className="text-marca-clara">Etapas</RotuloSecao>
              <p className="mt-1 font-serif text-xl font-light">
                {etapasConcluidas} de {listaEtapas.length}
              </p>
            </div>
            <div>
              <RotuloSecao className="text-marca-clara">Pago</RotuloSecao>
              <p className="mt-1 font-serif text-xl font-light">
                {formatarBRLCompacto(fin.pagoAcumuladoCentavos)}
              </p>
              <p className="text-xs text-white/60">{fin.pctPago}% do contrato</p>
            </div>
            <div>
              <RotuloSecao className="text-marca-clara">Entrega</RotuloSecao>
              <p className="mt-1 font-serif text-xl font-light">
                {formatarDataBr(entregaPrevista)}
              </p>
            </div>
          </div>
        </div>
      </CartaoEscuro>

      <div className="grid gap-6 min-[800px]:grid-cols-2">
        <section className="space-y-3">
          <RotuloSecao>Avanço físico</RotuloSecao>
          <p className="text-xs text-cinza-3">
            Atualizado pelo último relatório enviado
          </p>
          <Cartao className="divide-y divide-divisor px-4">
            {listaEtapas.map((etapa) => {
              const cor =
                etapa.pct_atual >= 100
                  ? "bg-tinta"
                  : etapa.pct_atual > 0
                    ? "bg-marca"
                    : "bg-cinza-3";
              const barra =
                etapa.pct_atual >= 100
                  ? "bg-tinta"
                  : etapa.pct_atual > 0
                    ? "bg-marca"
                    : "bg-cinza-3";
              return (
                <div
                  key={etapa.id}
                  className="flex items-center gap-3 py-3 text-sm"
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${cor}`} />
                  <span className="flex-1 truncate">{etapa.nome}</span>
                  <span className="w-10 text-right tabular-nums text-cinza-2">
                    {etapa.pct_atual}%
                  </span>
                  <div className="h-[2px] w-16 overflow-hidden rounded-full bg-divisor">
                    <div
                      className={`h-full ${barra}`}
                      style={{ width: `${etapa.pct_atual}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </Cartao>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <RotuloSecao>Relatórios</RotuloSecao>
            <Link href={`/obras/${obra.id}?novoRelatorio=1`}>
              <Botao variante="primario" className="text-xs py-2 px-4">
                Novo relatório
              </Botao>
            </Link>
          </div>
          <FeedRelatorios
            obraId={obra.id}
            relatorios={(relatorios ?? []).map((r) => ({
              id: r.id,
              numero: r.numero,
              status: r.status as "rascunho" | "enviado",
              geral_antes: r.geral_antes,
              geral_depois: r.geral_depois,
              enviado_em: r.enviado_em,
              criado_em: r.criado_em,
              pdf_path: r.pdf_path,
              snapshot: r.snapshot as RelatorioSnapshot | null,
            }))}
          />
        </section>
      </div>

      {!obra.arquivada_em ? (
        <div className="border-t border-divisor pt-4">
          <ModalArquivarObra obraId={obra.id} nomeObra={obra.nome} />
        </div>
      ) : null}
    </div>
  );
}
