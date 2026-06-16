import { describe, it, expect, afterEach } from 'vitest'
import { validateEnvConfig } from '../auth'

describe('validateEnvConfig', () => {
  const original = process.env.JWT_SECRET

  afterEach(() => {
    if (original === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = original
  })

  it('lanca erro quando JWT_SECRET nao esta definido', () => {
    delete process.env.JWT_SECRET
    expect(() => validateEnvConfig()).toThrow()
  })

  it('mensagem de erro menciona JWT_SECRET', () => {
    delete process.env.JWT_SECRET
    expect(() => validateEnvConfig()).toThrow(/JWT_SECRET/)
  })

  it('lanca erro quando JWT_SECRET e string vazia', () => {
    process.env.JWT_SECRET = ''
    expect(() => validateEnvConfig()).toThrow(/JWT_SECRET/)
  })

  it('nao lanca erro quando JWT_SECRET esta definido', () => {
    process.env.JWT_SECRET = 'segredo-seguro-para-testes-123'
    expect(() => validateEnvConfig()).not.toThrow()
  })

  it('nao lanca erro para secrets longos e complexos', () => {
    process.env.JWT_SECRET = 'uM-s3gr3d0-muito-longo-e-complexo-com-simbolos-!@#'
    expect(() => validateEnvConfig()).not.toThrow()
  })
})
