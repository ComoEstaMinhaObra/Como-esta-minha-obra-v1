"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Avatar,
  Botao,
  CampoTexto,
  ModalBase,
  Selo,
  useToast,
} from "@/components/ui";
import { ModalUpsellLimite } from "@/components/ui/ModalUpsellLimite";
import { publicEnv } from "@/config/env";
import {
  liberarAcessoObra,
  listarAcessosObra,
  removerAcessoObra,
} from "./compartilhar-actions";

type Acesso = {
  id: string;
  email: string;
  status: "convidado" | "ativo";
  cobrado_extra: boolean;
};

export function ModalCompartilhar({
  obraId,
  aberto,
  onFechar,
}: {
  obraId: string;
  aberto: boolean;
  onFechar: () => void;
}) {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [acessos, setAcessos] = useState<Acesso[]>([]);
  const [upsell, setUpsell] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!aberto) return;
    startTransition(async () => {
      const r = await listarAcessosObra(obraId);
      if (r.ok) setAcessos(r.acessos as Acesso[]);
    });
  }, [aberto, obraId]);

  const link = `${publicEnv.NEXT_PUBLIC_APP_URL}/c/${obraId}`;

  async function liberar() {
    const r = await liberarAcessoObra(obraId, email);
    if (!r.ok) {
      if (r.erro === "EMAIL_DUPLICADO") {
        toast("Este e-mail já tem acesso");
        return;
      }
      if (r.erro === "PRECISA_ASSINAR") {
        setUpsell(true);
        return;
      }
      toast(r.erro);
      return;
    }
    toast("Acesso liberado");
    setEmail("");
    const lista = await listarAcessosObra(obraId);
    if (lista.ok) setAcessos(lista.acessos as Acesso[]);
  }

  async function remover(id: string) {
    const r = await removerAcessoObra(obraId, id);
    if (!r.ok) {
      toast(r.erro);
      return;
    }
    toast("Acesso removido");
    setAcessos((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <>
      <ModalBase
        aberto={aberto}
        onFechar={onFechar}
        titulo="Compartilhar"
        className="max-w-md"
      >
        <div className="space-y-5">
          <div className="flex gap-2">
            <div className="flex-1">
              <CampoTexto
                rotulo="E-mail do proprietário"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="cliente@email.com"
              />
            </div>
            <div className="flex items-end">
              <Botao onClick={liberar} disabled={pending || !email.trim()}>
                Liberar acesso
              </Botao>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.18em] text-cinza-2">
              Com acesso
            </p>
            {acessos.length === 0 ? (
              <p className="text-sm text-cinza-3">Nenhum e-mail liberado ainda.</p>
            ) : (
              <ul className="space-y-2">
                {acessos.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center gap-3 rounded-[16px] border border-borda px-3 py-2"
                  >
                    <Avatar nome={a.email} tamanho={32} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{a.email}</p>
                      <Selo tom={a.status === "ativo" ? "verde" : "ambar"}>
                        {a.status === "ativo"
                          ? "acesso ativo · já fez login"
                          : "convite enviado · aguardando login"}
                      </Selo>
                    </div>
                    <button
                      type="button"
                      aria-label={`Remover ${a.email}`}
                      className="text-cinza-2 text-sm"
                      onClick={() => remover(a.id)}
                    >
                      Remover
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2 border-t border-divisor pt-4">
            <p className="text-xs uppercase tracking-[0.18em] text-cinza-2">
              Link de visualização
            </p>
            <div className="flex gap-2">
              <code className="flex-1 truncate rounded-full border border-borda bg-white px-3 py-2 text-xs">
                {link}
              </code>
              <Botao
                variante="secundario"
                onClick={async () => {
                  await navigator.clipboard.writeText(link);
                  toast("Link copiado");
                }}
              >
                Copiar
              </Botao>
            </div>
            <p className="text-xs text-cinza-3">
              Só abre para e-mails com acesso liberado, após login.
            </p>
          </div>
        </div>
      </ModalBase>

      <ModalUpsellLimite
        aberto={upsell}
        onFechar={() => setUpsell(false)}
        titulo="E-mail extra"
        mensagem="No trial só o 1º e-mail é gratuito. Assine um plano para liberar e-mails adicionais."
      />
    </>
  );
}
