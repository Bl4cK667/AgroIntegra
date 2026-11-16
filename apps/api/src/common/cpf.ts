export function onlyDigits(value: string): string {
  return (value ?? '').replace(/\D/g, '');
}

// Confere os dois dígitos verificadores do CPF.
export function isValidCpf(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digits = cpf.split('').map(Number);
  const check = (length: number) => {
    const sum = digits.slice(0, length).reduce((acc, n, i) => acc + n * (length + 1 - i), 0);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return check(9) === digits[9] && check(10) === digits[10];
}

// Formato exibido em toda a demo: ***.456.789-**
export function maskCpf(cpf: string): string {
  const d = onlyDigits(cpf);
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}
