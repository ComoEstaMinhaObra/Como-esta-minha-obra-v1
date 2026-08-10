import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Como Está Minha Obra",
  description: "Acompanhe a obra da fundação à entrega.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
