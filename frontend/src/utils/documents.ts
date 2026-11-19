// CPF/CNPJ e UF para os cadastros de Clientes e Empresa.
// Mesma regra de dígitos verificadores que a tela fiscal e o servidor usam.

export const BRAZILIAN_STATES = [
  'AC',
  'AL',
  'AM',
  'AP',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MG',
  'MS',
  'MT',
  'PA',
  'PB',
  'PE',
  'PI',
  'PR',
  'RJ',
  'RN',
  'RO',
  'RR',
  'RS',
  'SC',
  'SE',
  'SP',
  'TO',
] as const

function digitsOf(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '')
}

function allSameDigits(digits: string): boolean {
  return /^(\d)\1+$/.test(digits)
}

export function isValidCpf(value: string | null | undefined): boolean {
  const digits = digitsOf(value)
  if (digits.length !== 11 || allSameDigits(digits)) return false
  for (const length of [9, 10]) {
    let sum = 0
    for (let index = 0; index < length; index += 1) {
      sum += Number(digits[index]) * (length + 1 - index)
    }
    if (((sum * 10) % 11) % 10 !== Number(digits[length])) return false
  }
  return true
}

export function isValidCnpj(value: string | null | undefined): boolean {
  const digits = digitsOf(value)
  if (digits.length !== 14 || allSameDigits(digits)) return false
  for (const length of [12, 13]) {
    const weights =
      length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const sum = weights.reduce((total, weight, index) => total + Number(digits[index]) * weight, 0)
    const remainder = sum % 11
    if ((remainder < 2 ? 0 : 11 - remainder) !== Number(digits[length])) return false
  }
  return true
}

/**
 * Mensagem de erro do CPF/CNPJ ou texto vazio quando está certo (ou em branco).
 * Com o tipo de pessoa, também confere se o documento combina com ele.
 */
export function taxDocumentError(
  value: string | null | undefined,
  personType?: 'individual' | 'company' | string,
): string {
  const digits = digitsOf(value)
  if (!digits) return ''
  if (digits.length !== 11 && digits.length !== 14) {
    return `O documento tem ${digits.length} dígitos. O CPF tem 11 e o CNPJ tem 14.`
  }
  if (digits.length === 11 && !isValidCpf(digits)) {
    return 'CPF inválido. Confira os números digitados.'
  }
  if (digits.length === 14 && !isValidCnpj(digits)) {
    return 'CNPJ inválido. Confira os números digitados.'
  }
  if (personType === 'individual' && digits.length === 14) {
    return 'Para CNPJ, escolha o tipo pessoa jurídica.'
  }
  if (personType === 'company' && digits.length === 11) {
    return 'Para CPF, escolha o tipo pessoa física.'
  }
  return ''
}

/** Máscara enquanto a pessoa digita: 123.456.789-09 ou 11.222.333/0001-81. */
export function maskTaxDocument(value: string): string {
  const digits = digitsOf(value).slice(0, 14)
  if (digits.length <= 11) {
    return digits
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2')
  }
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}
