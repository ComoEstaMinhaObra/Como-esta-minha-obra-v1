import { redirect } from "next/navigation";
import { ClienteHeader } from "@/components/cliente/ClienteHeader";
import { LinhaDoTempoCalendario } from "@/components/cliente/LinhaDoTempoCalendario";
import { carregarDadosCliente } from "@/lib/cliente/carregar-dados";
import { primeiroNome } from "@/lib/datas";

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
    <div className="space-y-4">
      <ClienteHeader
        saudacao={`Olá, ${primeiroNome(dados.usuario.nome)}`}
        nomeObra={dados.obra.nome}
        nomeUsuario={dados.usuario.nome}
      />
      <div>
        <p className="text-[10px] tracking-[0.16em] uppercase text-cinza-2">
          Linha do tempo
        </p>
        <p className="mt-1 text-sm text-cinza-2">
          {total} relatório{total === 1 ? "" : "s"} no período da obra
        </p>
      </div>
      {dados.semRelatorio ? (
        <p className="text-sm text-cinza-2">
          O calendário fica ativo após o envio do primeiro relatório.
        </p>
      ) : (
        <LinhaDoTempoCalendario
          inicioIso={dados.obra.inicioContratual}
          fimIso={dados.agregados.entregaPrevista}
          relatorios={dados.todosRelatorios}
        />
      )}
    </div>
  );
}
