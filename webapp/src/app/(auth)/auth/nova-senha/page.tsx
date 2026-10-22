import { Logo } from "@/components/brand/Logo";
import { FormNovaSenha } from "./FormNovaSenha";

export default function NovaSenhaPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 p-8">
      <Logo href="/" tamanho={48} />
      <FormNovaSenha />
    </main>
  );
}
