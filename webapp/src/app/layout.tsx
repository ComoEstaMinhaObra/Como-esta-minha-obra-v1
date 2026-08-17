import type { Metadata } from "next";
import { Space_Grotesk, Source_Serif_4 } from "next/font/google";
import { ToastProvider } from "@/components/ui";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
  variable: "--font-source-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Como Está Minha Obra",
    template: "%s · Como Está Minha Obra",
  },
  description: "Acompanhe a obra da fundação à entrega.",
  openGraph: {
    title: "Como Está Minha Obra",
    description: "Acompanhe a obra da fundação à entrega.",
    locale: "pt_BR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${spaceGrotesk.variable} ${sourceSerif.variable}`}
    >
      <body className="bg-fundo font-sans text-tinta antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
