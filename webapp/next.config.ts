import type { NextConfig } from "next";

// Domínio de produção (canônico, sem www) e os endereços que devem levar até ele.
// Só o alias de produção da Vercel entra aqui: previews e a Staging usam outros hosts
// *.vercel.app e não podem ser redirecionados.
const DOMINIO_CANONICO = "https://comoestaminhaobra.com.br";
const HOSTS_LEGADOS = [
  "www.comoestaminhaobra.com.br",
  "como-esta-minha-obra.vercel.app",
];

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
      // /api fica de fora: cron da Vercel e webhook do Mercado Pago não seguem redirecionamento.
      ...HOSTS_LEGADOS.map((host) => ({
        source: "/:caminho((?!api/).*)",
        has: [{ type: "host" as const, value: host }],
        destination: `${DOMINIO_CANONICO}/:caminho`,
        permanent: true,
      })),
      { source: "/planos", destination: "/cobranca", permanent: true },
      { source: "/planos/:path*", destination: "/cobranca", permanent: true },
      { source: "/cobrancas", destination: "/cobranca", permanent: true },
    ];
  },
};

export default nextConfig;
