import Link from "next/link";
import { redirect } from "next/navigation";
import { sairCliente } from "../actions";
import { ClienteHeader } from "@/components/cliente/ClienteHeader";
import { BarraProgresso, Botao, Cartao, Selo } from "@/components/ui";
import {
  calcularAvancoGeral,
  calcularNovaDataTermino,
} from "@/lib/relatorios/calculos";
import { createClient } from "@/lib/supabase/server";
import { formatarDataBr, primeiroNome } from "@/lib/datas";
import { carregarDadosCliente } from "@/lib/cliente/carregar-dados";

function statusDeAvanco(pct: number): { label: string; tom: "ambar" | "verde" | "cinza" } {
  if (pct >= 100) return { label: "Concluída", tom: "verde" };
  if (pct <= 0) return { label: "A iniciar", tom: "cinza" };
  return { label: "Em obra", tom: "ambar" };
}

export default async function PerfilPage({
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
  const supabase = await createClient();

  const { data: acessos } = await supabase
    .from("obra_acessos")
    .select("obra_id")
    .eq("user_id", dados.usuario.id)
    .eq("status", "ativo");

  const obraIds = (acessos ?? []).map((a) => a.obra_id);
  const obrasCards: {
    id: string;
    nome: string;
    avanco: number;
    inicio: string;
    entrega: string;
    atual: boolean;
  }[] = [];

  if (obraIds.length > 0) {
    const { data: obras } = await supabase
      .from("obras")
      .select("id, nome, inicio_contratual, termino_contratual, arquivada_em")
      .in("id", obraIds)
      .is("arquivada_em", null);

    for (const o of obras ?? []) {
      const [{ data: etapas }, { data: dias }] = await Promise.all([
        supabase
          .from("etapas")
          .select("peso, pct_atual")
          .eq("obra_id", o.id),
        supabase.from("dias_aditivados").select("dias").eq("obra_id", o.id),
      ]);
      const avanco = calcularAvancoGeral(
        (etapas ?? []).map((e) => ({
          peso: Number(e.peso),
          pct: e.pct_atual,
        })),
      );
      const entrega = calcularNovaDataTermino(
        o.termino_contratual,
        (dias ?? []).map((d) => d.dias),
      );
      obrasCards.push({
        id: o.id,
        nome: o.nome,
        avanco,
        inicio: o.inicio_contratual,
        entrega,
        atual: o.id === obraId,
      });
    }
  }

  return (
    <div className="space-y-6">
      <ClienteHeader
        saudacao={`Olá, ${primeiroNome(dados.usuario.nome)}`}
        nomeObra={dados.obra.nome}
        nomeUsuario={dados.usuario.nome}
      />

      <section className="space-y-2">
        <p className="text-[10px] tracking-[0.16em] uppercase text-cinza-2">
          Seu perfil
        </p>
        <Cartao className="space-y-2 p-4 text-sm">
          <Linha label="Nome" valor={dados.usuario.nome} />
          <Linha label="E-mail" valor={dados.usuario.email} />
        </Cartao>
      </section>

      <section className="space-y-3">
        <p className="text-[10px] tracking-[0.16em] uppercase text-cinza-2">
          Minhas obras
        </p>
        <ul className="space-y-3">
          {obrasCards.map((o) => {
            const st = statusDeAvanco(o.avanco);
            return (
              <li key={o.id}>
                <Link href={`/c/${o.id}`}>
                  <Cartao
                    className={`space-y-2 p-4 ${
                      o.atual ? "border-marca ring-1 ring-marca" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-serif text-base font-light">{o.nome}</p>
                      <Selo tom={st.tom}>{st.label}</Selo>
                    </div>
                    <BarraProgresso pct={o.avanco} />
                    <p className="text-xs text-cinza-2">
                      {formatarDataBr(o.inicio)} — {formatarDataBr(o.entrega)} ·{" "}
                      {o.avanco}%
                    </p>
                  </Cartao>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <form action={sairCliente}>
        <Botao type="submit" variante="primario" className="w-full">
          Sair
        </Botao>
      </form>
    </div>
  );
}

function Linha({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-cinza-2">{label}</span>
      <span className="text-right">{valor}</span>
    </div>
  );
}
