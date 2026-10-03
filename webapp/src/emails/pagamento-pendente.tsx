import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components";

export function PagamentoPendenteEmail({
  obraNome,
  limite,
  link,
}: {
  obraNome: string;
  /** Data (dd/mm) em que a assinatura da obra é cancelada se o pagamento não for regularizado. */
  limite: string;
  link: string;
}) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>{`Pagamento pendente da obra ${obraNome}`}</Preview>
      <Body style={{ backgroundColor: "#FAFAF9", fontFamily: "sans-serif" }}>
        <Container style={{ padding: "32px 24px" }}>
          <Heading style={{ fontWeight: 300, fontSize: 24 }}>
            Pagamento pendente
          </Heading>
          <Text>
            Não conseguimos confirmar o pagamento da obra{" "}
            <strong>{obraNome}</strong>. Enquanto isso, essa obra está somente
            leitura: você consulta tudo, mas não edita rascunhos nem envia
            relatórios. As outras obras não são afetadas.
          </Text>
          <Text>
            Se o pagamento não for regularizado até <strong>{limite}</strong>, a
            assinatura dessa obra será cancelada.
          </Text>
          <Button
            href={link}
            style={{
              backgroundColor: "#F25C1F",
              color: "#fff",
              padding: "12px 20px",
              borderRadius: 999,
              textDecoration: "none",
            }}
          >
            Regularizar pagamento
          </Button>
        </Container>
      </Body>
    </Html>
  );
}

export default PagamentoPendenteEmail;
