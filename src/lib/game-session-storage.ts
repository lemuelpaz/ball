const STORAGE_KEYS = {
  GANHOS: 'ganhos',
  POPS: 'pops',
} as const

export interface DadosSessao {
  ganhos: number
  pops: number
}

export function saveSessionData(dados: DadosSessao): void {
  sessionStorage.setItem(STORAGE_KEYS.GANHOS, String(dados.ganhos))
  sessionStorage.setItem(STORAGE_KEYS.POPS, String(dados.pops))
}

export function loadSessionData(): DadosSessao {
  const ganhos = sessionStorage.getItem(STORAGE_KEYS.GANHOS)
  const pops = sessionStorage.getItem(STORAGE_KEYS.POPS)

  return {
    ganhos: ganhos !== null ? Number(ganhos) : 0,
    pops: pops !== null ? Number(pops) : 0,
  }
}

export function clearSessionData(): void {
  sessionStorage.removeItem(STORAGE_KEYS.GANHOS)
  sessionStorage.removeItem(STORAGE_KEYS.POPS)
}