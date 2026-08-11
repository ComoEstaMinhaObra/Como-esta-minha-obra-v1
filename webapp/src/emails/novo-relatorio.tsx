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

export function NovoRelatorioEmail({
  obraNome,
  numero,
  avancoAntes,
  avancoDepois,
  link,
}: {
  obraNome: string;
  numero: number;
  avancoAntes: number;
  avancoDepois: number;
  link: string;
}) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>{`Relatório nº ${numero} da obra ${obraNome} disponível`}</Preview>
      <Body style={{ backgroundColor: "#FAFAF9", fontFamily: "sans-serif" }}>
        <Container style={{ padding: "32px 24px" }}>
          <Heading style={{ fontWeight: 300, fontSize: 24 }}>
            Relatório nº {numero}
          </Heading>
          <Text>
            O relatório da obra <strong>{obraNome}</strong> está disponível.
          </Text>
          <Text>
            Avanço físico: {avancoAntes}% → {avancoDepois}%
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
            Ver acompanhamento
          </Button>
        </Container>
      </Body>
    </Html>
  );
}

export default NovoRelatorioEmail;
