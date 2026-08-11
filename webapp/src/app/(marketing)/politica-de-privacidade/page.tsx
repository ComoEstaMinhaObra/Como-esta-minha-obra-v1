import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de privacidade",
  description:
    "Como tratamos dados pessoais na plataforma Como Está Minha Obra, em conformidade com a LGPD.",
  openGraph: {
    title: "Política de privacidade · Como Está Minha Obra",
    description:
      "Tratamento de dados pessoais na plataforma Como Está Minha Obra (LGPD).",
    type: "website",
  },
};

export default function PoliticaPrivacidadePage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 prose-like space-y-8 text-sm leading-relaxed">
      <header className="space-y-2">
        <h1 className="font-serif text-4xl font-light">
          Política de privacidade
        </h1>
        <p className="text-cinza-2">
          Como Está Minha Obra · LGPD (Lei nº 13.709/2018)
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-serif text-2xl font-light">1. Controlador</h2>
        {/* REVISAR: Estevão/Geraldino */}
        <p>
          O controlador dos dados pessoais é a operação &quot;Como Está Minha
          Obra&quot;, responsável pelo site comoestaminhaobra.com.br. Canal de
          contato do titular:{" "}
          <a
            className="underline"
            href="mailto:contato@comoestaminhaobra.com.br"
          >
            contato@comoestaminhaobra.com.br
          </a>
          .
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-2xl font-light">2. Dados coletados</h2>
        <ul className="list-disc space-y-2 pl-5 text-cinza-2">
          <li>
            <strong className="text-tinta">Cadastro:</strong> e-mail (magic
            link), nome do perfil.
          </li>
          <li>
            <strong className="text-tinta">Dados da obra:</strong> endereço,
            equipe, valores contratados/sinal, etapas, avanços, lançamentos
            financeiros, prazos e aditivos.
          </li>
          <li>
            <strong className="text-tinta">Fotos de obra:</strong> imagens
            enviadas nos relatórios (armazenamento privado).
          </li>
          <li>
            <strong className="text-tinta">Acessos:</strong> e-mails convidados
            (proprietários) e status de convite/login.
          </li>
          <li>
            <strong className="text-tinta">Assinatura:</strong> plano, status,
            identificadores do provedor de pagamento (sem armazenar número
            completo de cartão).
          </li>
          {/* REVISAR: Estevão/Geraldino */}
          <li>
            Dados de navegação mínimos necessários ao funcionamento (sessão,
            logs técnicos).
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-2xl font-light">3. Finalidades</h2>
        <p className="text-cinza-2">
          Prestação do serviço de relatórios e página do proprietário;
          autenticação; cobrança de planos e add-ons; envio de e-mails
          transacionais (convite, novo relatório, magic link); suporte;
          cumprimento de obrigações legais; melhoria de segurança e prevenção a
          fraude.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-2xl font-light">4. Bases legais</h2>
        {/* REVISAR: Estevão/Geraldino */}
        <p className="text-cinza-2">
          Execução de contrato (art. 7º, V); legítimo interesse para segurança e
          melhoria operacional (art. 7º, IX), quando cabível; consentimento
          quando exigido; cumprimento de obrigação legal (art. 7º, II).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-2xl font-light">5. Suboperadores</h2>
        <ul className="list-disc space-y-2 pl-5 text-cinza-2">
          <li>Supabase — autenticação, banco e storage</li>
          <li>Vercel — hospedagem do aplicativo</li>
          <li>Resend — envio de e-mails</li>
          <li>AbacatePay — pagamentos e assinaturas</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-2xl font-light">
          6. Direitos do titular
        </h2>
        <p className="text-cinza-2">
          Confirmação de tratamento, acesso, correção, anonimização/bloqueio,
          eliminação de dados desnecessários, portabilidade, informação sobre
          compartilhamentos, revogação de consentimento e reclamação à ANPD.
          Exercício pelo canal{" "}
          <a
            className="underline"
            href="mailto:contato@comoestaminhaobra.com.br"
          >
            contato@comoestaminhaobra.com.br
          </a>
          .
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-2xl font-light">7. Retenção</h2>
        {/* REVISAR: Estevão/Geraldino */}
        <p className="text-cinza-2">
          Dados da conta e obras são mantidos enquanto a conta existir. Obras
          arquivadas permanecem acessíveis para consulta; após 30 dias do
          arquivamento, conteúdo associado pode ser elegível a limpeza conforme
          política operacional. Logs de webhook e auditoria seguem prazo técnico
          necessário à segurança e cobrança.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-2xl font-light">8. Cookies</h2>
        <p className="text-cinza-2">
          Utilizamos cookies essenciais de sessão (autenticação Supabase). Não
          utilizamos cookies de publicidade de terceiros na v1.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-2xl font-light">9. Atualizações</h2>
        {/* REVISAR: Estevão/Geraldino */}
        <p className="text-cinza-2">
          Esta política pode ser atualizada. A versão vigente permanece
          publicada nesta página com a data de revisão.
        </p>
      </section>
    </article>
  );
}
