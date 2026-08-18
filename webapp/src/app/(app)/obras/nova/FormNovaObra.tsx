"use client";

import imageCompression from "browser-image-compression";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Botao,
  CampoData,
  CampoMoeda,
  CampoTexto,
  Cartao,
  RotuloSecao,
  useToast,
} from "@/components/ui";
import { ModalUpsellLimite } from "@/components/ui/ModalUpsellLimite";
import { createClient } from "@/lib/supabase/client";
import { ETAPAS_PADRAO } from "@/lib/obras/etapas";
import { criarObraAction, atualizarCapaObra } from "./actions";

type EtapaForm = { nome: string; peso: number };

const formatadorPeso = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2,
});

export function FormNovaObra() {
  const { toast } = useToast();
  const router = useRouter();
  const [carregando, setCarregando] = useState(false);
  const [nome, setNome] = useState("");
  const [endereco, setEndereco] = useState("");
  const [clienteNome, setClienteNome] = useState("");
  const [construtora, setConstrutora] = useState("");
  const [engenheiro, setEngenheiro] = useState("");
  const [escritorio, setEscritorio] = useState("");
  const [arquiteto, setArquiteto] = useState("");
  const [projEst, setProjEst] = useState("");
  const [projInst, setProjInst] = useState("");
  const [inicio, setInicio] = useState("");
  const [termino, setTermino] = useState("");
  const [valor, setValor] = useState(0);
  const [sinal, setSinal] = useState(0);
  const [capaFile, setCapaFile] = useState<File | null>(null);
  const [etapas, setEtapas] = useState<EtapaForm[]>(
    ETAPAS_PADRAO.map((n) => ({ nome: n, peso: 1 })),
  );
  const [novaEtapa, setNovaEtapa] = useState("");
  const [upsellLimite, setUpsellLimite] = useState(false);
  const pesoTotal = etapas.reduce((total, etapa) => total + etapa.peso, 0);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/entrar");
        return;
      }

      const result = await criarObraAction({
        nome,
        endereco,
        clienteNome,
        construtora: construtora || undefined,
        engenheiro: engenheiro || undefined,
        escritorioArquitetura: escritorio || undefined,
        arquiteto: arquiteto || undefined,
        projetistaEstruturas: projEst || undefined,
        projetistaInstalacoes: projInst || undefined,
        inicioContratual: inicio,
        terminoContratual: termino,
        valorContratadoCentavos: valor,
        sinalCentavos: sinal,
        etapas,
      });

      if (!result.ok) {
        if (result.erro === "LIMITE_OBRAS") {
          setUpsellLimite(true);
          return;
        }
        if (result.erro === "NAO_AUTENTICADO") {
          router.push("/entrar");
          return;
        }
        toast(result.erro);
        return;
      }

      if (capaFile) {
        const compressed = await imageCompression(capaFile, {
          maxWidthOrHeight: 1600,
          fileType: "image/webp",
          maxSizeMB: 1.5,
        });
        const path = `${result.obraId}/capa.webp`;
        const { error: upErr } = await supabase.storage
          .from("capas")
          .upload(path, compressed, {
            contentType: "image/webp",
            upsert: true,
          });
        if (!upErr) {
          await atualizarCapaObra(result.obraId, path);
        }
      }

      toast("Página de acompanhamento criada");
      router.push(`/obras/${result.obraId}`);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-8">
      <h1 className="font-serif text-3xl font-light">Nova obra</h1>

      <Cartao className="space-y-4 p-5">
        <RotuloSecao>1 · Informações</RotuloSecao>
        <CampoTexto rotulo="Nome da obra" required value={nome} onChange={(e) => setNome(e.target.value)} />
        <CampoTexto rotulo="Endereço" required value={endereco} onChange={(e) => setEndereco(e.target.value)} />
        <CampoTexto rotulo="Cliente" required value={clienteNome} onChange={(e) => setClienteNome(e.target.value)} />
        <CampoTexto rotulo="Construtora" value={construtora} onChange={(e) => setConstrutora(e.target.value)} />
        <CampoTexto rotulo="Engenheiro" value={engenheiro} onChange={(e) => setEngenheiro(e.target.value)} />
        <CampoTexto rotulo="Escritório de arquitetura" value={escritorio} onChange={(e) => setEscritorio(e.target.value)} />
        <CampoTexto rotulo="Arquiteto" value={arquiteto} onChange={(e) => setArquiteto(e.target.value)} />
        <CampoTexto rotulo="Projetista de estruturas" value={projEst} onChange={(e) => setProjEst(e.target.value)} />
        <CampoTexto rotulo="Projetista de instalações" value={projInst} onChange={(e) => setProjInst(e.target.value)} />
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-cinza-2">Foto de capa</span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setCapaFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </Cartao>

      <Cartao className="space-y-4 p-5">
        <RotuloSecao>2 · Prazos</RotuloSecao>
        <CampoData rotulo="Início contratual" required value={inicio} onChange={(e) => setInicio(e.target.value)} />
        <CampoData rotulo="Término contratual" required value={termino} onChange={(e) => setTermino(e.target.value)} />
        <p className="text-xs text-cinza-3">
          Dias aditivados são registrados pelos relatórios.
        </p>
      </Cartao>

      <Cartao className="space-y-4 p-5">
        <RotuloSecao>3 · Financeiro</RotuloSecao>
        <CampoMoeda rotulo="Valor contratado" valorCentavos={valor} onChangeCentavos={setValor} />
        <CampoMoeda rotulo="Sinal (R$)" valorCentavos={sinal} onChangeCentavos={setSinal} />
      </Cartao>

      <Cartao className="space-y-4 p-5">
        <div className="flex items-baseline justify-between gap-4">
          <RotuloSecao>4 · Etapas</RotuloSecao>
          <output
            aria-label={`${etapas.length} ${etapas.length === 1 ? "etapa adicionada" : "etapas adicionadas"}`}
            className="shrink-0 text-xs text-cinza-2"
          >
            <span className="mr-1 font-serif text-2xl leading-none text-tinta tabular-nums">
              {etapas.length}
            </span>
            {etapas.length === 1 ? "etapa adicionada" : "etapas adicionadas"}
          </output>
        </div>
        <ul className="space-y-2">
          {etapas.map((etapa, idx) => {
            const percentualPeso =
              pesoTotal > 0 ? (etapa.peso / pesoTotal) * 100 : 0;

            return (
              <li
                key={`${etapa.nome}-${idx}`}
                className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 py-1 sm:grid-cols-[1.5rem_minmax(0,1fr)_auto_auto_auto]"
              >
                <span className="row-span-2 text-xs text-cinza-3 sm:row-span-1">
                  {idx + 1}
                </span>
                <span className="min-w-0 text-sm">{etapa.nome}</span>
                <output
                  aria-label={`Peso relativo de ${etapa.nome}: ${formatadorPeso.format(etapa.peso)} de ${formatadorPeso.format(pesoTotal)}, equivalente a ${formatadorPeso.format(percentualPeso)}% da obra`}
                  className="col-start-2 row-start-2 flex items-baseline gap-1.5 text-xs tabular-nums sm:col-start-auto sm:row-start-auto sm:justify-end"
                  title="Participação desta etapa no peso total da obra"
                >
                  <span className="text-cinza-2">
                    {formatadorPeso.format(etapa.peso)}/
                    {formatadorPeso.format(pesoTotal)}
                  </span>
                  <span className="font-medium text-marca">
                    {formatadorPeso.format(percentualPeso)}%
                  </span>
                </output>
                <input
                  type="number"
                  min={0.01}
                  step="any"
                  title="peso na média do avanço geral"
                  value={etapa.peso}
                  onChange={(e) => {
                    const peso = Number(e.target.value);
                    setEtapas((prev) =>
                      prev.map((x, i) =>
                        i === idx ? { ...x, peso: peso > 0 ? peso : 1 } : x,
                      ),
                    );
                  }}
                  className="col-start-3 row-start-2 w-16 rounded-full border border-borda px-2 py-1 text-sm tabular-nums sm:col-start-auto sm:row-start-auto"
                  aria-label={`Peso de ${etapa.nome}`}
                />
                <button
                  type="button"
                  aria-label={`Remover ${etapa.nome}`}
                  className="col-start-3 row-start-1 text-cinza-2 sm:col-start-auto sm:row-start-auto"
                  onClick={() =>
                    setEtapas((prev) => prev.filter((_, i) => i !== idx))
                  }
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex gap-2">
          <input
            value={novaEtapa}
            onChange={(e) => setNovaEtapa(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (!novaEtapa.trim()) return;
                setEtapas((prev) => [...prev, { nome: novaEtapa.trim(), peso: 1 }]);
                setNovaEtapa("");
              }
            }}
            placeholder="Nova etapa"
            className="flex-1 rounded-full border border-borda px-4 py-2 text-sm"
          />
          <Botao
            type="button"
            variante="secundario"
            onClick={() => {
              if (!novaEtapa.trim()) return;
              setEtapas((prev) => [...prev, { nome: novaEtapa.trim(), peso: 1 }]);
              setNovaEtapa("");
            }}
          >
            +
          </Botao>
        </div>
      </Cartao>

      <Botao type="submit" disabled={carregando} className="w-full">
        {carregando ? "Criando…" : "Criar página de acompanhamento"}
      </Botao>

      <ModalUpsellLimite
        aberto={upsellLimite}
        onFechar={() => setUpsellLimite(false)}
      />
    </form>
  );
}
