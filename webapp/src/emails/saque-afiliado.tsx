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

export function SaqueAfiliadoEmail({
  situacao,
  valor,
  observacao,
  link,
}: {
  situacao: "pago" | "recusado";
  /** Valor já formatado (R$ 1.234,56). */
  valor: string;
  /** ID da transação (pago) ou motivo (recusado), quando houver. */
  observacao?: string | null;
  link: string;
}) {
  const pago = situacao === "pago";
  const titulo = pago ? "Seu saque foi pago" : "Seu saque não foi pago";
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>{`${titulo} · ${valor}`}</Preview>
      <Body style={{ backgroundColor: "#FAFAF9", fontFamily: "sans-serif" }}>
        <Container style={{ padding: "32px 24px" }}>
          <Heading style={{ fontWeight: 300, fontSize: 24 }}>{titulo}</Heading>
          {pago ? (
            <Text>
              Enviamos <strong>{valor}</strong> para a chave Pix informada no
              pedido de saque do programa de afiliados.
            </Text>
          ) : (
            <Text>
              Não conseguimos pagar o saque de <strong>{valor}</strong>. O valor
              voltou para o seu saldo disponível e você pode pedir o saque
              novamente.
            </Text>
          )}
          {observacao ? (
            <Text>
              {pago ? "Referência" : "Motivo"}: {observacao}
            </Text>
          ) : null}
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
            Ver meu painel de afiliado
          </Button>
        </Container>
      </Body>
    </Html>
  );
}

export default SaqueAfiliadoEmail;
