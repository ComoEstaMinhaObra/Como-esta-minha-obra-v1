"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import imageCompression from "browser-image-compression";
import { useRouter } from "next/navigation";
import { useRef, useState, type CSSProperties } from "react";
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
import {
  pesoDigitadoParaNumero,
  pesoParaCentesimos,
  sanitizarPesoDigitado,
  validarEtapasSelecionadas,
} from "@/lib/obras/pesos-etapas";
import { createClient } from "@/lib/supabase/client";
import { ETAPAS_PADRAO } from "@/lib/obras/etapas";
import { criarObraAction, atualizarCapaObra } from "./actions";

type EtapaForm = {
  id: string;
  nome: string;
  peso: string;
  selecionada: boolean;
};

const formatadorPeso = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2,
});

type LinhaEtapaProps = {
  etapa: EtapaForm;
  indice: number;
  onPesoChange: (peso: string) => void;
  onSelecionadaChange: (selecionada: boolean) => void;
};

function LinhaEtapa({
  etapa,
  indice,
  onPesoChange,
  onSelecionadaChange,
}: LinhaEtapaProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: etapa.id });
  const peso = pesoDigitadoParaNumero(etapa.peso);
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`grid grid-cols-[1.5rem_1.25rem_minmax(0,1fr)_1.5rem] items-center gap-x-2 gap-y-1 rounded-xl py-1.5 transition-shadow sm:grid-cols-[1.5rem_1.25rem_minmax(0,1fr)_5.5rem_1.5rem] ${
        isDragging ? "z-10 bg-white px-2 shadow-lg" : ""
      }`}
    >
      <button
        type="button"
        className="row-span-2 flex h-8 w-6 touch-none items-center justify-center text-cinza-3 hover:text-tinta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca sm:row-span-1"
        aria-label={`Mover ${etapa.nome}`}
        title="Arraste para reordenar"
        {...attributes}
        {...listeners}
      >
        <svg aria-hidden="true" viewBox="0 0 18 14" className="h-4 w-4">
          <path
            d="M1 2h16M1 7h16M1 12h16"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
          />
        </svg>
      </button>
      <span className="row-span-2 text-xs tabular-nums text-cinza-3 sm:row-span-1">
        {indice + 1}
      </span>
      <span
        className={`min-w-0 truncate text-sm ${
          etapa.selecionada ? "text-tinta" : "text-cinza-2"
        }`}
        title={etapa.nome}
      >
        {etapa.nome}
      </span>
      <label className="relative col-start-3 row-start-2 block w-[5.5rem] sm:col-start-auto sm:row-start-auto">
        <span className="sr-only">Peso de {etapa.nome} em porcentagem</span>
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={etapa.peso}
          onChange={(e) => onPesoChange(sanitizarPesoDigitado(e.target.value))}
          onBlur={() => {
            if (!etapa.peso) onPesoChange("0");
          }}
          aria-invalid={etapa.selecionada && peso <= 0}
          className="w-full rounded-full border border-borda bg-white py-1.5 pr-7 pl-2.5 text-right text-sm tabular-nums outline-none transition focus:border-marca focus:ring-2 focus:ring-marca/15 aria-[invalid=true]:border-marca"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-cinza-2"
        >
          %
        </span>
      </label>
      <label className="col-start-4 row-start-1 row-span-2 flex h-8 items-center justify-center sm:col-start-auto sm:row-start-auto sm:row-span-1">
        <span className="sr-only">
          {etapa.selecionada ? "Remover" : "Adicionar"} {etapa.nome} do escopo
        </span>
        <input
          type="checkbox"
          checked={etapa.selecionada}
          onChange={(e) => onSelecionadaChange(e.target.checked)}
          className="h-4 w-4 accent-marca"
        />
      </label>
    </li>
  );
}

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
  const [etapas, setEtapas] = useState<EtapaForm[]>(() =>
    ETAPAS_PADRAO.map((nome, indice) => ({
      id: `padrao-${indice}`,
      nome,
      peso: "0",
      selecionada: false,
    })),
  );
  const [novaEtapa, setNovaEtapa] = useState("");
  const [upsellLimite, setUpsellLimite] = useState(false);
  const proximoIdPersonalizado = useRef(0);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const etapasSelecionadas = etapas
    .filter((etapa) => etapa.selecionada)
    .map((etapa) => ({
      nome: etapa.nome,
      peso: pesoDigitadoParaNumero(etapa.peso),
    }));
  const pesoTotalCentavos = etapasSelecionadas.reduce(
    (total, etapa) => total + pesoParaCentesimos(etapa.peso),
    0,
  );
  const pesoTotal = pesoTotalCentavos / 100;
  const temEtapaSelecionadaSemPeso = etapasSelecionadas.some(
    (etapa) => etapa.peso <= 0,
  );
  const etapasValidas = validarEtapasSelecionadas(etapasSelecionadas);

  function adicionarEtapaPersonalizada() {
    const nome = novaEtapa.trim();
    if (!nome) return;
    proximoIdPersonalizado.current += 1;
    setEtapas((prev) => [
      ...prev,
      {
        id: `personalizada-${proximoIdPersonalizado.current}`,
        nome,
        peso: "0",
        selecionada: true,
      },
    ]);
    setNovaEtapa("");
  }

  function reordenarEtapas(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setEtapas((prev) => {
      const origem = prev.findIndex((etapa) => etapa.id === active.id);
      const destino = prev.findIndex((etapa) => etapa.id === over.id);
      return origem >= 0 && destino >= 0
        ? arrayMove(prev, origem, destino)
        : prev;
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!etapasValidas) {
      toast(
        temEtapaSelecionadaSemPeso
          ? "Toda etapa selecionada precisa ter peso maior que 0%."
          : "Os pesos das etapas selecionadas devem totalizar 100%.",
      );
      return;
    }
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
        etapas: etapasSelecionadas,
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
        if (result.erro === "PESOS_ETAPAS_INVALIDOS") {
          toast(
            "Selecione etapas com pesos maiores que 0% e total igual a 100%.",
          );
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
        <CampoTexto
          rotulo="Nome da obra"
          required
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
        <CampoTexto
          rotulo="Endereço"
          required
          value={endereco}
          onChange={(e) => setEndereco(e.target.value)}
        />
        <CampoTexto
          rotulo="Cliente"
          required
          value={clienteNome}
          onChange={(e) => setClienteNome(e.target.value)}
        />
        <CampoTexto
          rotulo="Construtora"
          value={construtora}
          onChange={(e) => setConstrutora(e.target.value)}
        />
        <CampoTexto
          rotulo="Engenheiro"
          value={engenheiro}
          onChange={(e) => setEngenheiro(e.target.value)}
        />
        <CampoTexto
          rotulo="Escritório de arquitetura"
          value={escritorio}
          onChange={(e) => setEscritorio(e.target.value)}
        />
        <CampoTexto
          rotulo="Arquiteto"
          value={arquiteto}
          onChange={(e) => setArquiteto(e.target.value)}
        />
        <CampoTexto
          rotulo="Projetista de estruturas"
          value={projEst}
          onChange={(e) => setProjEst(e.target.value)}
        />
        <CampoTexto
          rotulo="Projetista de instalações"
          value={projInst}
          onChange={(e) => setProjInst(e.target.value)}
        />
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
        <CampoData
          rotulo="Início contratual"
          required
          value={inicio}
          onChange={(e) => setInicio(e.target.value)}
        />
        <CampoData
          rotulo="Término contratual"
          required
          value={termino}
          onChange={(e) => setTermino(e.target.value)}
        />
        <p className="text-xs text-cinza-3">
          Dias aditivados são registrados pelos relatórios.
        </p>
      </Cartao>

      <Cartao className="space-y-4 p-5">
        <RotuloSecao>3 · Financeiro</RotuloSecao>
        <CampoMoeda
          rotulo="Valor contratado"
          valorCentavos={valor}
          onChangeCentavos={setValor}
        />
        <CampoMoeda
          rotulo="Sinal (R$)"
          valorCentavos={sinal}
          onChangeCentavos={setSinal}
        />
      </Cartao>

      <Cartao className="space-y-4 p-5">
        <div>
          <RotuloSecao>4 · Etapas</RotuloSecao>
          <p className="mt-1 text-xs text-cinza-2">
            Selecione as etapas do escopo, distribua 100% entre elas e arraste
            para ordenar.
          </p>
        </div>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={reordenarEtapas}
        >
          <SortableContext
            items={etapas.map((etapa) => etapa.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="space-y-1" aria-label="Etapas da obra">
              {etapas.map((etapa, indice) => (
                <LinhaEtapa
                  key={etapa.id}
                  etapa={etapa}
                  indice={indice}
                  onPesoChange={(peso) =>
                    setEtapas((prev) =>
                      prev.map((item) =>
                        item.id === etapa.id ? { ...item, peso } : item,
                      ),
                    )
                  }
                  onSelecionadaChange={(selecionada) =>
                    setEtapas((prev) =>
                      prev.map((item) =>
                        item.id === etapa.id ? { ...item, selecionada } : item,
                      ),
                    )
                  }
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
        <div className="flex items-center justify-between border-t border-divisor pt-3 text-sm">
          <span className="text-cinza-2">Total:</span>
          <output
            aria-live="polite"
            className={`font-medium tabular-nums ${
              etapasValidas ? "text-tinta" : "text-marca"
            }`}
          >
            {formatadorPeso.format(pesoTotal)}%
          </output>
        </div>
        {!etapasValidas ? (
          <p role="status" className="text-xs text-marca">
            {etapasSelecionadas.length === 0
              ? "Selecione ao menos uma etapa."
              : temEtapaSelecionadaSemPeso
                ? "Toda etapa selecionada precisa ter peso maior que 0%."
                : "Os pesos das etapas selecionadas devem totalizar 100%."}
          </p>
        ) : null}
        <div className="flex gap-2">
          <input
            value={novaEtapa}
            onChange={(e) => setNovaEtapa(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                adicionarEtapaPersonalizada();
              }
            }}
            placeholder="Nova etapa"
            className="flex-1 rounded-full border border-borda px-4 py-2 text-sm"
          />
          <Botao
            type="button"
            variante="secundario"
            onClick={adicionarEtapaPersonalizada}
            aria-label="Adicionar etapa personalizada"
          >
            +
          </Botao>
        </div>
      </Cartao>

      <Botao
        type="submit"
        disabled={carregando || !etapasValidas}
        className="w-full"
      >
        {carregando ? "Criando…" : "Criar página de acompanhamento"}
      </Botao>

      <ModalUpsellLimite
        aberto={upsellLimite}
        onFechar={() => setUpsellLimite(false)}
      />
    </form>
  );
}
