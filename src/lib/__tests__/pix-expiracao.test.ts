import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { calcularTempoRestante, pixExpirado } from '@/lib/pix-expiracao'

const DURACAO_PIX_SEGUNDOS = 30 * 60 // 1800

describe('calcularTempoRestante', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('retorna a duração total quando o PIX acabou de ser criado', () => {
    const agora = Date.now()
    vi.setSystemTime(agora)
    const criadoEm = new Date(agora)

    const resultado = calcularTempoRestante(criadoEm)

    expect(resultado).toBe(DURACAO_PIX_SEGUNDOS)
  })

  it('retorna o tempo restante correto após alguns segundos', () => {
    const inicio = Date.now()
    const criadoEm = new Date(inicio)
    const segundosDecorridos = 120

    vi.setSystemTime(inicio + segundosDecorridos * 1000)

    const resultado = calcularTempoRestante(criadoEm)

    expect(resultado).toBe(DURACAO_PIX_SEGUNDOS - segundosDecorridos)
  })

  it('retorna 0 quando o PIX expirou exatamente no limite', () => {
    const inicio = Date.now()
    const criadoEm = new Date(inicio)

    vi.setSystemTime(inicio + DURACAO_PIX_SEGUNDOS * 1000)

    const resultado = calcularTempoRestante(criadoEm)

    expect(resultado).toBe(0)
  })

  it('retorna 0 quando o PIX expirou há mais tempo que o limite', () => {
    const inicio = Date.now()
    const criadoEm = new Date(inicio)

    vi.setSystemTime(inicio + (DURACAO_PIX_SEGUNDOS + 600) * 1000)

    const resultado = calcularTempoRestante(criadoEm)

    expect(resultado).toBe(0)
  })

  it('retorna 0 quando a data de criação é futura (entrada inválida)', () => {
    const agora = Date.now()
    vi.setSystemTime(agora)
    const criadoEm = new Date(agora + 60 * 1000)

    const resultado = calcularTempoRestante(criadoEm)

    expect(resultado).toBe(0)
  })

  it('retorna 0 para Date inválido (NaN)', () => {
    const resultado = calcularTempoRestante(new Date('data-invalida'))

    expect(resultado).toBe(0)
  })

  it('não expõe informações sensíveis no retorno — apenas número inteiro', () => {
    const agora = Date.now()
    vi.setSystemTime(agora)
    const criadoEm = new Date(agora)

    const resultado = calcularTempoRestante(criadoEm)

    expect(typeof resultado).toBe('number')
    expect(Number.isFinite(resultado)).toBe(true)
    expect(resultado).toBeGreaterThanOrEqual(0)
  })
})

describe('pixExpirado', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('retorna false quando o PIX foi criado agora', () => {
    const agora = Date.now()
    vi.setSystemTime(agora)
    const criadoEm = new Date(agora)

    expect(pixExpirado(criadoEm)).toBe(false)
  })

  it('retorna false quando ainda há tempo restante', () => {
    const inicio = Date.now()
    const criadoEm = new Date(inicio)

    vi.setSystemTime(inicio + 10 * 60 * 1000) // 10 minutos depois

    expect(pixExpirado(criadoEm)).toBe(false)
  })

  it('retorna true exatamente quando o limite de 30 minutos é atingido', () => {
    const inicio = Date.now()
    const criadoEm = new Date(inicio)

    vi.setSystemTime(inicio + DURACAO_PIX_SEGUNDOS * 1000)

    expect(pixExpirado(criadoEm)).toBe(true)
  })

  it('retorna true quando o PIX expirou há muito tempo', () => {
    const inicio = Date.now()
    const criadoEm = new Date(inicio)

    vi.setSystemTime(inicio + 2 * DURACAO_PIX_SEGUNDOS * 1000)

    expect(pixExpirado(criadoEm)).toBe(true)
  })

  it('retorna true para Date inválido (entrada maliciosa / corrompida)', () => {
    expect(pixExpirado(new Date('invalido'))).toBe(true)
  })

  it('retorna true para data de criação futura (inconsistência de relógio / manipulação)', () => {
    const agora = Date.now()
    vi.setSystemTime(agora)
    const criadoEm = new Date(agora + 5 * 60 * 1000)

    // Data no futuro não deve conceder tempo extra; trata como expirado por segurança
    expect(pixExpirado(criadoEm)).toBe(true)
  })

  it('retorna booleano puro — sem vazar dados internos', () => {
    const criadoEm = new Date(Date.now())
    const resultado = pixExpirado(criadoEm)

    expect(typeof resultado).toBe('boolean')
  })
})