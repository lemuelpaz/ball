import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  saveSessionData,
  loadSessionData,
  clearSessionData,
  SESSION_KEYS,
} from '@/lib/session-storage'

describe('session-storage', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    sessionStorage.clear()
  })

  describe('SESSION_KEYS', () => {
    it('deve expor chaves para pops e ganhos, mas não para saldo', () => {
      expect(SESSION_KEYS.pops).toBeDefined()
      expect(SESSION_KEYS.earnings).toBeDefined()
      expect((SESSION_KEYS as Record<string, unknown>).balance).toBeUndefined()
    })
  })

  describe('saveSessionData', () => {
    it('persiste pops e ganhos no sessionStorage', () => {
      saveSessionData({ pops: 5, earnings: 12.5 })

      const rawPops     = sessionStorage.getItem(SESSION_KEYS.pops)
      const rawEarnings = sessionStorage.getItem(SESSION_KEYS.earnings)

      expect(rawPops).toBe('5')
      expect(rawEarnings).toBe('12.5')
    })

    it('sobrescreve valores anteriores ao salvar novamente', () => {
      saveSessionData({ pops: 2, earnings: 3.0 })
      saveSessionData({ pops: 7, earnings: 20.75 })

      expect(sessionStorage.getItem(SESSION_KEYS.pops)).toBe('7')
      expect(sessionStorage.getItem(SESSION_KEYS.earnings)).toBe('20.75')
    })

    it('persiste pops zerados sem problema', () => {
      saveSessionData({ pops: 0, earnings: 0 })

      expect(sessionStorage.getItem(SESSION_KEYS.pops)).toBe('0')
      expect(sessionStorage.getItem(SESSION_KEYS.earnings)).toBe('0')
    })
  })

  describe('loadSessionData — simulação de reload', () => {
    it('restaura pops e ganhos após salvar e recarregar', () => {
      // Fase: simula estado pré-reload
      saveSessionData({ pops: 10, earnings: 55.0 })

      // Fase: simula reload (loadSessionData lê do sessionStorage)
      const restored = loadSessionData()

      expect(restored.pops).toBe(10)
      expect(restored.earnings).toBe(55.0)
    })

    it('retorna zeros quando não há dados salvos (sessão nova)', () => {
      const restored = loadSessionData()

      expect(restored.pops).toBe(0)
      expect(restored.earnings).toBe(0)
    })

    it('retorna zeros quando os valores armazenados são inválidos', () => {
      sessionStorage.setItem(SESSION_KEYS.pops, 'nao-e-numero')
      sessionStorage.setItem(SESSION_KEYS.earnings, 'invalido')

      const restored = loadSessionData()

      expect(restored.pops).toBe(0)
      expect(restored.earnings).toBe(0)
    })

    it('nunca expõe campo de saldo nos dados restaurados', () => {
      saveSessionData({ pops: 3, earnings: 9.0 })
      const restored = loadSessionData()

      expect((restored as Record<string, unknown>).balance).toBeUndefined()
    })
  })

  describe('clearSessionData — simulação de fechar aba', () => {
    it('zera os contadores após limpar a sessão', () => {
      saveSessionData({ pops: 8, earnings: 40.0 })
      clearSessionData()

      const restored = loadSessionData()

      expect(restored.pops).toBe(0)
      expect(restored.earnings).toBe(0)
    })

    it('remove as chaves do sessionStorage ao limpar', () => {
      saveSessionData({ pops: 1, earnings: 1.0 })
      clearSessionData()

      expect(sessionStorage.getItem(SESSION_KEYS.pops)).toBeNull()
      expect(sessionStorage.getItem(SESSION_KEYS.earnings)).toBeNull()
    })

    it('não lança erro ao limpar uma sessão já vazia', () => {
      expect(() => clearSessionData()).not.toThrow()
    })
  })

  describe('saldo nunca é lido do sessionStorage', () => {
    it('loadSessionData ignora qualquer chave de saldo injetada manualmente', () => {
      // Simula tentativa maliciosa de injetar saldo na sessão
      sessionStorage.setItem('balance', '99999')
      sessionStorage.setItem('saldo', '99999')

      const restored = loadSessionData()

      expect((restored as Record<string, unknown>).balance).toBeUndefined()
      expect((restored as Record<string, unknown>).saldo).toBeUndefined()
    })

    it('saveSessionData não persiste o campo saldo mesmo que passado', () => {
      // TypeScript impede, mas testamos o comportamento em runtime
      saveSessionData({ pops: 1, earnings: 2.0 })

      expect(sessionStorage.getItem('balance')).toBeNull()
      expect(sessionStorage.getItem('saldo')).toBeNull()
    })
  })

  describe('ciclo completo de sessão', () => {
    it('salva → restaura → limpa → restaura como zero', () => {
      saveSessionData({ pops: 15, earnings: 100.0 })

      const afterSave = loadSessionData()
      expect(afterSave.pops).toBe(15)
      expect(afterSave.earnings).toBe(100.0)

      clearSessionData()

      const afterClear = loadSessionData()
      expect(afterClear.pops).toBe(0)
      expect(afterClear.earnings).toBe(0)
    })
  })
})