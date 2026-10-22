"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CopiarBotao } from "@/components/afiliados/CopiarBotao";
import {
  Botao,
  Cartao,
  CampoTexto,
  ModalBase,
  RotuloSecao,
  Selo,
  useToast,
} from "@/components/ui";
import { descreverComissao, descreverDesconto } from "@/lib/afiliados/formatar";
import type { PainelAfiliado as Painel } from "@/lib/afiliados/painel";
import {
  TIPOS_CHAVE_PIX,
  normalizarChavePix,
  type TipoChavePix,
} from "@/lib/afiliados/pix";
import { formatarBRL } from "@/lib/formatacao";
import { mensagemRpc } from "@/lib/rpc-erros";
import { solicitarSaque } from "./actions";

const data = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

const SELECT =
  "rounded-full border border-borda bg-white px-4 py-2.5 text-sm text-tinta outline-none focus:border-marca";

function Metrica({ titulo, valor, detalhe }: { titulo: string; valor: string; detalhe?: string }) {
  return (
    <li className="border-b border-divisor pb-4">
      <RotuloSecao>{titulo}</RotuloSecao>
      <p className="mt-2 font-serif text-3xl font-light tabular-nums">{valor}</p>
      {detalhe ? <p className="mt-1 text-xs text-cinza-3">{detalhe}</p> : null}
    </li>
  );
}

function SeloComissao({ status }: { status: "pendente" | "disponivel" | "estornada" }) {
  if (status === "disponivel") return <Selo tom="verde">disponível</Selo>;
  if (status === "pendente") return <Selo tom="ambar">a liberar</Selo>;
  return <Selo tom="cinza">estornada</Selo>;
}

function SeloSaque({ status }: { status: "solicitado" | "pago" | "recusado" }) {
  if (status === "pago") return <Selo tom="verde">pago</Selo>;
  if (status === "solicitado") return <Selo tom="ambar">em análise</Selo>;
  return <Selo tom="cinza">recusado</Selo>;
}

export function PainelAfiliado({ painel, baseUrl }: { painel: Painel; baseUrl: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [modal, setModal] = useState(false);
  const [tipo, setTipo] = useState<TipoChavePix>("cpf");
  const [chave, setChave] = useState("");
  const [erroChave, setErroChave] = useState<string | null>(null);

  const { saldo, config, links } = painel;
  const totais = links.reduce(
    (acc, l) => ({
      cadastros: acc.cadastros + l.cadastros,
      assinantes: acc.assinantes + l.assinantes,
      ativos: acc.ativos + l.ativos,
    }),
    { cadastros: 0, assinantes: 0, ativos: 0 },
  );

  const abaixoDoMinimo = saldo.disponivelCentavos < config.saqueMinimoCentavos;
  const podeSacar = !painel.saqueAberto && saldo.disponivelCentavos > 0 && !abaixoDoMinimo;
  const dicaChave = TIPOS_CHAVE_PIX.find((t) => t.valor === tipo)?.dica;

  function enviarPedido() {
    const n = normalizarChavePix(tipo, chave);
    if (!n.ok) {
      setErroChave(n.erro);
      return;
    }
    setErroChave(null);
    start(async () => {
      const r = await solicitarSaque(tipo, chave);
      if (!r.ok) {
        toast(mensagemRpc(r.erro));
        return;
      }
      toast("Pedido enviado. Avisaremos por e-mail quando o Pix for feito.");
      setModal(false);
      setChave("");
      router.refresh();
    });
  }

  return (
    <div className="max-w-4xl space-y-8">
      <header className="space-y-1">
        <h1 className="font-serif text-3xl font-light">Programa de afiliados</h1>
        <p className="text-sm text-cinza-2">
          Você ganha comissão sobre os pagamentos aprovados de quem se cadastra pelos seus links. A
          comissão fica “a liberar” por {config.carenciaDias} dias e depois entra no saldo
          disponível para saque.
        </p>
      </header>

      <ul className="grid grid-cols-2 gap-x-6 gap-y-4 min-[800px]:grid-cols-3">
        <Metrica titulo="Cadastros" valor={String(totais.cadastros)} detalhe="pelos seus links" />
        <Metrica titulo="Assinantes" valor={String(totais.assinantes)} detalhe="já fizeram um pagamento" />
        <Metrica titulo="Ativos agora" valor={String(totais.ativos)} detalhe="com assinatura em dia" />
        <Metrica titulo="Saldo disponível" valor={formatarBRL(saldo.disponivelCentavos)} />
        <Metrica
          titulo="A liberar"
          valor={formatarBRL(saldo.pendenteCentavos)}
          detalhe={`em carência de ${config.carenciaDias} dias`}
        />
        <Metrica titulo="Já recebido" valor={formatarBRL(saldo.recebidoCentavos)} detalhe="saques pagos" />
      </ul>

      <Cartao className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="space-y-1">
          <p className="font-medium">Saque via Pix</p>
          <p className="text-sm text-cinza-2">
            {painel.saqueAberto
              ? "Você tem um pedido em análise. Avisaremos por e-mail quando o Pix for feito."
              : saldo.disponivelCentavos <= 0
                ? "Você ainda não tem saldo disponível."
                : abaixoDoMinimo
                  ? `O saque mínimo é ${formatarBRL(config.saqueMinimoCentavos)}.`
                  : `Você pode sacar ${formatarBRL(saldo.disponivelCentavos)}. O pagamento é feito manualmente pelo suporte.`}
          </p>
        </div>
        <Botao disabled={!podeSacar} onClick={() => setModal(true)}>
          Solicitar saque
        </Botao>
      </Cartao>

      <section className="space-y-3">
        <RotuloSecao>Seus links</RotuloSecao>
        <ul className="space-y-3">
          {links.map((l) => {
            const url = `${baseUrl}/r/${l.codigo}`;
            const desconto = descreverDesconto(l.descontoBps, l.descontoDuracao);
            return (
              <li key={l.id}>
                <Cartao className="space-y-3 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      {l.rotulo ? <p className="font-medium">{l.rotulo}</p> : null}
                      <p className="break-all font-mono text-xs text-cinza-2">{url}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {l.ativo ? <Selo tom="verde">ativo</Selo> : <Selo tom="cinza">pausado</Selo>}
                      <CopiarBotao texto={url} rotulo="Copiar link" aviso="Link copiado" />
                    </div>
                  </div>
                  <p className="text-sm text-cinza-2">
                    Você ganha {descreverComissao(l.comissaoBps, l.vitalicia)}.
                    {desconto ? ` Quem entra pelo link tem ${desconto}.` : ""}
                    {l.ativo ? "" : " Este link está pausado e não recebe novos cadastros."}
                  </p>
                  <dl className="grid grid-cols-4 gap-3 text-sm">
                    <div>
                      <dt className="text-xs text-cinza-2">Cadastros</dt>
                      <dd className="tabular-nums">{l.cadastros}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-cinza-2">Assinantes</dt>
                      <dd className="tabular-nums">{l.assinantes}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-cinza-2">Ativos</dt>
                      <dd className="tabular-nums">{l.ativos}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-cinza-2">Ganhos</dt>
                      <dd className="tabular-nums">{formatarBRL(l.ganhosCentavos)}</dd>
                    </div>
                  </dl>
                </Cartao>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-3">
        <RotuloSecao>Últimas comissões</RotuloSecao>
        {painel.comissoes.length === 0 ? (
          <p className="text-sm text-cinza-2">
            Ainda não há comissões. Elas aparecem aqui quando um indicado faz um pagamento.
          </p>
        ) : (
          <ul className="divide-y divide-divisor rounded-[16px] border border-borda">
            {painel.comissoes.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div>
                  <p className="tabular-nums">{formatarBRL(c.valorCentavos)}</p>
                  <p className="text-xs text-cinza-2">
                    {data(c.em)} · /r/{c.linkCodigo}
                    {c.status === "pendente" ? ` · libera em ${data(c.disponivelEm)}` : ""}
                  </p>
                </div>
                <SeloComissao status={c.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <RotuloSecao>Seus saques</RotuloSecao>
        {painel.saques.length === 0 ? (
          <p className="text-sm text-cinza-2">Nenhum pedido de saque ainda.</p>
        ) : (
          <ul className="divide-y divide-divisor rounded-[16px] border border-borda">
            {painel.saques.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div>
                  <p className="tabular-nums">{formatarBRL(s.valorCentavos)}</p>
                  <p className="text-xs text-cinza-2">
                    {data(s.solicitadoEm)} · Pix {s.chaveMascarada}
                    {s.observacao ? ` · ${s.observacao}` : ""}
                  </p>
                </div>
                <SeloSaque status={s.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <ModalBase aberto={modal} onFechar={() => setModal(false)} titulo="Solicitar saque">
        <div className="space-y-4">
          <p className="text-sm text-cinza-2">
            Vamos pagar <strong className="text-tinta">{formatarBRL(saldo.disponivelCentavos)}</strong>{" "}
            por Pix para a chave abaixo. Confira com cuidado: o pagamento é manual e não dá para
            corrigir depois do envio.
          </p>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-cinza-2">Tipo da chave</span>
            <select
              className={SELECT}
              value={tipo}
              onChange={(e) => {
                setTipo(e.target.value as TipoChavePix);
                setErroChave(null);
              }}
            >
              {TIPOS_CHAVE_PIX.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.rotulo}
                </option>
              ))}
            </select>
          </label>
          <CampoTexto
            rotulo="Chave Pix"
            value={chave}
            placeholder={dicaChave}
            autoComplete="off"
            erro={erroChave ?? undefined}
            onChange={(e) => {
              setChave(e.target.value);
              setErroChave(null);
            }}
          />
          <div className="flex justify-end gap-2">
            <Botao variante="secundario" onClick={() => setModal(false)} disabled={pending}>
              Cancelar
            </Botao>
            <Botao onClick={enviarPedido} disabled={pending || !chave.trim()}>
              {pending ? "Enviando…" : "Pedir saque"}
            </Botao>
          </div>
        </div>
      </ModalBase>
    </div>
  );
}
