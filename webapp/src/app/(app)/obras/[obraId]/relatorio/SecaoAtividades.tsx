"use client";

import { GradeFotos, useToast } from "@/components/ui";
import imageCompression from "browser-image-compression";
import { createClient } from "@/lib/supabase/client";
import type { RelatorioRascunho } from "@/lib/relatorios/tipos";
import type { EtapaObra } from "../ModalRelatorio";

export function SecaoAtividades({
  etapas,
  dados,
  onChange,
  obraId,
  relatorioId,
}: {
  etapas: EtapaObra[];
  dados: RelatorioRascunho;
  onChange: (d: RelatorioRascunho) => void;
  obraId: string;
  relatorioId?: string;
}) {
  const { toast } = useToast();
  const marcadas = new Set(dados.atividades.map((a) => a.etapaId));

  function toggle(etapaId: string) {
    if (marcadas.has(etapaId)) {
      onChange({
        ...dados,
        atividades: dados.atividades.filter((a) => a.etapaId !== etapaId),
      });
      return;
    }
    onChange({
      ...dados,
      atividades: [
        ...dados.atividades,
        { etapaId, nota: "", fotosPaths: [] },
      ],
    });
  }

  async function anexar(etapaId: string, file: File) {
    const atividade = dados.atividades.find((a) => a.etapaId === etapaId);
    if (!atividade) return;
    if (atividade.fotosPaths.length >= 12) {
      toast("Limite de 12 fotos por etapa");
      return;
    }
    if (!relatorioId) {
      toast("Salve o rascunho antes de anexar fotos");
      return;
    }

    const compressed = await imageCompression(file, {
      maxWidthOrHeight: 1600,
      fileType: "image/webp",
      maxSizeMB: 1.5,
    });
    const path = `${obraId}/${relatorioId}/${etapaId}/${crypto.randomUUID()}.webp`;
    const supabase = createClient();
    const { error } = await supabase.storage
      .from("fotos")
      .upload(path, compressed, { contentType: "image/webp", upsert: false });
    if (error) {
      toast("Falha no upload da foto");
      return;
    }
    onChange({
      ...dados,
      atividades: dados.atividades.map((a) =>
        a.etapaId === etapaId
          ? { ...a, fotosPaths: [...a.fotosPaths, path] }
          : a,
      ),
    });
  }

  return (
    <section className="space-y-3">
      <p className="tracking-[0.18em] text-[10px] uppercase text-cinza-2">
        3 · Atividades
      </p>
      <ul className="space-y-2">
        {etapas.map((etapa) => {
          const marcada = marcadas.has(etapa.id);
          const atividade = dados.atividades.find((a) => a.etapaId === etapa.id);
          return (
            <li key={etapa.id} className="rounded-[16px] border border-borda p-3">
              <button
                type="button"
                className="flex w-full items-center gap-3 text-left text-sm"
                onClick={() => toggle(etapa.id)}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                    marcada ? "border-marca bg-marca text-white" : "border-borda"
                  }`}
                >
                  {marcada ? "✓" : ""}
                </span>
                {etapa.nome}
              </button>
              {marcada && atividade ? (
                <div className="mt-3 space-y-3 pl-8">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="text-cinza-2">
                      O que foi feito nesta etapa?
                    </span>
                    <textarea
                      className="min-h-20 rounded-[16px] border border-borda px-3 py-2 outline-none focus:border-marca"
                      value={atividade.nota}
                      onChange={(e) =>
                        onChange({
                          ...dados,
                          atividades: dados.atividades.map((a) =>
                            a.etapaId === etapa.id
                              ? { ...a, nota: e.target.value }
                              : a,
                          ),
                        })
                      }
                    />
                  </label>
                  <GradeFotos
                    urls={[]}
                    onAnexar={() => {
                      const input = document.createElement("input");
                      input.type = "file";
                      input.accept = "image/*";
                      input.onchange = () => {
                        const file = input.files?.[0];
                        if (file) void anexar(etapa.id, file);
                      };
                      input.click();
                    }}
                  />
                  <p className="text-xs text-cinza-3">
                    {atividade.fotosPaths.length}/12 fotos anexadas
                  </p>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
