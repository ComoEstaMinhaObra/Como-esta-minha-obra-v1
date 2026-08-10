export const ETAPAS_PADRAO = [
  "Montagem do canteiro de obras",
  "Demolições",
  "Terraplanagem",
  "Fundações",
  "Estrutura",
  "Alvenarias",
  "Cobertura",
  "Instalações elétricas e rede",
  "Instalações hidrossanitárias",
  "Instalações de ar condicionado",
  "Rebocos e contrapisos",
  "Impermeabilizações",
  "Revestimentos de piso",
  "Revestimentos de parede",
  "Revestimentos de teto",
  "Fachadas",
  "Esquadrias (janelas)",
  "Esquadrias (portas)",
  "Acabamentos de granito",
  "Acabamentos elétricos e luminárias",
  "Louças e metais sanitários",
  "Pintura",
  "Limpeza final de obra",
] as const;

export function statusObraDeAvanco(pct: number): {
  rotulo: "Concluída" | "A iniciar" | "Em obra";
  tom: "preto" | "cinza" | "ambar";
} {
  if (pct >= 100) return { rotulo: "Concluída", tom: "preto" };
  if (pct <= 0) return { rotulo: "A iniciar", tom: "cinza" };
  return { rotulo: "Em obra", tom: "ambar" };
}
