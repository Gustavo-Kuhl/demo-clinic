/**
 * Valida um CPF brasileiro.
 * Aceita CPF com ou sem formatação (ex: "123.456.789-09" ou "12345678909").
 * Retorna false se:
 *  - Não tiver exatamente 11 dígitos
 *  - Todos os dígitos forem iguais (ex: 00000000000)
 *  - Os dígitos verificadores não baterem
 */
export function isValidCpf(raw: string): boolean {
  const cpf = raw.replace(/\D/g, '');

  if (cpf.length !== 11) return false;

  // Rejeita sequências de dígitos iguais (00000000000, 11111111111 etc.)
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  // Primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(cpf[i]) * (10 - i);
  let rem = (sum * 10) % 11;
  if (rem === 10 || rem === 11) rem = 0;
  if (rem !== Number(cpf[9])) return false;

  // Segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(cpf[i]) * (11 - i);
  rem = (sum * 10) % 11;
  if (rem === 10 || rem === 11) rem = 0;
  if (rem !== Number(cpf[10])) return false;

  return true;
}
