import { createClient } from "@/lib/supabase/server";
import { calcularAvancoGeral } from "@/lib/relatorios/calculos";
import { DashboardObras, type ObraCard } from "./DashboardObras";

export default async function ObrasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: obras } = await supabase
    .from("obras")
    .select(
      "id, nome, cliente_nome, foto_capa_path, arquivada_em",
    )
    .eq("owner_id", user.id)
    .order("criado_em", { ascending: false });

  const cards: ObraCard[] = await Promise.all(
    (obras ?? []).map(async (obra) => {
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

      const avanco = calcularAvancoGeral(
        (etapas ?? []).map((e) => ({
          peso: Number(e.peso),
          pct: e.pct_atual,
        })),
      );
      const etapasConcluidas = (etapas ?? []).filter(
        (e) => e.pct_atual === 100,
      ).length;

      let fotoCapaUrl: string | null = null;
      if (obra.foto_capa_path) {
        const { data } = await supabase.storage
          .from("capas")
          .createSignedUrl(obra.foto_capa_path, 3600);
        fotoCapaUrl = data?.signedUrl ?? null;
      }

      return {
        id: obra.id,
        nome: obra.nome,
        clienteNome: obra.cliente_nome,
        fotoCapaUrl,
        avanco,
        etapasConcluidas,
        totalEtapas: etapas?.length ?? 0,
        relatoriosEnviados: relatorios?.length ?? 0,
        arquivada: obra.arquivada_em != null,
      };
    }),
  );

  return <DashboardObras obras={cards} />;
}
