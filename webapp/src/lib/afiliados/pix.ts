export type TipoChavePix = "cpf" | "cnpj" | "email" | "telefone" | "aleatoria";

export const TIPOS_CHAVE_PIX: { valor: TipoChavePix; rotulo: string; dica: string }[] = [
  { valor: "cpf", rotulo: "CPF", dica: "000.000.000-00" },
  { valor: "cnpj", rotulo: "CNPJ", dica: "00.000.000/0000-00" },
  { valor: "email", rotulo: "E-mail", dica: "voce@email.com" },
  { valor: "telefone", rotulo: "Telefone", dica: "(11) 99999-9999" },
  { valor: "aleatoria", rotulo: "Chave aleatória", dica: "123e4567-e89b-12d3-a456-426614174000" },
];

const apenasDigitos = (v: string) => v.replace(/\D/g, "");

function digitoVerificador(base: number[], pesos: number[]): number {
  const soma = base.reduce((acc, n, i) => acc + n * pesos[i], 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function cpfValido(valor: string): boolean {
  const d = apenasDigitos(valor);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const n = d.split("").map(Number);
  const d1 = digitoVerificador(n.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = digitoVerificador(n.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d1 === n[9] && d2 === n[10];
}

export function cnpjValido(valor: string): boolean {
  const d = apenasDigitos(valor);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const n = d.split("").map(Number);
  const d1 = digitoVerificador(n.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = digitoVerificador(n.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d1 === n[12] && d2 === n[13];
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type ResultadoChavePix =
  | { ok: true; chave: string }
  | { ok: false; erro: string };

/**
 * Valida e normaliza a chave como o banco guarda: CPF/CNPJ só com dígitos, telefone em +55…,
 * e-mail e chave aleatória em minúsculas. O banco só confere o formato; o dígito verificador é daqui.
 */
export function normalizarChavePix(tipo: TipoChavePix, valor: string): ResultadoChavePix {
  const bruto = valor.trim();
  switch (tipo) {
    case "cpf":
      return cpfValido(bruto)
        ? { ok: true, chave: apenasDigitos(bruto) }
        : { ok: false, erro: "CPF inválido." };
    case "cnpj":
      return cnpjValido(bruto)
        ? { ok: true, chave: apenasDigitos(bruto) }
        : { ok: false, erro: "CNPJ inválido." };
    case "email": {
      const email = bruto.toLowerCase();
      return EMAIL_RE.test(email) && email.length <= 77
        ? { ok: true, chave: email }
        : { ok: false, erro: "E-mail inválido." };
    }
    case "telefone": {
      const d = apenasDigitos(bruto);
      // Pix usa o formato internacional (+55 + DDD + número)
      const comPais = d.length >= 12 && d.startsWith("55") ? d : `55${d}`;
      return comPais.length === 12 || comPais.length === 13
        ? { ok: true, chave: `+${comPais}` }
        : { ok: false, erro: "Telefone inválido. Informe DDD e número." };
    }
    case "aleatoria": {
      const chave = bruto.toLowerCase();
      return UUID_RE.test(chave)
        ? { ok: true, chave }
        : { ok: false, erro: "Chave aleatória inválida." };
    }
  }
}

/** Chave como o suporte vai ler para pagar (CPF/CNPJ/telefone com máscara). */
export function formatarChavePix(tipo: TipoChavePix, chave: string): string {
  const d = apenasDigitos(chave);
  if (tipo === "cpf" && d.length === 11) {
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  if (tipo === "cnpj" && d.length === 14) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  }
  if (tipo === "telefone" && (d.length === 12 || d.length === 13)) {
    const ddd = d.slice(2, 4);
    const numero = d.slice(4);
    const corte = numero.length - 4;
    return `+55 (${ddd}) ${numero.slice(0, corte)}-${numero.slice(corte)}`;
  }
  return chave;
}
