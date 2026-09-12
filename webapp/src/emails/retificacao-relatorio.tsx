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

export function RetificacaoRelatorioEmail({
  obraNome,
  numero,
  versaoNumero,
  avancoAntes,
  avancoDepois,
  link,
}: {
  obraNome: string;
  numero: number;
  versaoNumero: number;
  avancoAntes: number;
  avancoDepois: number;
  link: string;
}) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>{`Relatório nº ${numero} da obra ${obraNome} foi retificado`}</Preview>
      <Body style={{ backgroundColor: "#FAFAF9", fontFamily: "sans-serif" }}>
        <Container style={{ padding: "32px 24px" }}>
          <Heading style={{ fontWeight: 300, fontSize: 24 }}>
            Relatório nº {numero} retificado
          </Heading>
          <Text>
            A versão {versaoNumero} do relatório da obra{" "}
            <strong>{obraNome}</strong> está disponível. A versão anterior
            permanece no histórico.
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
            Ver relatório
          </Button>
        </Container>
      </Body>
    </Html>
  );
}
