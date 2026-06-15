export function isValidCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '')

  if (digits.length !== 11) return false

  // Rejeita sequências com todos os dígitos iguais (ex: 111.111.111-11)
  if (/^(\d)\1{10}$/.test(digits)) return false

  function calcDigit(slice: string, weight: number): number {
    const sum = slice
      .split('')
      .reduce((acc, d, i) => acc + parseInt(d) * (weight - i), 0)
    const remainder = (sum * 10) % 11
    return remainder === 10 ? 0 : remainder
  }

  const first  = calcDigit(digits.slice(0, 9), 10)
  const second = calcDigit(digits.slice(0, 10), 11)

  return first === parseInt(digits[9]) && second === parseInt(digits[10])
}
