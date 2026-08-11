import { redirect } from "next/navigation";
import { ClienteHeader } from "@/components/cliente/ClienteHeader";
import { InformacoesAcordeao } from "@/components/cliente/InformacoesAcordeao";
import { carregarDadosCliente } from "@/lib/cliente/carregar-dados";
import { primeiroNome } from "@/lib/datas";

export default async function InformacoesPage({
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

  return (
    <div className="space-y-4">
      <ClienteHeader
        saudacao={`Olá, ${primeiroNome(dados.usuario.nome)}`}
        nomeObra={dados.obra.nome}
        nomeUsuario={dados.usuario.nome}
      />
      <p className="text-[10px] tracking-[0.16em] uppercase text-cinza-2">
        Informações da obra
      </p>
      <InformacoesAcordeao
        obra={dados.obra}
        etapas={dados.etapas}
        lancamentos={dados.lancamentos}
        diasAditivados={dados.diasAditivados}
        agregados={dados.agregados}
      />
    </div>
  );
}
