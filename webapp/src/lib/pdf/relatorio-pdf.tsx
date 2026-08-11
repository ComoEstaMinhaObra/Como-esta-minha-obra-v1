import path from "node:path";
import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { RelatorioSnapshot } from "@/lib/relatorios/tipos";
import { formatarBRL } from "@/lib/formatacao";

const fontsDir = path.join(process.cwd(), "src/assets/fonts");

Font.register({
  family: "SpaceGrotesk",
  fonts: [
    { src: path.join(fontsDir, "SpaceGrotesk-Light.ttf"), fontWeight: 300 },
    { src: path.join(fontsDir, "SpaceGrotesk-Regular.ttf"), fontWeight: 400 },
  ],
});

Font.register({
  family: "SourceSerif",
  fonts: [
    { src: path.join(fontsDir, "SourceSerif4-Light.ttf"), fontWeight: 300 },
    { src: path.join(fontsDir, "SourceSerif4-Regular.ttf"), fontWeight: 400 },
  ],
});

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "SpaceGrotesk",
    fontSize: 10,
    color: "#141414",
    backgroundColor: "#FAFAF9",
  },
  marca: {
    fontFamily: "SourceSerif",
    fontSize: 14,
    fontWeight: 300,
    marginBottom: 4,
  },
  titulo: {
    fontFamily: "SourceSerif",
    fontSize: 18,
    fontWeight: 300,
    marginBottom: 2,
  },
  meta: { color: "#8A8A85", marginBottom: 16 },
  secao: {
    fontSize: 9,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: "#8A8A85",
    marginTop: 14,
    marginBottom: 6,
  },
  linha: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: "#ECECE9",
  },
  destaque: {
    fontFamily: "SourceSerif",
    fontSize: 12,
    marginBottom: 4,
  },
});

export function RelatorioPdfDocument({
  snapshot,
}: {
  snapshot: RelatorioSnapshot;
}) {
  const enviado = new Date(snapshot.enviadoEm).toLocaleDateString("pt-BR", {
    timeZone: "America/Bahia",
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.marca}>Como Está Minha Obra</Text>
        <Text style={styles.titulo}>{snapshot.obra.nome}</Text>
        <Text style={styles.meta}>
          Relatório nº {snapshot.numero} · {enviado} ·{" "}
          {snapshot.obra.clienteNome}
        </Text>
        <Text style={styles.meta}>{snapshot.obra.endereco}</Text>

        <Text style={styles.secao}>Avanço físico</Text>
        <Text style={styles.destaque}>
          {snapshot.avancoFisico.geralAntes}% →{" "}
          {snapshot.avancoFisico.geralDepois}%
        </Text>
        {snapshot.avancoFisico.etapas.map((e) => (
          <View key={e.nome} style={styles.linha}>
            <Text>{e.nome}</Text>
            <Text>
              {e.pctAnterior}% → {e.pctNovo}%
            </Text>
          </View>
        ))}

        <Text style={styles.secao}>Financeiro</Text>
        <Text>
          Contratado: {formatarBRL(snapshot.financeiro.valorContratadoCentavos)}
        </Text>
        <Text>
          Aditivos:{" "}
          {formatarBRL(snapshot.financeiro.aditivosAcumuladoCentavos)}
        </Text>
        <Text>
          Contratado total:{" "}
          {formatarBRL(snapshot.financeiro.contratadoTotalCentavos)}
        </Text>
        <Text>
          Pago: {formatarBRL(snapshot.financeiro.pagoAcumuladoCentavos)} (
          {snapshot.financeiro.pctPago}%)
        </Text>
        <Text>
          Saldo: {formatarBRL(snapshot.financeiro.saldoCentavos)}
        </Text>
        {snapshot.financeiro.lancamentosNovos.map((l, i) => (
          <View key={`${l.rotulo}-${i}`} style={styles.linha}>
            <Text>{l.rotulo}</Text>
            <Text>{formatarBRL(l.valorCentavos)}</Text>
          </View>
        ))}

        <Text style={styles.secao}>Prazo</Text>
        <Text>
          Dias aditivados neste relatório:{" "}
          {snapshot.prazo.novosDias.reduce((a, d) => a + d.dias, 0)}
        </Text>
        <Text>Total acumulado: {snapshot.prazo.totalDiasAditivados}</Text>
        <Text>Novo término: {snapshot.prazo.novaDataTermino}</Text>

        <Text style={styles.secao}>Atividades</Text>
        {snapshot.atividades.length === 0 ? (
          <Text>Nenhuma atividade registrada.</Text>
        ) : (
          snapshot.atividades.map((a, i) => (
            <View key={`${a.etapaNome}-${i}`} style={{ marginBottom: 8 }}>
              <Text style={{ fontWeight: 400 }}>{a.etapaNome}</Text>
              <Text>{a.nota || "—"}</Text>
              {a.fotosPaths.length > 0 ? (
                <Text style={{ color: "#8A8A85" }}>
                  {Math.min(a.fotosPaths.length, 4)} foto(s) anexada(s)
                </Text>
              ) : null}
            </View>
          ))
        )}

        <Text style={styles.secao}>Clima</Text>
        {snapshot.clima.dias.length === 0 ? (
          <Text>Clima indisponível.</Text>
        ) : (
          snapshot.clima.dias.map((d) => (
            <View key={d.data} style={styles.linha}>
              <Text>{d.data}</Text>
              <Text>
                {d.condicao}
                {d.probChuva != null ? ` · ${d.probChuva}%` : ""}
              </Text>
            </View>
          ))
        )}
      </Page>
    </Document>
  );
}
