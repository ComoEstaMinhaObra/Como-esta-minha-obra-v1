import { createClient } from "@/lib/supabase/server";
import { DashboardObras, type ObraCard } from "./DashboardObras";

export default async function ObrasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.rpc("fn_listar_obras_empreiteiro");
  const lista = (data ?? []) as {
    id: string;
    nome: string;
    clienteNome: string;
    fotoCapaPath: string | null;
    arquivada: boolean;
  }[];

  const cards: ObraCard[] = await Promise.all(
    lista.map(async (obra) => {
      let fotoCapaUrl: string | null = null;
      let avanco = 0;
      let etapasConcluidas = 0;
      let totalEtapas = 0;
      let relatoriosEnviados = 0;

      if (!obra.arquivada) {
        const [{ data: etapas }, { data: relatorios }] = await Promise.all([
          supabase
            .from("etapas")
            .select("peso, pct_atual")
            .eq("obra_id", obra.id),
          supabase
            .from("relatorios")
            .select("status")
            .eq("obra_id", obra.id)
            .eq("status", "enviado"),
        ]);
        const somaPeso = (etapas ?? []).reduce((a, e) => a + Number(e.peso), 0);
        const soma = (etapas ?? []).reduce(
          (a, e) => a + Number(e.peso) * e.pct_atual,
          0,
        );
        avanco = somaPeso ? Math.round(soma / somaPeso) : 0;
        etapasConcluidas = (etapas ?? []).filter((e) => e.pct_atual === 100).length;
        totalEtapas = etapas?.length ?? 0;
        relatoriosEnviados = relatorios?.length ?? 0;
        if (obra.fotoCapaPath) {
          const { data: signed } = await supabase.storage
            .from("capas")
            .createSignedUrl(obra.fotoCapaPath, 3600);
          fotoCapaUrl = signed?.signedUrl ?? null;
        }
      }

      return {
        id: obra.id,
        nome: obra.nome,
        clienteNome: obra.clienteNome,
        fotoCapaUrl,
        avanco,
        etapasConcluidas,
        totalEtapas,
        relatoriosEnviados,
        arquivada: obra.arquivada,
      };
    }),
  );

  return <DashboardObras obras={cards} />;
}
