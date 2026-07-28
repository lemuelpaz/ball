import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTempoDeSessao } from '@/lib/session-timer'

describe('useTempoDeSessao', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('inicia o contador em zero', () => {
    const { result } = renderHook(() => useTempoDeSessao(true))

    expect(result.current.segundos).toBe(0)
  })

  it('incrementa a cada segundo quando running=true', () => {
    const { result } = renderHook(() => useTempoDeSessao(true))

    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(result.current.segundos).toBe(3)
  })

  it('não incrementa quando running=false', () => {
    const { result } = renderHook(() => useTempoDeSessao(false))

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(result.current.segundos).toBe(0)
  })

  it('pausa o incremento ao mudar running para false', () => {
    const { result, rerender } = renderHook(
      ({ running }: { running: boolean }) => useTempoDeSessao(running),
      { initialProps: { running: true } }
    )

    act(() => {
      vi.advanceTimersByTime(4000)
    })

    expect(result.current.segundos).toBe(4)

    rerender({ running: false })

    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(result.current.segundos).toBe(4)
  })

  it('retoma a contagem ao mudar running para true novamente', () => {
    const { result, rerender } = renderHook(
      ({ running }: { running: boolean }) => useTempoDeSessao(running),
      { initialProps: { running: true } }
    )

    act(() => {
      vi.advanceTimersByTime(2000)
    })

    rerender({ running: false })

    act(() => {
      vi.advanceTimersByTime(2000)
    })

    rerender({ running: true })

    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(result.current.segundos).toBe(5)
  })

  it('limpa o intervalo ao desmontar o hook', () => {
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval')

    const { unmount } = renderHook(() => useTempoDeSessao(true))

    unmount()

    expect(clearIntervalSpy.mock.calls.length).toBeGreaterThan(0)
  })

  describe('formatacao MM:SS', () => {
    it('formata zero como 00:00', () => {
      const { result } = renderHook(() => useTempoDeSessao(false))

      expect(result.current.formatado).toBe('00:00')
    })

    it('formata 65 segundos como 01:05', () => {
      const { result } = renderHook(() => useTempoDeSessao(true))

      act(() => {
        vi.advanceTimersByTime(65000)
      })

      expect(result.current.formatado).toBe('01:05')
    })

    it('formata 59 segundos como 00:59', () => {
      const { result } = renderHook(() => useTempoDeSessao(true))

      act(() => {
        vi.advanceTimersByTime(59000)
      })

      expect(result.current.formatado).toBe('00:59')
    })

    it('formata 600 segundos como 10:00', () => {
      const { result } = renderHook(() => useTempoDeSessao(true))

      act(() => {
        vi.advanceTimersByTime(600000)
      })

      expect(result.current.formatado).toBe('10:00')
    })

    it('formata 3661 segundos como 61:01', () => {
      const { result } = renderHook(() => useTempoDeSessao(true))

      act(() => {
        vi.advanceTimersByTime(3661000)
      })

      expect(result.current.formatado).toBe('61:01')
    })
  })
})