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

export function ConviteAcessoEmail({
  empreiteiro,
  obraNome,
  link,
}: {
  empreiteiro: string;
  obraNome: string;
  link: string;
}) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>{`${empreiteiro} liberou o acesso à obra ${obraNome}`}</Preview>
      <Body style={{ backgroundColor: "#FAFAF9", fontFamily: "sans-serif" }}>
        <Container style={{ padding: "32px 24px" }}>
          <Heading style={{ fontWeight: 300, fontSize: 24 }}>
            Como Está Minha Obra
          </Heading>
          <Text>
            <strong>{empreiteiro}</strong> liberou o acesso à obra{" "}
            <strong>{obraNome}</strong>.
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
            Acessar acompanhamento
          </Button>
        </Container>
      </Body>
    </Html>
  );
}

export default ConviteAcessoEmail;
