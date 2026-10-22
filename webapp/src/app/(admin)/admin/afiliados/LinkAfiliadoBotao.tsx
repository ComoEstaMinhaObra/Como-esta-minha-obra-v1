"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Botao, CampoTexto, ModalBase, useToast } from "@/components/ui";
import { publicEnv } from "@/config/env";
import {
  bpsParaPercentual,
  percentualParaBps,
  type DuracaoDesconto,
} from "@/lib/afiliados/formatar";
import type { LinkAdmin } from "@/lib/afiliados/tipos";
import { mensagemRpc } from "@/lib/rpc-erros";
import { atualizarLinkAction, buscarUsuarioAction, criarLinkAction } from "./actions";

const SELECT =
  "rounded-full border border-borda bg-white px-4 py-2.5 text-sm text-tinta outline-none focus:border-marca";

type Usuario = { id: string; nome: string; email: string };

/** Cria (sem `link`) ou edita (com `link`) um link de afiliado. Editar só vale para novos cadastros. */
export function LinkAfiliadoBotao({ link }: { link?: LinkAdmin }) {
  const edicao = Boolean(link);
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [aberto, setAberto] = useState(false);

  const [email, setEmail] = useState("");
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [codigo, setCodigo] = useState(link?.codigo ?? "");
  const [rotulo, setRotulo] = useState(link?.rotulo ?? "");
  const [comissao, setComissao] = useState(link ? bpsParaPercentual(link.comissaoBps) : "");
  const [vitalicia, setVitalicia] = useState(link?.vitalicia ?? true);
  const [desconto, setDesconto] = useState(
    link && link.descontoBps > 0 ? bpsParaPercentual(link.descontoBps) : "",
  );
  const [duracao, setDuracao] = useState<DuracaoDesconto>(
    link?.descontoDuracao ?? "primeira_fatura",
  );
  const [ativo, setAtivo] = useState(link?.ativo ?? true);

  const base = publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

  async function buscar() {
    setBuscando(true);
    try {
      const r = await buscarUsuarioAction(email);
      if (!r.ok) {
        toast(mensagemRpc(r.erro));
        return;
      }
      if (!r.encontrado) {
        setUsuario(null);
        toast("Nenhuma conta com esse e-mail.");
        return;
      }
      setUsuario({ id: r.id, nome: r.nome, email: r.email });
    } finally {
      setBuscando(false);
    }
  }

  function salvar() {
    const comissaoBps = percentualParaBps(comissao);
    if (comissaoBps === null) {
      toast("Informe a comissão em % (ex.: 20 ou 12,5).");
      return;
    }
    const descontoBps = desconto.trim() === "" ? 0 : percentualParaBps(desconto);
    if (descontoBps === null) {
      toast("Informe o desconto em % (ex.: 10) ou deixe em branco.");
      return;
    }
    const dados = {
      rotulo,
      comissaoBps,
      vitalicia,
      descontoBps,
      descontoDuracao: descontoBps > 0 ? duracao : null,
    };

    start(async () => {
      const r = link
        ? await atualizarLinkAction(link.id, dados, ativo)
        : usuario
          ? await criarLinkAction(usuario.id, { ...dados, codigo })
          : ({ ok: false, erro: "AFILIADO_NAO_ENCONTRADO" } as const);
      if (!r.ok) {
        toast(mensagemRpc(r.erro));
        return;
      }
      toast(link ? "Link atualizado." : "Link criado.");
      setAberto(false);
      router.refresh();
    });
  }

  return (
    <>
      <Botao
        variante={edicao ? "secundario" : "primario"}
        className={edicao ? "!px-3 !py-1 text-xs" : undefined}
        onClick={() => setAberto(true)}
      >
        {edicao ? "Editar" : "Novo link"}
      </Botao>
      <ModalBase
        aberto={aberto}
        onFechar={() => setAberto(false)}
        titulo={edicao ? `Editar ${link?.codigo}` : "Novo link de afiliado"}
      >
        <div className="space-y-4">
          {edicao ? (
            <p className="text-sm text-cinza-2">
              Afiliado: <strong className="text-tinta">{link?.afiliadoNome || "—"}</strong>
              {link?.afiliadoEmail ? ` · ${link.afiliadoEmail}` : ""}. As mudanças valem para
              novos cadastros; quem já se cadastrou mantém os termos de quando entrou.
            </p>
          ) : (
            <div className="space-y-2">
              <div className="flex items-end gap-2">
                <CampoTexto
                  className="flex-1"
                  rotulo="E-mail da conta do afiliado"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setUsuario(null);
                  }}
                />
                <Botao
                  variante="secundario"
                  disabled={buscando || !email.trim()}
                  onClick={buscar}
                >
                  {buscando ? "…" : "Buscar"}
                </Botao>
              </div>
              {usuario ? (
                <p className="text-sm text-sucesso">
                  {usuario.nome || "Sem nome"} · {usuario.email}
                </p>
              ) : (
                <p className="text-xs text-cinza-3">
                  O afiliado precisa já ter criado uma conta no sistema.
                </p>
              )}
            </div>
          )}

          {!edicao ? (
            <div className="space-y-1">
              <CampoTexto
                rotulo="Código do link"
                value={codigo}
                maxLength={32}
                placeholder="ex.: joao-silva"
                onChange={(e) => setCodigo(e.target.value.toLowerCase())}
              />
              <p className="break-all text-xs text-cinza-3">
                {base}/r/{codigo || "codigo"}
              </p>
            </div>
          ) : null}

          <CampoTexto
            rotulo="Identificação interna (opcional)"
            value={rotulo}
            maxLength={80}
            placeholder="ex.: Instagram do João"
            onChange={(e) => setRotulo(e.target.value)}
          />

          <div className="grid gap-4 min-[500px]:grid-cols-2">
            <CampoTexto
              rotulo="Comissão (%)"
              inputMode="decimal"
              value={comissao}
              placeholder="20"
              onChange={(e) => setComissao(e.target.value)}
            />
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-cinza-2">Comissão vale para</span>
              <select
                className={SELECT}
                value={vitalicia ? "vitalicia" : "primeira"}
                onChange={(e) => setVitalicia(e.target.value === "vitalicia")}
              >
                <option value="vitalicia">Todos os pagamentos (vitalícia)</option>
                <option value="primeira">Só a primeira fatura</option>
              </select>
            </label>
          </div>

          <div className="grid gap-4 min-[500px]:grid-cols-2">
            <CampoTexto
              rotulo="Desconto ao indicado (%)"
              inputMode="decimal"
              value={desconto}
              placeholder="Sem desconto"
              onChange={(e) => setDesconto(e.target.value)}
            />
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-cinza-2">Desconto vale para</span>
              <select
                className={SELECT}
                value={duracao}
                onChange={(e) => setDuracao(e.target.value as DuracaoDesconto)}
                disabled={desconto.trim() === "" || desconto.trim() === "0"}
              >
                <option value="primeira_fatura">Só a primeira fatura</option>
                <option value="permanente">Todas as faturas</option>
              </select>
            </label>
          </div>

          {edicao ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={ativo}
                onChange={(e) => setAtivo(e.target.checked)}
              />
              Link ativo (desmarcar bloqueia novos cadastros; quem já entrou continua rendendo)
            </label>
          ) : null}

          <div className="flex justify-end gap-2">
            <Botao variante="secundario" onClick={() => setAberto(false)} disabled={pending}>
              Cancelar
            </Botao>
            <Botao onClick={salvar} disabled={pending || (!edicao && (!usuario || !codigo))}>
              {pending ? "Salvando…" : "Salvar"}
            </Botao>
          </div>
        </div>
      </ModalBase>
    </>
  );
}
