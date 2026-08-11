"use client";

import {
  Acordeao,
  AcordeaoItem,
  BarraProgresso,
  useAcordeao,
} from "@/components/ui";
import { formatarBRL, formatarBRLCompacto } from "@/lib/formatacao";
import { formatarDataBr } from "@/lib/datas";
import { rotuloMotivoAditivo } from "@/lib/obras/motivos-aditivo";

const IDS = [
  "dados",
  "arquitetos",
  "projetistas",
  "prazos",
  "dias-aditivados",
  "avanco-fisico",
  "avanco-financeiro",
  "aditivos",
  "medicoes",
  "materiais",
];

function BotaoAbrirFechar() {
  const { aberto, abrirTodos, fecharTodos } = useAcordeao();
  const algum = aberto.size > 0;
  return (
    <button
      type="button"
      onClick={() => (algum ? fecharTodos() : abrirTodos())}
      className="text-xs text-marca"
    >
      {algum ? "Fechar tudo" : "Abrir tudo"}
    </button>
  );
}

export function InformacoesAcordeao({
  obra,
  etapas,
  lancamentos,
  diasAditivados,
  agregados,
}: {
  obra: {
    nome: string;
    endereco: string;
    construtora: string | null;
    engenheiro: string | null;
    escritorioArquitetura: string | null;
    arquiteto: string | null;
    projetistaEstruturas: string | null;
    projetistaInstalacoes: string | null;
    inicioContratual: string;
    terminoContratual: string;
    valorContratadoCentavos: number;
  };
  etapas: { nome: string; pctAtual: number }[];
  lancamentos: {
    tipo: string;
    grupo: string;
    rotulo: string;
    valorCentavos: number;
  }[];
  diasAditivados: { motivo: string; descricao: string | null; dias: number }[];
  agregados: {
    avancoGeral: number;
    pctPago: number;
    contratadoTotalCentavos: number;
    pagoAcumuladoCentavos: number;
    saldoCentavos: number;
    aditivosAcumuladoCentavos: number;
    entregaPrevista: string;
    diasDeObra: number;
    diasRestantes: number;
    totalDiasAditivados: number;
  };
}) {
  const aditivos = lancamentos.filter((l) => l.tipo === "aditivo");
  const medicoes = lancamentos.filter(
    (l) =>
      l.grupo === "medicoes" ||
      l.tipo === "sinal" ||
      (l.tipo === "estorno" && l.grupo === "medicoes"),
  );
  const materiais = lancamentos.filter(
    (l) =>
      l.grupo === "materiais" ||
      l.tipo === "material" ||
      (l.tipo === "estorno" && l.grupo === "materiais"),
  );

  const pctAditivos =
    obra.valorContratadoCentavos > 0
      ? Math.round(
          (agregados.aditivosAcumuladoCentavos /
            obra.valorContratadoCentavos) *
            100,
        )
      : 0;

  const diasPorMotivo = new Map<string, number>();
  for (const d of diasAditivados) {
    diasPorMotivo.set(d.motivo, (diasPorMotivo.get(d.motivo) ?? 0) + d.dias);
  }

  return (
    <Acordeao ids={IDS} className="rounded-[20px] border border-borda bg-cartao px-4">
      <div className="flex justify-end border-b border-divisor py-2">
        <BotaoAbrirFechar />
      </div>

      <AcordeaoItem id="dados" titulo="Dados do projeto">
        <Linha label="Obra" valor={obra.nome} />
        <Linha label="Endereço" valor={obra.endereco} />
        {obra.construtora ? (
          <Linha label="Construtora" valor={obra.construtora} />
        ) : null}
        {obra.engenheiro ? (
          <Linha label="Engenheiro" valor={obra.engenheiro} />
        ) : null}
        <AcordeaoItem id="arquitetos" titulo="Arquitetos" nivel={2}>
          {obra.escritorioArquitetura ? (
            <Linha label="Escritório" valor={obra.escritorioArquitetura} />
          ) : null}
          {obra.arquiteto ? (
            <Linha label="Arquiteto" valor={obra.arquiteto} />
          ) : null}
          {!obra.escritorioArquitetura && !obra.arquiteto ? (
            <p className="text-cinza-2">Não informado</p>
          ) : null}
        </AcordeaoItem>
        <AcordeaoItem id="projetistas" titulo="Projetistas" nivel={2}>
          {obra.projetistaEstruturas ? (
            <Linha label="Estruturas" valor={obra.projetistaEstruturas} />
          ) : null}
          {obra.projetistaInstalacoes ? (
            <Linha label="Instalações" valor={obra.projetistaInstalacoes} />
          ) : null}
          {!obra.projetistaEstruturas && !obra.projetistaInstalacoes ? (
            <p className="text-cinza-2">Não informado</p>
          ) : null}
        </AcordeaoItem>
      </AcordeaoItem>

      <AcordeaoItem
        id="prazos"
        titulo="Prazos"
        resumo={`${agregados.diasRestantes} dias restantes`}
      >
        <Linha
          label="Início contratual"
          valor={formatarDataBr(obra.inicioContratual)}
        />
        <Linha
          label="Término contratual"
          valor={formatarDataBr(obra.terminoContratual)}
        />
        <AcordeaoItem id="dias-aditivados" titulo="Dias aditivados" nivel={2}>
          {diasPorMotivo.size === 0 ? (
            <p className="text-cinza-2">Nenhum dia aditivado</p>
          ) : (
            [...diasPorMotivo.entries()].map(([motivo, dias]) => (
              <Linha
                key={motivo}
                label={rotuloMotivoAditivo(motivo)}
                valor={`${dias} dias`}
              />
            ))
          )}
        </AcordeaoItem>
        <Linha
          label="Término previsto"
          valor={formatarDataBr(agregados.entregaPrevista)}
          destaque
        />
        <Linha label="Dias de obra" valor={String(agregados.diasDeObra)} />
        <Linha
          label="Dias restantes"
          valor={String(agregados.diasRestantes)}
        />
      </AcordeaoItem>

      <AcordeaoItem
        id="avanco-fisico"
        titulo="Avanço físico"
        resumo={`${agregados.avancoGeral}%`}
      >
        <ul className="space-y-3">
          {etapas.map((e) => (
            <li key={e.nome} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate">{e.nome}</span>
                <span
                  className={
                    e.pctAtual === 100
                      ? "text-tinta"
                      : e.pctAtual > 0
                        ? "text-marca"
                        : "text-cinza-2"
                  }
                >
                  {e.pctAtual}%
                </span>
              </div>
              <BarraProgresso pct={e.pctAtual} />
            </li>
          ))}
        </ul>
      </AcordeaoItem>

      <AcordeaoItem
        id="avanco-financeiro"
        titulo="Avanço financeiro"
        resumo={`${formatarBRLCompacto(agregados.pagoAcumuladoCentavos)} · ${agregados.pctPago}%`}
      >
        <Linha
          label="Contratado"
          valor={formatarBRL(obra.valorContratadoCentavos)}
        />
        <AcordeaoItem
          id="aditivos"
          titulo="Aditivos"
          nivel={2}
          resumo={`${pctAditivos}%`}
        >
          {aditivos.length === 0 ? (
            <p className="text-cinza-2">Nenhum aditivo</p>
          ) : (
            aditivos.map((l, i) => (
              <Linha
                key={`${l.rotulo}-${i}`}
                label={l.rotulo}
                valor={formatarBRL(l.valorCentavos)}
              />
            ))
          )}
        </AcordeaoItem>
        <Linha
          label="Contratado total"
          valor={formatarBRL(agregados.contratadoTotalCentavos)}
          destaque
        />
        <AcordeaoItem id="medicoes" titulo="Pago em medições" nivel={2}>
          {medicoes.length === 0 ? (
            <p className="text-cinza-2">Nenhuma medição</p>
          ) : (
            medicoes.map((l, i) => (
              <Linha
                key={`${l.rotulo}-${i}`}
                label={l.rotulo}
                valor={formatarBRL(l.valorCentavos)}
              />
            ))
          )}
        </AcordeaoItem>
        <AcordeaoItem id="materiais" titulo="Pago em materiais" nivel={2}>
          {materiais.length === 0 ? (
            <p className="text-cinza-2">Nenhum material</p>
          ) : (
            materiais.map((l, i) => (
              <Linha
                key={`${l.rotulo}-${i}`}
                label={l.rotulo}
                valor={formatarBRL(l.valorCentavos)}
              />
            ))
          )}
        </AcordeaoItem>
        <Linha
          label="Pago total"
          valor={formatarBRL(agregados.pagoAcumuladoCentavos)}
          destaque
        />
        <Linha
          label="Saldo a pagar"
          valor={formatarBRL(agregados.saldoCentavos)}
          destaque
        />
      </AcordeaoItem>
    </Acordeao>
  );
}

function Linha({
  label,
  valor,
  destaque = false,
}: {
  label: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div
      className={`flex items-start justify-between gap-3 py-1.5 text-sm ${
        destaque ? "font-medium text-tinta" : "text-tinta"
      }`}
    >
      <span className="text-cinza-2">{label}</span>
      <span className="text-right">{valor}</span>
    </div>
  );
}
