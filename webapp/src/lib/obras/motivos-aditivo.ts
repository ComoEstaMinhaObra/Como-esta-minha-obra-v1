import type { MotivoAditivo } from "@/lib/relatorios/tipos";

export const MOTIVOS_ADITIVO: {
  value: MotivoAditivo;
  label: string;
}[] = [
  { value: "chuvas", label: "Chuvas acima da média" },
  { value: "aditivo_escopo", label: "Aditivo de escopo" },
  { value: "atraso_materiais", label: "Atraso no fornecimento de materiais" },
  { value: "licencas", label: "Licenças e aprovações de órgãos públicos" },
  { value: "interferencias", label: "Interferências imprevistas" },
  { value: "forca_maior", label: "Caso fortuito ou força maior" },
  { value: "outro", label: "Outro" },
];

export function rotuloMotivoAditivo(motivo: string): string {
  const found = MOTIVOS_ADITIVO.find((m) => m.value === motivo);
  return found?.label ?? motivo;
}
