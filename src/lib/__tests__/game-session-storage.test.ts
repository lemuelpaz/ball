import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  salvarGanhos,
  recuperarGanhos,
  salvarPops,
  recuperarPops,
  limparSessao,
} from '@/lib/game-session-storage'

describe('game-session-storage', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  afterEach(() => {
    sessionStorage.clear()
  })

  describe('ganhos', () => {
    it('deve salvar e recuperar o valor de ganhos corretamente', () => {
      salvarGanhos(150.75)

      expect(recuperarGanhos()).toBe(150.75)
    })

    it('deve retornar zero quando não há ganhos salvos', () => {
      expect(recuperarGanhos()).toBe(0)
    })

    it('deve sobrescrever ganhos anteriores ao salvar novo valor', () => {
      salvarGanhos(100)
      salvarGanhos(250.5)

      expect(recuperarGanhos()).toBe(250.5)
    })

    it('deve preservar ganhos após simular refresh (reler do sessionStorage)', () => {
      salvarGanhos(99.99)

      // Simula refresh: lê diretamente do sessionStorage como se fosse nova montagem
      const valorAposRefresh = recuperarGanhos()

      expect(valorAposRefresh).toBe(99.99)
    })

    it('deve retornar zero após sessionStorage.clear simular fechamento de aba', () => {
      salvarGanhos(300)
      sessionStorage.clear()

      expect(recuperarGanhos()).toBe(0)
    })

    it('deve salvar ganhos com valor zero sem erro', () => {
      salvarGanhos(0)

      expect(recuperarGanhos()).toBe(0)
    })

    it('deve salvar ganhos negativos sem alterar o valor', () => {
      salvarGanhos(-50)

      expect(recuperarGanhos()).toBe(-50)
    })
  })

  describe('pops', () => {
    it('deve salvar e recuperar o número de pops corretamente', () => {
      salvarPops(7)

      expect(recuperarPops()).toBe(7)
    })

    it('deve retornar zero quando não há pops salvos', () => {
      expect(recuperarPops()).toBe(0)
    })

    it('deve sobrescrever pops anteriores ao salvar novo valor', () => {
      salvarPops(3)
      salvarPops(10)

      expect(recuperarPops()).toBe(10)
    })

    it('deve preservar pops após simular refresh (reler do sessionStorage)', () => {
      salvarPops(42)

      const valorAposRefresh = recuperarPops()

      expect(valorAposRefresh).toBe(42)
    })

    it('deve retornar zero após sessionStorage.clear simular fechamento de aba', () => {
      salvarPops(15)
      sessionStorage.clear()

      expect(recuperarPops()).toBe(0)
    })

    it('deve salvar pops com valor zero sem erro', () => {
      salvarPops(0)

      expect(recuperarPops()).toBe(0)
    })
  })

  describe('limparSessao', () => {
    it('deve zerar ganhos e pops ao chamar limparSessao', () => {
      salvarGanhos(500)
      salvarPops(20)

      limparSessao()

      expect(recuperarGanhos()).toBe(0)
      expect(recuperarPops()).toBe(0)
    })

    it('deve funcionar sem erro mesmo quando sessionStorage já está vazio', () => {
      expect(() => limparSessao()).not.toThrow()
    })
  })

  describe('isolamento do saldo', () => {
    it('não deve armazenar saldo no sessionStorage', () => {
      salvarGanhos(200)
      salvarPops(5)

      const chaves = Object.keys(sessionStorage)
      const temSaldo = chaves.some((chave) =>
        chave.toLowerCase().includes('saldo') ||
        chave.toLowerCase().includes('balance') ||
        chave.toLowerCase().includes('wallet')
      )

      expect(temSaldo).toBe(false)
    })

    it('deve conter apenas as chaves de ganhos e pops após salvar sessão', () => {
      salvarGanhos(100)
      salvarPops(3)

      const chaves = Object.keys(sessionStorage)

      // Confirma que apenas as chaves esperadas estão presentes
      expect(chaves.length).toBeGreaterThanOrEqual(2)
      chaves.forEach((chave) => {
        const ehChaveEsperada =
          chave.toLowerCase().includes('ganho') ||
          chave.toLowerCase().includes('pop') ||
          chave.toLowerCase().includes('earning') ||
          chave.toLowerCase().includes('session')
        expect(ehChaveEsperada).toBe(true)
      })
    })
  })
})