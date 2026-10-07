"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Botao, Cartao, ModalBase, Selo, useToast } from "@/components/ui";
import type { LinhaCobranca, ResumoCobranca } from "@/lib/cobranca/estado";
import { DIAS_RECUPERACAO } from "@/lib/cobranca/constantes";
import { formatarBRL } from "@/lib/formatacao";
import {
  cancelarCobrancas,
  contratarObra,
  regularizarPagamento,
  type ErroContratar,
  type ErroRegularizar,
} from "./actions";

function dataBr(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
}

const MENSAGEM_ERRO: Record<ErroContratar, string> = {
  NAO_AUTENTICADO: "Sua sessão expirou. Entre novamente.",
  RATE_LIMITED: "Muitas tentativas. Aguarde alguns minutos.",
  SEM_PERMISSAO: "Você não tem permissão para esta obra.",
  OBRA_ARQUIVADA: "Esta obra está arquivada.",
  JA_CONTRATADA: "Esta obra já tem cobrança ativa.",
  REATIVAR_APOS: "Esta obra mantém os recursos até o fim do período já pago; depois você pode contratar de novo.",
  PRODUTO_NAO_CONFIGURADO: "A cobrança ainda não está disponível. Tente novamente mais tarde.",
  FALHA_CLIENTE: "Não foi possível abrir o pagamento agora. Tente novamente em alguns minutos.",
  FALHA_CHECKOUT: "Não foi possível abrir o pagamento agora. Tente novamente em alguns minutos.",
};

const MENSAGEM_ERRO_REGULARIZAR: Partial<Record<ErroRegularizar, string>> = {
  COBRANCA_NAO_REGULARIZAVEL: "Esta obra não tem pagamento pendente para regularizar.",
  FALHA_PROVEDOR:
    "Não foi possível encerrar a cobrança com falha agora. Nada foi alterado; tente novamente em alguns minutos.",
  FALHA_CONCLUIR:
    "A cobrança com falha foi encerrada, mas não conseguimos abrir o novo pagamento. Use “Reativar” nesta obra para pagar.",
};

const SELO: Record<LinhaCobranca["estado"], { texto: string; tom: "ambar" | "verde" | "cinza" | "preto" }> = {
  sem_assinatura: { texto: "Sem assinatura", tom: "cinza" },
  ativa: { texto: "Ativa", tom: "verde" },
  inadimplente: { texto: "Pagamento pendente", tom: "ambar" },
  cancelamento_agendado: { texto: "Cancelada", tom: "cinza" },
  cancelada: { texto: "Somente leitura", tom: "cinza" },
};

export function CobrancaCliente({
  resumo,
  precoObraCentavos,
  precoEmailCentavos,
  vagaPaga,
  sucesso,
  obraDestaque,
}: {
  resumo: ResumoCobranca;
  precoObraCentavos: number;
  precoEmailCentavos: number;
  vagaPaga: { acessoAte: Date; dias: number } | null;
  sucesso: boolean;
  obraDestaque: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [contratando, setContratando] = useState<LinhaCobranca | null>(null);
  const [regularizando, setRegularizando] = useState<LinhaCobranca | null>(null);
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [confirmandoCancelamento, setConfirmandoCancelamento] = useState(false);

  // Depois do pagamento o webhook ativa a obra em instantes: atualiza a tela algumas vezes.
  const aguardando =
    sucesso &&
    resumo.linhas.some(
      (l) => l.obraId === obraDestaque && l.estado === "sem_assinatura",
    );
  useEffect(() => {
    if (!aguardando) return;
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      router.refresh();
      if (n >= 8) clearInterval(id);
    }, 3000);
    return () => clearInterval(id);
  }, [aguardando, router]);

  const cancelaveis = resumo.linhas.filter((l) => l.acoes.cancelar);
  const selecionadasLinhas = cancelaveis.filter((l) => selecionadas.includes(l.obraId));

  function alternar(obraId: string) {
    setSelecionadas((s) => (s.includes(obraId) ? s.filter((x) => x !== obraId) : [...s, obraId]));
  }

  function confirmarContratacao() {
    if (!contratando) return;
    const obraId = contratando.obraId;
    setErro(null);
    startTransition(async () => {
      const r = await contratarObra(obraId);
      // Em sucesso a ação redireciona para o checkout e não retorna.
      if (r && !r.ok) {
        setContratando(null);
        setErro(MENSAGEM_ERRO[r.erro as ErroContratar] ?? MENSAGEM_ERRO.FALHA_CHECKOUT);
      }
    });
  }

  function confirmarRegularizacao() {
    if (!regularizando) return;
    const obraId = regularizando.obraId;
    setErro(null);
    startTransition(async () => {
      const r = await regularizarPagamento(obraId);
      // Em sucesso a ação redireciona para o novo checkout e não retorna.
      if (r && !r.ok) {
        setRegularizando(null);
        const codigo = r.erro as ErroRegularizar;
        setErro(
          MENSAGEM_ERRO_REGULARIZAR[codigo] ??
            MENSAGEM_ERRO[codigo as ErroContratar] ??
            MENSAGEM_ERRO.FALHA_CHECKOUT,
        );
        router.refresh();
      }
    });
  }

  function confirmarCancelamento() {
    const ids = selecionadasLinhas.map((l) => l.obraId);
    setErro(null);
    setAviso(null);
    startTransition(async () => {
      const r = await cancelarCobrancas(ids);
      setConfirmandoCancelamento(false);
      if (!r.ok) {
        setErro("Não foi possível cancelar agora. Tente novamente.");
        return;
      }
      const ok = r.resultados.filter((x) => x.ok);
      const falhas = r.resultados.filter((x) => !x.ok);
      if (ok.length > 0) {
        toast(
          ok.length > 1
            ? `${ok.length} cobranças canceladas. A alteração aparece na sua cobrança.`
            : "Cobrança cancelada. A alteração aparece na sua cobrança.",
        );
        setAviso(
          "As obras canceladas mantêm todos os recursos até o fim do período já pago e depois ficam somente leitura. Não há devolução proporcional.",
        );
      }
      if (falhas.length > 0) {
        setErro(
          `Não foi possível cancelar ${falhas.length} obra${falhas.length > 1 ? "s" : ""}. Tente novamente em alguns minutos.`,
        );
      }
      setSelecionadas([]);
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="font-serif text-3xl font-light">Cobrança</h1>
        <p className="text-sm text-cinza-2">
          Cada obra tem a sua própria assinatura de {formatarBRL(precoObraCentavos)} por
          mês, com data de cobrança própria. Você cancela só as obras que quiser.
        </p>
      </header>

      {resumo.trial && (
        <div className="rounded-[16px] border border-marca/30 bg-marca/10 px-4 py-3 text-sm">
          <strong className="font-medium">
            Trial · {resumo.trial.diasRestantes} dia(s) restantes
          </strong>
          <span className="text-cinza-2">
            {" "}
            · {resumo.trial.relatoriosUsados} de 1 relatório incluído usado
          </span>
        </div>
      )}

      {sucesso && (
        <div className="rounded-[16px] border border-sucesso/30 bg-sucesso/10 px-4 py-3 text-sm text-sucesso">
          {aguardando
            ? "Pagamento recebido. Estamos ativando a cobrança da obra; isso leva alguns segundos…"
            : "Pagamento confirmado."}
        </div>
      )}
      {aviso && (
        <div className="rounded-[16px] border border-sucesso/30 bg-sucesso/10 px-4 py-3 text-sm text-sucesso">
          {aviso}
        </div>
      )}
      {erro && (
        <div role="alert" className="rounded-[16px] border border-marca/40 bg-marca/10 px-4 py-3 text-sm">
          {erro}
        </div>
      )}

      <Cartao className="flex flex-wrap items-end justify-between gap-4 p-5">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-cinza-2">Total mensal</p>
          <p className="mt-1 font-serif text-3xl font-light">
            {formatarBRL(resumo.totalMensalCentavos)}
            <span className="text-sm text-cinza-2">/mês</span>
          </p>
        </div>
        <p className="text-sm text-cinza-2">
          {resumo.proximaCobranca
            ? `Próxima cobrança em ${dataBr(resumo.proximaCobranca)}`
            : "Nenhuma cobrança agendada"}
        </p>
      </Cartao>

      {resumo.linhas.length === 0 ? (
        <Cartao className="p-6 text-sm text-cinza-2">
          Você ainda não tem obras.{" "}
          <Link href="/obras/nova" className="underline">
            Criar uma obra
          </Link>
          .
        </Cartao>
      ) : (
        <ul className="space-y-3">
          {resumo.linhas.map((l) => (
            <li key={l.obraId}>
              <LinhaObra
                l={l}
                preco={precoObraCentavos}
                destaque={l.obraId === obraDestaque}
                selecionada={selecionadas.includes(l.obraId)}
                onAlternar={() => alternar(l.obraId)}
                onContratar={() => setContratando(l)}
                onRegularizar={() => setRegularizando(l)}
                pending={pending}
              />
            </li>
          ))}
        </ul>
      )}

      {selecionadasLinhas.length > 0 && (
        <div className="sticky bottom-4 flex items-center justify-between gap-3 rounded-[16px] border border-borda bg-fundo px-4 py-3 shadow-sm">
          <span className="text-sm">
            {selecionadasLinhas.length} obra{selecionadasLinhas.length > 1 ? "s" : ""} selecionada
            {selecionadasLinhas.length > 1 ? "s" : ""}
          </span>
          <Botao variante="terciario" onClick={() => setConfirmandoCancelamento(true)} disabled={pending}>
            Cancelar cobrança
          </Botao>
        </div>
      )}

      <p className="text-sm text-cinza-2">
        Cada obra inclui um e-mail sem custo. Acessos adicionais custam{" "}
        {formatarBRL(precoEmailCentavos)} a cada 30 dias, cobrados na fatura da obra.
      </p>

      <ModalBase
        aberto={!!contratando}
        onFechar={() => setContratando(null)}
        titulo="Contratar cobrança da obra"
      >
        {contratando && (
          <div className="space-y-4 text-sm">
            <dl className="space-y-1">
              <div className="flex justify-between gap-4">
                <dt className="text-cinza-2">Item</dt>
                <dd>Obra ativa — {contratando.nome}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-cinza-2">Valor</dt>
                <dd>{formatarBRL(precoObraCentavos)} por mês</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-cinza-2">Cobrança</dt>
                <dd>
                  {vagaPaga
                    ? `primeira em ${dataBr(vagaPaga.acessoAte)}`
                    : "hoje, renovando todo mês"}
                </dd>
              </div>
            </dl>
            {vagaPaga ? (
              <p className="text-cinza-2">
                Você arquivou uma obra e ainda tem período pago até {dataBr(vagaPaga.acessoAte)}. Esta
                obra aproveita esse período: hoje o pagamento é de R$ 0,00 (só para guardar o cartão) e
                a primeira cobrança acontece nessa data.
              </p>
            ) : (
              <p className="text-cinza-2">
                Você será levado ao pagamento seguro com cartão. Cada obra tem o seu próprio pagamento
                e a sua data de cobrança.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Botao variante="secundario" onClick={() => setContratando(null)} disabled={pending}>
                Voltar
              </Botao>
              <Botao onClick={confirmarContratacao} disabled={pending}>
                {pending ? "Abrindo pagamento…" : "Ir para o pagamento"}
              </Botao>
            </div>
          </div>
        )}
      </ModalBase>

      <ModalBase
        aberto={!!regularizando}
        onFechar={() => setRegularizando(null)}
        titulo="Regularizar pagamento"
      >
        {regularizando && (
          <div className="space-y-4 text-sm">
            <p>
              <strong className="font-medium">{regularizando.nome}</strong> está com o pagamento pendente
              desde {dataBr(regularizando.inadimplenteDesde)}.
            </p>
            <p className="text-cinza-2">
              Não dá para trocar o cartão de uma assinatura em andamento. Vamos encerrar a cobrança que
              falhou (sem novas tentativas) e levar você a um novo pagamento de{" "}
              {formatarBRL(precoObraCentavos)} por mês, com a data de cobrança contando de hoje.
            </p>
            <p className="text-cinza-2">
              Se você não concluir o novo pagamento, a obra continua somente leitura e você pode pagar
              depois em “Reativar”.
            </p>
            <div className="flex flex-wrap gap-2">
              <Botao variante="secundario" onClick={() => setRegularizando(null)} disabled={pending}>
                Voltar
              </Botao>
              <Botao onClick={confirmarRegularizacao} disabled={pending}>
                {pending ? "Abrindo pagamento…" : "Continuar para o pagamento"}
              </Botao>
            </div>
          </div>
        )}
      </ModalBase>

      <ModalBase
        aberto={confirmandoCancelamento}
        onFechar={() => setConfirmandoCancelamento(false)}
        titulo="Cancelar cobrança"
      >
        <div className="space-y-4 text-sm">
          <ul className="space-y-2">
            {selecionadasLinhas.map((l) => (
              <li key={l.obraId} className="flex justify-between gap-4">
                <span>{l.nome}</span>
                <span className="text-cinza-2">
                  {formatarBRL(l.valorCentavos ?? precoObraCentavos)}/mês · mantém tudo até{" "}
                  {dataBr(l.proximaCobranca)}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-cinza-2">
            Essas obras deixam de ser cobradas a partir das datas acima e passam a somente leitura
            depois delas. Não há devolução proporcional. As demais obras não são afetadas.
          </p>
          <div className="flex flex-wrap gap-2">
            <Botao variante="secundario" onClick={() => setConfirmandoCancelamento(false)} disabled={pending}>
              Voltar
            </Botao>
            <Botao onClick={confirmarCancelamento} disabled={pending}>
              {pending ? "Cancelando…" : "Confirmar cancelamento"}
            </Botao>
          </div>
        </div>
      </ModalBase>
    </div>
  );
}

function LinhaObra({
  l,
  preco,
  destaque,
  selecionada,
  onAlternar,
  onContratar,
  onRegularizar,
  pending,
}: {
  l: LinhaCobranca;
  preco: number;
  destaque: boolean;
  selecionada: boolean;
  onAlternar: () => void;
  onContratar: () => void;
  onRegularizar: () => void;
  pending: boolean;
}) {
  const selo = SELO[l.estado];
  return (
    <Cartao className={`flex flex-wrap items-start justify-between gap-4 p-5 ${destaque ? "ring-2 ring-marca" : ""}`}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {l.acoes.cancelar ? (
          <input
            type="checkbox"
            checked={selecionada}
            onChange={onAlternar}
            aria-label={`Selecionar ${l.nome} para cancelar a cobrança`}
            className="mt-1 h-4 w-4 accent-[var(--marca)]"
          />
        ) : null}
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/obras/${l.obraId}`} className="font-serif text-lg font-light hover:underline">
              {l.nome}
            </Link>
            <Selo tom={selo.tom}>{selo.texto}</Selo>
            {l.arquivada && <Selo tom="cinza">Arquivada</Selo>}
          </div>
          <p className="text-sm text-cinza-2">{descricao(l, preco)}</p>
        </div>
      </div>

      <div className="flex flex-col items-end gap-2">
        {l.acoes.contratar && (
          <Botao onClick={onContratar} disabled={pending}>
            Assinar esta obra
          </Botao>
        )}
        {l.acoes.regularizar && (
          <Botao onClick={onRegularizar} disabled={pending}>
            Regularizar pagamento
          </Botao>
        )}
        {l.acoes.reativar && (
          <Botao variante="secundario" onClick={onContratar} disabled={pending}>
            Reativar
          </Botao>
        )}
        {l.estado === "cancelamento_agendado" && l.acoes.reativarApos && (
          <p className="max-w-[220px] text-right text-xs text-cinza-2">
            Você poderá contratar de novo depois de {dataBr(l.acoes.reativarApos)}.
          </p>
        )}
      </div>
    </Cartao>
  );
}

function descricao(l: LinhaCobranca, preco: number): string {
  switch (l.estado) {
    case "ativa":
      return l.primeiraCobrancaAdiada
        ? `Primeira cobrança de ${formatarBRL(l.valorCentavos ?? preco)} em ${dataBr(l.proximaCobranca)}, depois todo mês.`
        : `${formatarBRL(l.valorCentavos ?? preco)}/mês · próxima cobrança em ${dataBr(l.proximaCobranca)}.`;
    case "inadimplente":
      return `Pagamento pendente desde ${dataBr(l.inadimplenteDesde)}. Esta obra está somente leitura; o AbacatePay tenta cobrar de novo e, se não for pago até ${dataBr(l.limiteRecuperacao)} (${DIAS_RECUPERACAO} dias), a assinatura da obra é cancelada. Para pagar agora com outro cartão, use “Regularizar pagamento”.`;
    case "cancelamento_agendado":
      return `Cobrança cancelada. Você mantém tudo até ${dataBr(l.acessoAte)}; depois a obra fica somente leitura.`;
    case "cancelada":
      return "Somente leitura: suas informações continuam disponíveis para consulta. Contrate de novo para voltar a editar e enviar relatórios.";
    default:
      if (l.emTrialAte) return `Em trial até ${dataBr(l.emTrialAte)}. Assine para continuar depois disso.`;
      return `Sem assinatura: somente leitura. ${formatarBRL(preco)}/mês para editar e enviar relatórios.`;
  }
}
