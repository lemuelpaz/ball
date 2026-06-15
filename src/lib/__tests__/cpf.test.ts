import { describe, it, expect } from 'vitest'
import { isValidCpf } from '../cpf'

describe('isValidCpf', () => {
  // Happy path — CPFs reais válidos
  it('aceita CPF válido sem máscara', () => {
    expect(isValidCpf('11144477735')).toBe(true)
  })

  it('aceita CPF válido com máscara', () => {
    expect(isValidCpf('111.444.777-35')).toBe(true)
  })

  it('aceita outro CPF válido', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true)
  })

  // Dígitos verificadores incorretos
  it('rejeita CPF com primeiro dígito verificador errado', () => {
    expect(isValidCpf('111.444.777-45')).toBe(false)
  })

  it('rejeita CPF com segundo dígito verificador errado', () => {
    expect(isValidCpf('111.444.777-36')).toBe(false)
  })

  // Todos os dígitos iguais (caso especial — tecnicamente inválidos)
  it.each([
    '000.000.000-00',
    '111.111.111-11',
    '222.222.222-22',
    '333.333.333-33',
    '444.444.444-44',
    '555.555.555-55',
    '666.666.666-66',
    '777.777.777-77',
    '888.888.888-88',
    '999.999.999-99',
  ])('rejeita CPF com todos os dígitos iguais: %s', (cpf) => {
    expect(isValidCpf(cpf)).toBe(false)
  })

  // Casos de borda — comprimento e formato
  it('rejeita string vazia', () => {
    expect(isValidCpf('')).toBe(false)
  })

  it('rejeita CPF com menos de 11 dígitos', () => {
    expect(isValidCpf('1234567890')).toBe(false)
  })

  it('rejeita CPF com mais de 11 dígitos', () => {
    expect(isValidCpf('123456789012')).toBe(false)
  })

  it('rejeita string com apenas letras', () => {
    expect(isValidCpf('abcdefghijk')).toBe(false)
  })
})
