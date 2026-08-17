import { redirect } from "next/navigation";
import { AtividadesGrade } from "@/components/cliente/AtividadesGrade";
import { ClienteHeader } from "@/components/cliente/ClienteHeader";
import { GaugeDuplo } from "@/components/cliente/GaugeDuplo";
import { InformacoesAcordeao } from "@/components/cliente/InformacoesAcordeao";
import { PdfOverlay } from "@/components/cliente/PdfOverlay";
import { CartaoEscuro, Selo } from "@/components/ui";
import { carregarDadosCliente } from "@/lib/cliente/carregar-dados";
import { formatarDataBr, formatarDataCurta, primeiroNome } from "@/lib/datas";
import { formatarBRL } from "@/lib/formatacao";

function dataRelatorio(iso: string) {
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano?.slice(-2)}`;
}

function tamanhoIndicador(valor: string) {
  const digitos = valor.replace(/\D/g, "").length;
  return Math.max(14, Math.min(24, 27 - Math.max(0, digitos - 3) * 1.5));
}

function dataPublicacao(iso: string) {
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  const meses = [
    "jan",
    "fev",
    "mar",
    "abr",
    "mai",
    "jun",
    "jul",
    "ago",
    "set",
    "out",
    "nov",
    "dez",
  ];
  return `${Number(dia)} ${meses[Number(mes) - 1] ?? mes} ${ano}`;
}

function IconeClima({
  condicao,
}: {
  condicao: "aberto" | "nublado" | "chuvoso";
}) {
  const props = {
    fill: "none",
    strokeWidth: 1.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (condicao === "aberto")
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-[17px] w-[17px] stroke-marca"
        {...props}
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 3v2.2M12 18.8V21M4.4 4.4l1.6 1.6M18 18l1.6 1.6M3 12h2.2M18.8 12H21M4.4 19.6 6 18M18 6l1.6-1.6" />
      </svg>
    );
  if (condicao === "nublado")
    return (
      <svg
        viewBox="0 0 24 24"
        className="h-[17px] w-[17px] stroke-cinza-2"
        {...props}
      >
        <path d="M7 17.5a4 4 0 0 1-.6-7.95A5 5 0 0 1 16 8.4a4.2 4.2 0 0 1 1 9.1z" />
      </svg>
    );
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[17px] w-[17px] stroke-[#5d7b96]"
      {...props}
    >
      <path d="M7 15.5a4 4 0 0 1-.6-7.95A5 5 0 0 1 16 6.4a4.2 4.2 0 0 1 1 9.1z" />
      <path d="M8 19.5 7 21.5M12 19.5l-1 2M16 19.5l-1 2" />
    </svg>
  );
}

export default async function ClienteInicioPage({
  params,
}: {
  params: Promise<{ obraId: string }>;
}) {
  const { obraId } = await params;
  const result = await carregarDadosCliente(obraId);
  if (!result.ok) {
    if (result.motivo === "nao_autenticado")
      redirect(`/entrar?next=${encodeURIComponent(`/c/${obraId}`)}`);
    redirect(`/c/${obraId}`);
  }

  const { dados } = result;
  const nome = primeiroNome(dados.usuario.nome);
  const informacoes = (
    <InformacoesAcordeao
      obra={dados.obra}
      etapas={dados.etapas}
      lancamentos={dados.lancamentos}
      diasAditivados={dados.diasAditivados}
      agregados={dados.agregados}
    />
  );

  if (dados.semRelatorio || !dados.ultimoRelatorio) {
    return (
      <div>
        <ClienteHeader
          saudacao={`Olá, ${nome}`}
          nomeObra={dados.obra.nome}
          nomeUsuario={dados.usuario.nome}
        />
        <section className="px-7 pt-8 md:px-8 lg:px-10">
          <p className="font-serif text-2xl font-normal">
            Aguardando o primeiro relatório
          </p>
          <p className="mt-3 text-sm text-cinza-2">
            Assim que o empreiteiro enviar um relatório de {dados.obra.nome}, o
            acompanhamento aparece aqui.
          </p>
        </section>
        <section className="px-7 pt-14 md:px-8 lg:px-10">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h2 className="font-serif text-[24px] font-normal">
              Informações da obra
            </h2>
          </div>
          {informacoes}
        </section>
      </div>
    );
  }

  const { ultimoRelatorio, relatorioAnterior, agregados, obra, climaDias } =
    dados;
  const snap = ultimoRelatorio.snapshot;
  const ehNovo =
    Date.now() - new Date(ultimoRelatorio.enviadoEm).getTime() <
    7 * 24 * 60 * 60 * 1000;
  const fotosPorPath = new Map(
    dados.fotos.map((f) => [f.storagePath, f.urlAssinada]),
  );
  const atividades = snap.atividades.map((a) => {
    const etapa = dados.etapas.find((e) => e.nome === a.etapaNome);
    return {
      etapaNome: a.etapaNome,
      nota: a.nota,
      fotosUrls: a.fotosPaths
        .map((p) => fotosPorPath.get(p) ?? null)
        .filter((u): u is string => !!u),
      status:
        etapa && etapa.pctAtual >= 100
          ? ("concluida" as const)
          : ("em_andamento" as const),
      autor: obra.engenheiro || "Engenheiro responsável",
      dataIso: ultimoRelatorio.enviadoEm,
    };
  });
  const indicadores = [
    [
      [dataRelatorio(agregados.entregaPrevista), "entrega da obra"],
      [formatarBRL(agregados.contratadoTotalCentavos), "total do contrato"],
    ],
    [
      [String(agregados.diasDeObra), "dias de obra"],
      [formatarBRL(agregados.pagoAcumuladoCentavos), "desembolsado"],
    ],
    [
      [String(agregados.diasRestantes), "dias restantes"],
      [formatarBRL(agregados.saldoCentavos), "saldo a pagar"],
    ],
  ] as const;

  return (
    <div>
      <ClienteHeader
        saudacao={`Olá, ${nome}`}
        nomeObra={obra.nome}
        nomeUsuario={dados.usuario.nome}
      />
      <div className="xl:grid xl:grid-cols-12 xl:gap-x-16 xl:gap-y-14 xl:px-10">
        <section className="px-7 pt-7 md:px-8 lg:px-10 xl:col-span-7 xl:px-0">
          <div className="mb-[26px] flex flex-col items-center gap-[6px] text-center lg:flex-row lg:flex-nowrap lg:justify-start lg:gap-2 lg:text-left">
            <span className="text-[11px] tracking-[0.18em] uppercase lg:whitespace-nowrap">
              Relatório nº {ultimoRelatorio.numero}
            </span>
            <span
              aria-hidden
              className="hidden text-[11px] text-cinza-2 lg:inline"
            >
              ·
            </span>
            <span className="text-[10.5px] tracking-[0.1em] uppercase text-cinza-2 lg:whitespace-nowrap">
              atual {dataRelatorio(ultimoRelatorio.enviadoEm)}
            </span>
            {relatorioAnterior ? (
              <span className="text-[10.5px] tracking-[0.1em] uppercase text-cinza-3">
                anterior {dataRelatorio(relatorioAnterior.enviadoEm)}
              </span>
            ) : null}
          </div>
          <div className="md:grid md:grid-cols-[250px_minmax(0,1fr)] md:items-start md:gap-8 xl:hidden">
            <GaugeDuplo
              avancoPct={agregados.avancoGeral}
              pagoPct={agregados.pctPago}
            />
            <div className="mt-[14px] md:mt-0">
              {indicadores.map((linha, linhaIndex) => (
                <div key={linhaIndex} className="grid grid-cols-2 gap-x-6">
                  {linha.map(([valor, label]) => (
                    <div
                      key={label}
                      className={`flex flex-col items-center justify-center py-3 text-center ${linhaIndex < indicadores.length - 1 ? "border-b border-divisor" : ""}`}
                    >
                      <p
                        className="font-serif font-normal leading-none whitespace-nowrap"
                        style={{ fontSize: `${tamanhoIndicador(valor)}px` }}
                      >
                        {valor}
                      </p>
                      <p className="mt-[6px] text-[9.5px] tracking-[0.14em] uppercase text-cinza-3">
                        {label}
                      </p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="hidden xl:grid xl:grid-cols-[minmax(0,1fr)_300px_minmax(0,1fr)] xl:items-center xl:gap-4">
            <div>
              {indicadores.map(([linha], linhaIndex) => {
                const [valor, label] = linha;
                return (
                  <div
                    key={label}
                    className={`flex flex-col items-center justify-center py-3 text-center ${linhaIndex < indicadores.length - 1 ? "border-b border-divisor" : ""}`}
                  >
                    <p
                      className="font-serif font-normal leading-none whitespace-nowrap"
                      style={{ fontSize: `${tamanhoIndicador(valor)}px` }}
                    >
                      {valor}
                    </p>
                    <p className="mt-[6px] text-[9.5px] tracking-[0.14em] uppercase text-cinza-3">
                      {label}
                    </p>
                  </div>
                );
              })}
            </div>
            <GaugeDuplo
              avancoPct={agregados.avancoGeral}
              pagoPct={agregados.pctPago}
              tamanho={300}
            />
            <div>
              {indicadores.map(([, linha], linhaIndex) => {
                const [valor, label] = linha;
                return (
                  <div
                    key={label}
                    className={`flex flex-col items-center justify-center py-3 text-center ${linhaIndex < indicadores.length - 1 ? "border-b border-divisor" : ""}`}
                  >
                    <p
                      className="font-serif font-normal leading-none whitespace-nowrap"
                      style={{ fontSize: `${tamanhoIndicador(valor)}px` }}
                    >
                      {valor}
                    </p>
                    <p className="mt-[6px] text-[9.5px] tracking-[0.14em] uppercase text-cinza-3">
                      {label}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="px-7 pt-[50px] md:px-8 lg:px-10 xl:col-span-5 xl:px-0 xl:pt-[84px]">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-serif text-[24px] font-normal">Tempo</h2>
            <p className="truncate text-[10.5px] tracking-[0.1em] uppercase text-cinza-2">
              {obra.endereco}
            </p>
          </div>
          <p className="mt-[6px] text-[11px] text-cinza-3">
            últimos 7 dias antes do relatório nº {ultimoRelatorio.numero}
          </p>
          {climaDias.length === 0 ? (
            <p className="mt-4 text-sm text-cinza-2">
              Clima indisponível para este endereço.
            </p>
          ) : (
            <>
              <ul className="mt-[18px] grid grid-cols-7 gap-1 rounded-[18px] border border-borda bg-cartao px-[6px] pb-[14px] pt-4">
                {climaDias.map((d) => (
                  <li
                    key={d.data}
                    className="flex flex-col items-center gap-[7px]"
                  >
                    <IconeClima condicao={d.condicao} />
                    <span className="text-[10.5px] text-cinza-2">
                      {d.probChuva != null ? `${d.probChuva}%` : "—"}
                    </span>
                    <span className="text-[9.5px] tracking-[0.08em] text-cinza-3">
                      {formatarDataCurta(d.data)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2.5 text-[10px] text-cinza-3">
                % de chance de chuva registrada no dia
              </p>
            </>
          )}
        </section>

        <section className="px-7 pt-14 md:px-8 lg:px-10 xl:col-span-7 xl:px-0 xl:pt-0">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h2 className="font-serif text-[24px] font-normal">
              Informações da obra
            </h2>
          </div>
          {informacoes}
        </section>

        <section className="px-7 pt-14 md:px-8 lg:px-10 xl:col-span-5 xl:px-0 xl:pt-0">
          <h2 className="mb-5 font-serif text-[24px] font-normal">
            Atividades Executadas
          </h2>
          <AtividadesGrade atividades={atividades} />
          <CartaoEscuro className="mt-[26px] flex flex-nowrap items-center gap-2.5 px-5 py-5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="whitespace-nowrap font-serif text-[19px]">
                  Relatório nº {ultimoRelatorio.numero}
                </p>
                {ehNovo ? (
                  <Selo
                    tom="ambar"
                    className="shrink-0 whitespace-nowrap !bg-marca px-[7px] py-[3px] text-[7.5px] tracking-[0.1em] uppercase !text-white"
                  >
                    novo
                  </Selo>
                ) : null}
              </div>
              <p className="mt-1 whitespace-nowrap text-xs text-white/60">
                publicado hoje · {dataPublicacao(ultimoRelatorio.enviadoEm)}
              </p>
            </div>
            <PdfOverlay
              relatorioId={ultimoRelatorio.id}
              numero={ultimoRelatorio.numero}
              dataLabel={formatarDataBr(ultimoRelatorio.enviadoEm.slice(0, 10))}
            />
          </CartaoEscuro>
        </section>
      </div>
    </div>
  );
}
