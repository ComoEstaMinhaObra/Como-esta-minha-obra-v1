"use client";

import { useState } from "react";
import {
  Acordeao,
  AcordeaoItem,
  AnelProgresso,
  Avatar,
  BarraProgresso,
  Botao,
  CampoData,
  CampoMoeda,
  CampoTexto,
  Cartao,
  CartaoEscuro,
  GradeFotos,
  Lightbox,
  ModalBase,
  RotuloSecao,
  Selo,
  Slider,
  useToast,
} from "@/components/ui";

export function DevUiShowcase() {
  const { toast } = useToast();
  const [moeda, setMoeda] = useState(1299000);
  const [slider, setSlider] = useState(40);
  const [modal, setModal] = useState(false);
  const [lightbox, setLightbox] = useState(false);

  return (
    <main className="mx-auto max-w-[960px] space-y-10 p-6 pb-24">
      <header className="space-y-2">
        <RotuloSecao>Dev</RotuloSecao>
        <h1 className="font-serif text-3xl font-light">UI kit</h1>
        <p className="text-sm text-cinza-2">
          Somente em development. Paridade com tokens da seção 2.5.
        </p>
      </header>

      <section className="space-y-3">
        <RotuloSecao>Botões</RotuloSecao>
        <div className="flex flex-wrap gap-3">
          <Botao variante="primario">Primário</Botao>
          <Botao variante="secundario">Secundário</Botao>
          <Botao variante="terciario">Terciário</Botao>
        </div>
      </section>

      <section className="grid gap-4 min-[800px]:grid-cols-2">
        <Cartao className="p-5 space-y-3">
          <RotuloSecao>Cartão</RotuloSecao>
          <p className="font-serif text-xl font-light">Residência Francisco</p>
          <Selo tom="ambar">Em obra</Selo>
          <BarraProgresso pct={46} />
        </Cartao>
        <CartaoEscuro className="p-5 flex items-center gap-5">
          <AnelProgresso pct={46} />
          <div>
            <RotuloSecao className="text-marca-clara">Resumo</RotuloSecao>
            <p className="font-serif text-lg font-light">46% concluído</p>
          </div>
        </CartaoEscuro>
      </section>

      <section className="space-y-3">
        <RotuloSecao>Campos</RotuloSecao>
        <div className="grid gap-4 min-[800px]:grid-cols-2">
          <CampoTexto rotulo="Nome da obra" placeholder="Residência..." />
          <CampoData rotulo="Início contratual" />
          <CampoMoeda
            rotulo="Valor contratado"
            valorCentavos={moeda}
            onChangeCentavos={setMoeda}
          />
          <div className="space-y-2">
            <p className="text-sm text-cinza-2">Slider (min 20)</p>
            <Slider valor={slider} min={20} onChange={setSlider} aria-label="Avanço" />
            <p className="text-sm tabular-nums">{slider}%</p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <RotuloSecao>Acordeão · Avatar · Fotos</RotuloSecao>
        <Cartao className="px-4">
          <Acordeao ids={["a", "b"]}>
            <AcordeaoItem id="a" titulo="Dados do projeto">
              Conteúdo nível 1
              <AcordeaoItem id="b" titulo="Arquitetos" nivel={2}>
                Subgrupo
              </AcordeaoItem>
            </AcordeaoItem>
          </Acordeao>
        </Cartao>
        <div className="flex items-center gap-3">
          <Avatar nome="Estevão Moreira" />
          <Avatar nome="Francisco" tamanho={48} />
        </div>
        <GradeFotos
          urls={[]}
          onAnexar={() => toast("Limite de fotos (demo)")}
        />
      </section>

      <section className="flex flex-wrap gap-3">
        <Botao onClick={() => toast("Rascunho salvo")}>Disparar toast</Botao>
        <Botao variante="secundario" onClick={() => setModal(true)}>
          Abrir modal
        </Botao>
        <Botao variante="terciario" onClick={() => setLightbox(true)}>
          Abrir lightbox
        </Botao>
      </section>

      <ModalBase aberto={modal} onFechar={() => setModal(false)} titulo="Confirmar">
        <p className="text-sm text-cinza-2 mb-4">Modal base com Esc e clique fora.</p>
        <Botao onClick={() => setModal(false)}>Fechar</Botao>
      </ModalBase>

      <Lightbox
        aberto={lightbox}
        onFechar={() => setLightbox(false)}
        titulo="Alvenarias"
      >
        <p className="text-white/80 text-sm">Conteúdo do lightbox.</p>
      </Lightbox>
    </main>
  );
}
