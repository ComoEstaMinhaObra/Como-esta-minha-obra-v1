import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // As fontes do PDF são lidas em runtime via path.join(process.cwd(), ...), que o
  // tracing do Next não enxerga; sem isto, a função na Vercel falha com ENOENT.
  outputFileTracingIncludes: {
    "/obras/[obraId]": ["./src/assets/fonts/**/*"],
  },
  // A tela de Planos virou Cobrança (cobrança por obra, 03/10/2026). Links e favoritos antigos
  // continuam funcionando; /cobrancas (plural) também.
  async redirects() {
    return [
      { source: "/planos", destination: "/cobranca", permanent: true },
      { source: "/planos/:path*", destination: "/cobranca", permanent: true },
      { source: "/cobrancas", destination: "/cobranca", permanent: true },
    ];
  },
};

export default nextConfig;
