import Link from "next/link";
import { redirect } from "next/navigation";
import { AtividadesGrade } from "@/components/cliente/AtividadesGrade";
import { ClienteHeader } from "@/components/cliente/ClienteHeader";
import { GaugeDuplo } from "@/components/cliente/GaugeDuplo";
import { PdfOverlay } from "@/components/cliente/PdfOverlay";
import { Cartao, CartaoEscuro, Selo } from "@/components/ui";
import { carregarDadosCliente } from "@/lib/cliente/carregar-dados";
import {
  formatarDataBr,
  formatarDataCurta,
  primeiroNome,
} from "@/lib/datas";
import { formatarBRL, formatarBRLCompacto } from "@/lib/formatacao";

const ICONE_CLIMA = {
  aberto: "☀",
  nublado: "☁",
  chuvoso: "🌧",
} as const;

export default async function ClienteInicioPage({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  const result = await carregarDadosCliente(obraId);

  if (!result.ok) {
    if (result.motivo === "nao_autenticado") {
      redirect(`/entrar?next=${encodeURIComponent(`/c/${obraId}`)}`);
    }
    redirect(`/c/${obraId}`);
  }

  const { dados } = result;
  const nome = primeiroNome(dados.usuario.nome);

  if (dados.semRelatorio || !dados.ultimoRelatorio) {
    return (
      <div>
        <ClienteHeader
          saudacao={`Olá, ${nome}`}
          nomeObra={dados.obra.nome}
          nomeUsuario={dados.usuario.nome}
        />
        <Cartao className="space-y-3 p-5 text-center">
          <p className="font-serif text-xl font-light text-tinta">
            Aguardando o primeiro relatório
          </p>
          <p className="text-sm text-cinza-2">
            Assim que o empreiteiro enviar um relatório de{" "}
            <span className="text-tinta">{dados.obra.nome}</span>, o
            acompanhamento aparece aqui.
          </p>
          <Link
            href={`/c/${obraId}/informacoes`}
            className="inline-block text-sm text-marca"
          >
            Ver informações da obra
          </Link>
        </Cartao>
      </div>
    );
  }

  const { ultimoRelatorio, relatorioAnterior, agregados, obra, climaDias } =
    dados;
  const snap = ultimoRelatorio.snapshot;
  const enviadoHa =
    Date.now() - new Date(ultimoRelatorio.enviadoEm).getTime();
  const ehNovo = enviadoHa < 7 * 24 * 60 * 60 * 1000;

  // URLs de fotos das atividades do snapshot
  const fotosPorPath = new Map(
    dados.fotos.map((f) => [f.storagePath, f.urlAssinada]),
  );

  const atividades = snap.atividades.map((a) => {
    const etapa = dados.etapas.find((e) => e.nome === a.etapaNome);
    const status =
      etapa && etapa.pctAtual >= 100 ? "concluida" : "em_andamento";
    return {
      etapaNome: a.etapaNome,
      nota: a.nota,
      fotosUrls: a.fotosPaths
        .map((p) => fotosPorPath.get(p) ?? null)
        .filter((u): u is string => !!u),
      status: status as "concluida" | "em_andamento",
      autor: obra.engenheiro || "Engenheiro responsável",
      dataIso: ultimoRelatorio.enviadoEm,
    };
  });

  const indicadores = [
    {
      label: "Entrega prevista",
      valor: formatarDataBr(agregados.entregaPrevista),
    },
    { label: "Dias de obra", valor: String(agregados.diasDeObra) },
    {
      label: "Dias restantes",
      valor: String(agregados.diasRestantes),
    },
    {
      label: "Contratado total",
      valor: formatarBRLCompacto(agregados.contratadoTotalCentavos),
    },
    {
      label: "Desembolsado",
      valor: formatarBRLCompacto(agregados.pagoAcumuladoCentavos),
    },
    {
      label: "Saldo a pagar",
      valor: formatarBRL(agregados.saldoCentavos),
    },
  ];

  return (
    <div className="space-y-6">
      <ClienteHeader
        saudacao={`Olá, ${nome}`}
        nomeObra={obra.nome}
        nomeUsuario={dados.usuario.nome}
      />

      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] tracking-[0.16em] uppercase text-cinza-2">
            Relatório vigente
          </p>
          <p className="font-serif text-xl font-light">
            nº {ultimoRelatorio.numero}
          </p>
        </div>
        <div className="text-right text-xs text-cinza-2">
          <div>
            Atual · {formatarDataBr(ultimoRelatorio.enviadoEm.slice(0, 10))}
          </div>
          {relatorioAnterior ? (
            <div>
              Anterior ·{" "}
              {formatarDataBr(relatorioAnterior.enviadoEm.slice(0, 10))}
            </div>
          ) : null}
        </div>
      </div>

      <GaugeDuplo
        avancoPct={agregados.avancoGeral}
        pagoPct={agregados.pctPago}
      />

      <div className="grid grid-cols-2 gap-3">
        {indicadores.map((ind) => (
          <Cartao key={ind.label} className="space-y-1 p-3">
            <p className="text-[10px] tracking-[0.14em] uppercase text-cinza-2">
              {ind.label}
            </p>
            <p className="font-serif text-lg font-light leading-tight">
              {ind.valor}
            </p>
          </Cartao>
        ))}
      </div>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[10px] tracking-[0.16em] uppercase text-cinza-2">
            Tempo
          </p>
          <p className="truncate text-[10px] text-cinza-3">{obra.endereco}</p>
        </div>
        {climaDias.length === 0 ? (
          <p className="text-sm text-cinza-2">
            clima indisponível para este endereço
          </p>
        ) : (
          <ul className="grid grid-cols-7 gap-1">
            {climaDias.map((d) => (
              <li
                key={d.data}
                className="rounded-[12px] border border-divisor p-1.5 text-center text-[10px]"
              >
                <div className="text-base" aria-hidden>
                  {ICONE_CLIMA[d.condicao]}
                </div>
                <div>{formatarDataCurta(d.data)}</div>
                <div className="text-cinza-2">
                  {d.probChuva != null ? `${d.probChuva}%` : "—"}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <p className="text-[10px] tracking-[0.16em] uppercase text-cinza-2">
            Atividades executadas
          </p>
          <Link href={`/c/${obraId}/informacoes`} className="text-xs text-marca">
            Informações
          </Link>
        </div>
        <AtividadesGrade atividades={atividades} />
      </section>

      <CartaoEscuro className="flex items-center justify-between gap-3 p-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-serif text-lg font-light">
              Relatório nº {ultimoRelatorio.numero}
            </p>
            {ehNovo ? <Selo tom="ambar">novo</Selo> : null}
          </div>
          <p className="mt-1 text-xs text-white/60">
            {formatarDataBr(ultimoRelatorio.enviadoEm.slice(0, 10))}
          </p>
        </div>
        <PdfOverlay
          relatorioId={ultimoRelatorio.id}
          numero={ultimoRelatorio.numero}
          dataLabel={formatarDataBr(ultimoRelatorio.enviadoEm.slice(0, 10))}
        />
      </CartaoEscuro>
    </div>
  );
}
