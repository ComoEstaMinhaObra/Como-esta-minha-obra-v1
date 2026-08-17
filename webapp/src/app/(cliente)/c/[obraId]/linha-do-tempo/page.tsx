import { redirect } from "next/navigation";
import { ClientePageHeader } from "@/components/cliente/ClientePageHeader";
import { LinhaDoTempoCalendario } from "@/components/cliente/LinhaDoTempoCalendario";
import { carregarDadosCliente } from "@/lib/cliente/carregar-dados";

export default async function LinhaDoTempoPage({
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
  const total = dados.todosRelatorios.length;

  return (
    <div className="min-h-screen px-7 pb-[120px] pt-[34px] md:px-8 lg:px-10">
      <ClientePageHeader
        eyebrow={dados.obra.nome}
        titulo="Linha do tempo"
        subtitulo={`${total} relatório${total === 1 ? "" : "s"} desde o início da obra`}
      />
      <div className="mt-[18px] flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-marca" />
        <p className="text-[11px] text-cinza-2">
          dias com relatório · toque para abrir
        </p>
      </div>
      {dados.semRelatorio ? (
        <p className="mt-8 text-sm text-cinza-2">
          O calendário fica ativo após o envio do primeiro relatório.
        </p>
      ) : (
        <div className="mt-[38px]">
          <LinhaDoTempoCalendario
            inicioIso={dados.obra.inicioContratual}
            fimIso={
              dados.ultimoRelatorio?.enviadoEm.slice(0, 10) ??
              dados.obra.inicioContratual
            }
            relatorios={dados.todosRelatorios}
          />
        </div>
      )}
    </div>
  );
}
