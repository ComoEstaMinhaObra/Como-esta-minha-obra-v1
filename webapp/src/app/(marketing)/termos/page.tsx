import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Termos de uso",
  description: "Termos de uso da plataforma Como Está Minha Obra.",
  openGraph: {
    title: "Termos de uso · Como Está Minha Obra",
    description: "Termos de uso da plataforma Como Está Minha Obra.",
    type: "website",
  },
};

export default function TermosPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 space-y-8 text-sm leading-relaxed">
      <header className="space-y-2">
        <h1 className="font-serif text-4xl font-light">Termos de uso</h1>
        <p className="text-cinza-2">Como Está Minha Obra</p>
      </header>

      <section className="space-y-3">
        <h2 className="font-serif text-2xl font-light">1. Objeto</h2>
        <p className="text-cinza-2">
          Estes termos regulam o uso da plataforma Como Está Minha Obra, serviço
          de registro e compartilhamento de progresso de obras civis entre
          empreiteiro e proprietário.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-2xl font-light">2. Conta e acesso</h2>
        <p className="text-cinza-2">
          O acesso é feito com e-mail e senha. O usuário é responsável pela
          veracidade dos dados e pela guarda das credenciais utilizadas.
          Convites a proprietários liberam acesso somente aos e-mails
          autorizados.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-2xl font-light">3. Planos e trial</h2>
        {/* REVISAR: Estevão/Geraldino */}
        <p className="text-cinza-2">
          O trial gratuito tem duração e limites descritos na página de preços
          (dias e quantidade de envios). Planos pagos seguem cobrança mensal via
          AbacatePay. Upgrade/downgrade aplica-se no próximo ciclo, sem
          pró-rata. Cancelamento encerra cobranças futuras e deixa a conta em
          modo somente leitura.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-2xl font-light">4. Conteúdo do usuário</h2>
        <p className="text-cinza-2">
          Fotos, textos e dados financeiros da obra são de responsabilidade do
          empreiteiro. A plataforma não substitui responsabilidade técnica,
          ART/RRT, laudos ou obrigações contratuais da obra.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-2xl font-light">5. Uso aceitável</h2>
        <p className="text-cinza-2">
          É vedado uso ilícito, tentativa de burlar limites do plano, engenharia
          reversa abusiva, envio de malware ou violação de direitos de
          terceiros. Podemos suspender contas em caso de abuso.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-2xl font-light">6. Privacidade</h2>
        <p className="text-cinza-2">
          O tratamento de dados pessoais segue a{" "}
          <a href="/politica-de-privacidade" className="underline">
            Política de privacidade
          </a>
          , em conformidade com a LGPD.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-2xl font-light">7. Limitação</h2>
        {/* REVISAR: Estevão/Geraldino */}
        <p className="text-cinza-2">
          Na máxima extensão permitida pela lei, a responsabilidade da
          plataforma limita-se ao valor pago nos últimos 12 meses pelo
          assinante, excluídos danos indiretos decorrentes de decisões tomadas
          com base nos relatórios.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-2xl font-light">8. Foro</h2>
        {/* REVISAR: Estevão/Geraldino */}
        <p className="text-cinza-2">
          Fica eleito o foro da comarca de Salvador/BA, salvo disposição legal
          de foro privilegiado do consumidor.
        </p>
      </section>
    </article>
  );
}
