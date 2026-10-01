import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // As fontes do PDF são lidas em runtime via path.join(process.cwd(), ...), que o
  // tracing do Next não enxerga; sem isto, a função na Vercel falha com ENOENT.
  outputFileTracingIncludes: {
    "/obras/[obraId]": ["./src/assets/fonts/**/*"],
  },
};

export default nextConfig;
