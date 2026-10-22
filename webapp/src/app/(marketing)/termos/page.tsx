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
        <h2 className="font-serif text-2xl font-light">3. Cobrança por obra e trial</h2>
        {/* REVISAR: Estevão/Geraldino */}
        <p className="text-cinza-2">
          O trial gratuito tem duração e limites descritos na página de preços
          (dias, uma obra e quantidade de envios). Depois dele, cada obra ativa
          tem uma assinatura mensal própria, cobrada via Mercado Pago com ciclo e
          data de cobrança próprios, sem limite de obras. Você pode cancelar a
          cobrança de uma ou mais obras a qualquer momento: cada obra cancelada
          mantém os recursos até o fim do período já pago e depois fica somente
          leitura para consulta, sem devolução proporcional. Se o pagamento de uma
          obra falhar, apenas essa obra fica somente leitura por até 14 dias para
          regularização, e a assinatura dela é cancelada se o pagamento não ocorrer
          nesse prazo; as demais obras não são afetadas. Acessos adicionais de
          e-mail são cobrados por 30 dias, a partir da aceitação do convite, na
          fatura da obra. Quem se cadastra por um link de parceiro pode ter
          desconto na assinatura, na primeira fatura ou em todas, conforme
          informado no cadastro e na tela de cobrança.
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
          É vedado uso ilícito, tentativa de burlar as regras de cobrança, engenharia
          reversa abusiva, envio de malware ou violação de direitos de
          terceiros. Podemos suspender contas em caso de abuso.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-2xl font-light">6. Programa de afiliados</h2>
        {/* REVISAR: Estevão/Geraldino — capítulo novo, validar com assessoria jurídica e contábil */}
        <ul className="list-disc space-y-2 pl-5 text-cinza-2">
          <li>
            O afiliado recebe um link próprio e uma comissão, em percentual
            definido por link, sobre os pagamentos aprovados de quem se cadastrar
            por ele: apenas sobre a primeira fatura ou sobre todos os pagamentos,
            conforme o link. O percentual e as condições do link valem para quem se
            cadastra depois da definição.
          </li>
          <li>
            A comissão é calculada sobre o valor efetivamente pago pelo cliente,
            sem descontar tarifas do meio de pagamento, e fica em carência antes de
            ser liberada para saque. O prazo da carência e o valor mínimo de saque
            são informados no painel do afiliado.
          </li>
          <li>
            Pagamentos reembolsados, contestados ou estornados têm a comissão
            correspondente estornada, inclusive do saldo já liberado, que pode ficar
            negativo e ser compensado em comissões futuras.
          </li>
          <li>
            O saque é solicitado no painel, com a chave Pix do próprio afiliado, e
            pago manualmente pelo suporte. É vedada a indicação de si mesmo, de
            contas ligadas ao afiliado, o cadastro em massa ou fictício, e qualquer
            prática enganosa de divulgação. Em caso de abuso, comissões podem ser
            estornadas e o link e a conta, suspensos.
          </li>
          <li>
            O afiliado é responsável por seus tributos sobre os valores recebidos. O
            programa não cria vínculo de emprego, sociedade, representação ou
            exclusividade, e pode ser alterado ou encerrado, preservadas as
            comissões já apuradas.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-2xl font-light">7. Privacidade</h2>
        <p className="text-cinza-2">
          O tratamento de dados pessoais segue a{" "}
          <a href="/politica-de-privacidade" className="underline">
            Política de privacidade
          </a>
          , em conformidade com a LGPD.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-2xl font-light">8. Limitação</h2>
        {/* REVISAR: Estevão/Geraldino */}
        <p className="text-cinza-2">
          Na máxima extensão permitida pela lei, a responsabilidade da
          plataforma limita-se ao valor pago nos últimos 12 meses pelo
          assinante, excluídos danos indiretos decorrentes de decisões tomadas
          com base nos relatórios.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-2xl font-light">9. Foro</h2>
        {/* REVISAR: Estevão/Geraldino */}
        <p className="text-cinza-2">
          Fica eleito o foro da comarca de Salvador/BA, salvo disposição legal
          de foro privilegiado do consumidor.
        </p>
      </section>
    </article>
  );
}
