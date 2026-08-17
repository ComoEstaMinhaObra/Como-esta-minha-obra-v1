import Link from "next/link";
import { redirect } from "next/navigation";
import { sairCliente } from "../actions";
import { ClientePageHeader } from "@/components/cliente/ClientePageHeader";
import { Avatar, BarraProgresso } from "@/components/ui";
import {
  calcularAvancoGeral,
  calcularNovaDataTermino,
} from "@/lib/relatorios/calculos";
import { createClient } from "@/lib/supabase/server";
import { formatarDataBr } from "@/lib/datas";
import { carregarDadosCliente } from "@/lib/cliente/carregar-dados";

function statusDeAvanco(pct: number) {
  if (pct >= 100)
    return { label: "Concluída", cor: "text-tinta", dot: "bg-tinta" };
  if (pct <= 0)
    return { label: "A iniciar", cor: "text-cinza-2", dot: "bg-cinza-3" };
  return { label: "Em obra", cor: "text-marca", dot: "bg-marca" };
}

export default async function PerfilPage({
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
    endereco: string;
    avanco: number;
    inicio: string;
    entrega: string;
    atual: boolean;
  }[] = [];

  if (obraIds.length > 0) {
    const { data: obras } = await supabase
      .from("obras")
      .select(
        "id, nome, endereco, inicio_contratual, termino_contratual, arquivada_em",
      )
      .in("id", obraIds)
      .is("arquivada_em", null);
    for (const o of obras ?? []) {
      const [{ data: etapas }, { data: dias }] = await Promise.all([
        supabase.from("etapas").select("peso, pct_atual").eq("obra_id", o.id),
        supabase.from("dias_aditivados").select("dias").eq("obra_id", o.id),
      ]);
      obrasCards.push({
        id: o.id,
        nome: o.nome,
        endereco: o.endereco,
        avanco: calcularAvancoGeral(
          (etapas ?? []).map((e) => ({
            peso: Number(e.peso),
            pct: e.pct_atual,
          })),
        ),
        inicio: o.inicio_contratual,
        entrega: calcularNovaDataTermino(
          o.termino_contratual,
          (dias ?? []).map((d) => d.dias),
        ),
        atual: o.id === obraId,
      });
    }
  }

  const dadosPessoais = [
    ["Nome", dados.usuario.nome],
    ["E-mail", dados.usuario.email],
    ["Telefone", "Não informado"],
    ["CPF", "Não informado"],
    ["Cliente desde", "—"],
  ];
  return (
    <div className="min-h-screen px-7 pb-[120px] pt-[34px] md:px-8 lg:px-10">
      <ClientePageHeader eyebrow="Minha conta" titulo="Perfil" />
      <div className="lg:mt-7 lg:grid lg:grid-cols-2 lg:items-start lg:gap-16">
        <section className="mt-7 flex items-center gap-4 lg:col-start-1 lg:mt-0">
          <Avatar
            nome={dados.usuario.nome}
            tamanho={64}
            className="bg-cartao font-serif text-[22px]"
          />
          <div className="min-w-0">
            <p className="font-serif text-[21px] leading-[1.1]">
              {dados.usuario.nome}
            </p>
            <p className="mt-[5px] text-[11px] tracking-[0.14em] uppercase text-cinza-2">
              Proprietário
            </p>
          </div>
        </section>
        <section className="mt-[26px] lg:col-start-1">
          {dadosPessoais.map(([label, valor]) => (
            <div
              key={label}
              className="flex items-baseline justify-between gap-3 border-b border-divisor py-[13px] text-[12.5px]"
            >
              <span className="text-cinza-2">{label}</span>
              <span className="text-right text-tinta">{valor}</span>
            </div>
          ))}
        </section>
        <section className="mt-11 lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:mt-0">
          <div className="flex items-baseline gap-2">
            <h2 className="font-serif text-[24px] font-normal">Minhas obras</h2>
            <span className="text-[10.5px] text-cinza-3">
              {obrasCards.length} obra{obrasCards.length === 1 ? "" : "s"}
            </span>
          </div>
          <ul className="mt-[18px] grid grid-cols-1 gap-[14px]">
            {obrasCards.map((o) => {
              const st = statusDeAvanco(o.avanco);
              return (
                <li key={o.id}>
                  <Link href={`/c/${o.id}`} className="block">
                    <article
                      className={`rounded-[20px] border bg-cartao px-5 pb-4 pt-[18px] ${o.atual ? "border-[#F1C9B5]" : "border-borda"}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-[9px]">
                          <span
                            className={`h-1.5 w-1.5 flex-none rounded-full ${st.dot}`}
                          />
                          <p className="truncate font-serif text-[18px]">
                            {o.nome}
                          </p>
                        </div>
                        <span
                          className={`whitespace-nowrap text-[9.5px] tracking-[0.14em] uppercase ${st.cor}`}
                        >
                          {st.label}
                        </span>
                      </div>
                      <p className="mt-[5px] text-[11.5px] text-cinza-2">
                        {o.endereco}
                      </p>
                      <div className="mt-4 flex items-center gap-3">
                        <BarraProgresso pct={o.avanco} />
                        <span className="text-[11px] text-cinza-2">
                          {o.avanco}%
                        </span>
                      </div>
                      <div className="mt-2.5 flex items-center justify-between gap-3">
                        <span className="text-[10px] tracking-[0.1em] uppercase text-cinza-3">
                          {formatarDataBr(o.inicio)} —{" "}
                          {formatarDataBr(o.entrega)}
                        </span>
                        <span className="text-[14px] text-cinza-2">→</span>
                      </div>
                    </article>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
        <section className="mt-9 text-[13px] lg:col-start-1">
          <div className="flex items-center justify-between border-y border-divisor py-[15px]">
            <span>Notificações</span>
            <span className="text-[11px] text-cinza-3">ativadas</span>
          </div>
          <div className="flex items-center justify-between border-b border-divisor py-[15px]">
            <span>Ajuda e suporte</span>
            <span className="text-cinza-3">›</span>
          </div>
          <form action={sairCliente}>
            <button
              type="submit"
              className="flex w-full items-center justify-between border-b border-divisor py-[15px] text-left text-marca"
            >
              Sair da conta
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
