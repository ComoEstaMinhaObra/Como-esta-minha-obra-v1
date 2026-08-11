import { redirect } from "next/navigation";
import { ClienteHeader } from "@/components/cliente/ClienteHeader";
import {
  GaleriaCliente,
  type GrupoGaleria,
} from "@/components/cliente/GaleriaCliente";
import { carregarDadosCliente } from "@/lib/cliente/carregar-dados";
import { primeiroNome } from "@/lib/datas";

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
    <div className="space-y-4">
      <ClienteHeader
        saudacao={`Olá, ${primeiroNome(dados.usuario.nome)}`}
        nomeObra={dados.obra.nome}
        nomeUsuario={dados.usuario.nome}
      />
      <p className="text-[10px] tracking-[0.16em] uppercase text-cinza-2">
        Galeria
      </p>
      {dados.semRelatorio ? (
        <p className="text-sm text-cinza-2">
          As fotos aparecem aqui quando o primeiro relatório for enviado.
        </p>
      ) : (
        <GaleriaCliente grupos={grupos} />
      )}
    </div>
  );
}
