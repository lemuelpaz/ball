'use client'
import { useState, useEffect, useCallback, useRef, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import {
  loadGameSession,
  saveGameSession,
} from '@/lib/game-session-storage'

/* ═══════════════════════════════════════════════════
   Types
═══════════════════════════════════════════════════ */
type Phase = 'loading' | 'deposit' | 'game'

interface Balloon {
  id: string; x: number; value: number
  color: string; size: number; speed: number; popped: boolean
}
interface FxMoney   { id: string; x: number; y: number; value: number }
interface FxParticle { id: string; x: number; y: number; tx: number; ty: number; color: string }

interface GameCfg {
  values: number[]; spawnMs: number
  minSpd: number; maxSpd: number
  minSz: number;  maxSz: number; maxB: number
}

const DEFAULT_CFG: GameCfg = {
  values: [0.10, 0.25, 0.50, 1.00, 2.00, 5.00],
  spawnMs: 1500, minSpd: 4, maxSpd: 8,
  minSz: 68, maxSz: 98, maxB: 8,
}

const COLORS = [
  '#FF6B6B','#FF8E53','#4ECDC4','#45B7D1',
  '#A78BFA','#F472B6','#34D399','#FBBF24','#60A5FA','#F97316',
]

const PRESET_AMOUNTS = [10, 20, 50, 100, 200, 500]

let _seq = 0
function uid() { return `${Date.now()}-${_seq++}` }

function mkBalloon(cfg: GameCfg): Balloon {
  return {
    id: uid(),
    x: 4 + Math.random() * 84,
    value: cfg.values[Math.floor(Math.random() * cfg.values.length)],
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    size: cfg.minSz + Math.random() * (cfg.maxSz - cfg.minSz),
    speed: cfg.minSpd + Math.random() * (cfg.maxSpd - cfg.minSpd),
    popped: false,
  }
}

/* ═══════════════════════════════════════════════════
   Main Page — state machine
═══════════════════════════════════════════════════ */
export default function GamePage() {
  const router  = useRouter()
  const [phase,   setPhase]   = useState<Phase>('loading')
  const [token,   setToken]   = useState('')
  const [balance, setBalance] = useState(0)
  const [cfg,     setCfg]     = useState<GameCfg>(DEFAULT_CFG)
  const [session, setSessionState] = useState(0)
  const [pops,    setPopsState]    = useState(0)

  /* Persiste session e pops sempre que um deles mudar */
  useEffect(() => {
    if (phase !== 'game') return
    saveGameSession({ session, pops })
  }, [session, pops, phase])

  const setSession = useCallback((updater: number | ((prev: number) => number)) => {
    setSessionState(updater)
  }, [])

  const setPops = useCallback((updater: number | ((prev: number) => number)) => {
    setPopsState(updater)
  }, [])

  useEffect(() => {
    const t = localStorage.getItem('gameToken')
    if (!t) { router.replace('/'); return }
    setToken(t)

    /* Restaura dados de sessão do sessionStorage antes de buscar saldo */
    const saved = loadGameSession()
    if (saved) {
      setSessionState(saved.session)
      setPopsState(saved.pops)
    }

    Promise.all([
      fetch('/api/wallet/balance', { headers: { Authorization: `Bearer ${t}` } }).then(r => r.json()),
      fetch('/api/admin/config').then(r => r.json()),
    ]).then(([walletData, cfgData]) => {
      /* Saldo sempre vem do servidor */
      const bal = walletData.balance ?? 0
      setBalance(bal)

      if (cfgData.game_balloon_values) {
        setCfg({
          values:  cfgData.game_balloon_values.split(',').map(Number),
          spawnMs: parseInt(cfgData.game_spawn_interval ?? '1500'),
          minSpd:  parseFloat(cfgData.game_min_speed ?? '4'),
          maxSpd:  parseFloat(cfgData.game_max_speed ?? '8'),
          minSz:   parseFloat(cfgData.game_min_size  ?? '68'),
          maxSz:   parseFloat(cfgData.game_max_size  ?? '98'),
          maxB:    parseInt(cfgData.game_max_balloons ?? '8'),
        })
      }
      setPhase(bal > 0 ? 'game' : 'deposit')
    }).catch(() => {
      setPhase('deposit')
    })
  }, [router])

  const hand = useCallback(
    (balloon: Balloon) => {
      if (balloon.popped) return
      setSession(prev => prev + balloon.value)
      setPops(prev => prev + 1)
    },
    [setSession, setPops],
  )

  if (phase === 'loading') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-900">
        <p className="text-white text-xl animate-pulse">Carregando…</p>
      </main>
    )
  }

  if (phase === 'deposit') {
    return (
      <DepositScreen
        token={token}
        onDeposited={(newBalance) => {
          setBalance(newBalance)
          setPhase('game')
        }}
      />
    )
  }

  return (
    <ActiveGame
      token={token}
      balance={balance}
      setBalance={setBalance}
      cfg={cfg}
      session={session}
      pops={pops}
      onPop={hand}
    />
  )
}

/* ═══════════════════════════════════════════════════
   DepositScreen
═══════════════════════════════════════════════════ */
interface DepositScreenProps {
  token: string
  onDeposited: (balance: number) => void
}

function DepositScreen({ token, onDeposited }: DepositScreenProps) {
  const [amount,      setAmount]      = useState('')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')
  const [pixPayload,  setPixPayload]  = useState('')
  const [awaitingPix, setAwaitingPix] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const value = parseFloat(amount)
    if (!value || value <= 0) { setError('Informe um valor válido.'); return }
    setLoading(true); setError('')

    try {
      const res = await fetch('/api/wallet/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: value }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erro ao processar depósito.'); return }

      if (data.pixPayload) {
        setPixPayload(data.pixPayload)
        setAwaitingPix(true)
        pollBalance(token, onDeposited)
        return
      }
      if (data.balance !== undefined) { onDeposited(data.balance); return }
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
      <div className="bg-gray-800 rounded-2xl p-8 w-full max-w-md shadow-2xl">
        <h1 className="text-2xl font-bold text-white mb-2 text-center">Faça um depósito</h1>
        <p className="text-gray-400 text-center mb-6">Seu saldo está zerado. Deposite para jogar!</p>

        {awaitingPix ? (
          <div className="text-center space-y-4">
            <p className="text-green-400 font-semibold">PIX gerado! Aguardando pagamento…</p>
            <div className="bg-gray-700 rounded-xl p-4 break-all text-xs text-gray-300 select-all">
              {pixPayload}
            </div>
            <p className="text-gray-400 text-sm">A página será atualizada automaticamente após a confirmação.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {PRESET_AMOUNTS.map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAmount(String(v))}
                  className="py-2 rounded-lg bg-gray-700 hover:bg-purple-600 text-white text-sm font-medium transition-colors"
                >
                  R$ {v}
                </button>
              ))}
            </div>

            <input
              type="number"
              min="1"
              step="0.01"
              placeholder="Outro valor (R$)"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full bg-gray-700 text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-purple-500"
            />

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold transition-colors"
            >
              {loading ? 'Processando…' : 'Depositar'}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}

function pollBalance(token: string, onDeposited: (balance: number) => void) {
  const INTERVAL_MS = 3000
  const MAX_ATTEMPTS = 20
  let attempts = 0

  const id = setInterval(async () => {
    attempts++
    try {
      const res  = await fetch('/api/wallet/balance', { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if ((data.balance ?? 0) > 0) {
        clearInterval(id)
        onDeposited(data.balance)
      }
    } catch { /* ignora erros de rede durante o polling */ }

    if (attempts >= MAX_ATTEMPTS) clearInterval(id)
  }, INTERVAL_MS)
}

/* ═══════════════════════════════════════════════════
   ActiveGame
═══════════════════════════════════════════════════ */
interface ActiveGameProps {
  token:      string
  balance:    number
  setBalance: (b: number) => void
  cfg:        GameCfg
  session:    number
  pops:       number
  onPop:      (balloon: Balloon) => void
}

function ActiveGame({ token, balance, setBalance, cfg, session, pops, onPop }: ActiveGameProps) {
  const [balloons,   setBalloons]   = useState<Balloon[]>([])
  const [fxMoney,    setFxMoney]    = useState<FxMoney[]>([])
  const [fxParticles,setFxParticles]= useState<FxParticle[]>([])
  const [paused,     setPaused]     = useState(false)
  const pausedRef = useRef(paused)
  pausedRef.current = paused

  /* Spawn de balões */
  useEffect(() => {
    const id = setInterval(() => {
      if (pausedRef.current) return
      setBalloons(prev => {
        if (prev.filter(b => !b.popped).length >= cfg.maxB) return prev
        return [...prev, mkBalloon(cfg)]
      })
    }, cfg.spawnMs)
    return () => clearInterval(id)
  }, [cfg])

  /* Remove balões que saíram da tela */
  useEffect(() => {
    const id = setInterval(() => {
      setBalloons(prev => prev.filter(b => b.popped || b.x < 110))
    }, 2000)
    return () => clearInterval(id)
  }, [])

  async function handlePop(balloon: Balloon) {
    if (balloon.popped || paused) return

    setBalloons(prev => prev.map(b => b.id === balloon.id ? { ...b, popped: true } : b))

    const px = balloon.x
    const py = 50

    /* Efeito visual de dinheiro */
    const fxId = uid()
    setFxMoney(prev => [...prev, { id: fxId, x: px, y: py, value: balloon.value }])
    setTimeout(() => setFxMoney(prev => prev.filter(f => f.id !== fxId)), 900)

    /* Partículas */
    const particles: FxParticle[] = Array.from({ length: 8 }, () => ({
      id: uid(),
      x: px, y: py,
      tx: px + (Math.random() - 0.5) * 20,
      ty: py + (Math.random() - 0.5) * 20,
      color: balloon.color,
    }))
    setFxParticles(prev => [...prev, ...particles])
    setTimeout(() => {
      setFxParticles(prev => prev.filter(p => !particles.find(pp => pp.id === p.id)))
    }, 600)

    onPop(balloon)

    /* Registra o pop na API e atualiza o saldo do servidor */
    try {
      const res  = await fetch('/api/game/pop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ value: balloon.value }),
      })
      const data = await res.json()
      if (data.balance !== undefined) setBalance(data.balance)
    } catch { /* falha silenciosa — saldo será sincronizado na próxima ação */ }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-400 to-blue-600 relative overflow-hidden select-none">
      {/* HUD */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-black/20 backdrop-blur-sm">
        <div className="text-white">
          <p className="text-xs opacity-70">Saldo</p>
          <p className="text-lg font-bold">R$ {balance.toFixed(2)}</p>
        </div>
        <div className="text-white text-center">
          <p className="text-xs opacity-