import { redirect } from "next/navigation";
import { ClientePageHeader } from "@/components/cliente/ClientePageHeader";
import {
  GaleriaCliente,
  type GrupoGaleria,
} from "@/components/cliente/GaleriaCliente";
import { carregarDadosCliente } from "@/lib/cliente/carregar-dados";

export default async function GaleriaPage({
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

  const porData = new Map<string, GrupoGaleria["fotos"]>();
  for (const f of dados.fotos) {
    if (!f.urlAssinada) continue;
    const dataIso = f.relatorioEnviadoEm.slice(0, 10);
    const lista = porData.get(dataIso) ?? [];
    lista.push({
      id: f.id,
      url: f.urlAssinada,
      etapaNome: f.etapaNome,
      publicadaEm: f.relatorioEnviadoEm,
    });
    porData.set(dataIso, lista);
  }

  const grupos: GrupoGaleria[] = [...porData.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([dataIso, fotos]) => ({ dataIso, fotos }));

  return (
    <div className="min-h-screen px-7 pb-[120px] pt-[34px] md:px-8 lg:px-10">
      <ClientePageHeader
        eyebrow={dados.obra.nome}
        titulo="Galeria"
        subtitulo={`${dados.fotos.length} foto${dados.fotos.length === 1 ? "" : "s"} da obra`}
      />
      {dados.semRelatorio ? (
        <p className="mt-8 text-sm text-cinza-2">
          As fotos aparecem aqui quando o primeiro relatório for enviado.
        </p>
      ) : (
        <div className="mt-8">
          <GaleriaCliente grupos={grupos} />
        </div>
      )}
    </div>
  );
}
