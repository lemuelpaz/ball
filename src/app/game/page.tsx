'use client'
import { useState, useEffect, useCallback, useRef, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

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

const SESSION_KEY_POPS    = 'game_session_pops'
const SESSION_KEY_EARNINGS = 'game_session_earnings'

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

function readSessionInt(key: string): number {
  try {
    const raw = sessionStorage.getItem(key)
    if (raw === null) return 0
    const parsed = parseInt(raw, 10)
    return Number.isFinite(parsed) ? parsed : 0
  } catch {
    return 0
  }
}

function readSessionFloat(key: string): number {
  try {
    const raw = sessionStorage.getItem(key)
    if (raw === null) return 0
    const parsed = parseFloat(raw)
    return Number.isFinite(parsed) ? parsed : 0
  } catch {
    return 0
  }
}

function clearSessionGameKeys() {
  try {
    sessionStorage.removeItem(SESSION_KEY_POPS)
    sessionStorage.removeItem(SESSION_KEY_EARNINGS)
  } catch {
    // sessionStorage indisponível — sem ação necessária
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

  useEffect(() => {
    const t = localStorage.getItem('gameToken')
    if (!t) { router.replace('/'); return }
    setToken(t)

    Promise.all([
      fetch('/api/wallet/balance', { headers: { Authorization: `Bearer ${t}` } }).then(r => r.json()),
      fetch('/api/admin/config').then(r => r.json()),
    ]).then(([walletData, cfgData]) => {
      // O saldo vem sempre do servidor — nunca do sessionStorage
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

  const handleDeposited = useCallback((newBalance: number) => {
    setBalance(newBalance)
    setPhase('game')
  }, [])

  const handleEndSession = useCallback(() => {
    clearSessionGameKeys()
    router.replace('/')
  }, [router])

  if (phase === 'loading') return <LoadingScreen />
  if (phase === 'deposit') return <DepositScreen token={token} onDeposited={handleDeposited} />
  return (
    <ActiveGame
      token={token}
      serverBalance={balance}
      cfg={cfg}
      onEndSession={handleEndSession}
    />
  )
}

/* ═══════════════════════════════════════════════════
   Loading
═══════════════════════════════════════════════════ */
function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="text-white text-2xl animate-pulse">Carregando…</div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   Deposit
═══════════════════════════════════════════════════ */
interface DepositProps {
  token: string
  onDeposited: (newBalance: number) => void
}

function DepositScreen({ token, onDeposited }: DepositProps) {
  const [amount,  setAmount]  = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  async function handleDeposit(e: FormEvent) {
    e.preventDefault()
    const value = parseFloat(amount)
    if (!value || value <= 0) { setError('Valor inválido'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/wallet/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: value }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erro ao depositar'); return }
      onDeposited(data.balance)
    } catch {
      setError('Falha na conexão')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 w-full max-w-md text-white">
        <h1 className="text-3xl font-bold text-center mb-2">🎈 Estoura Balões</h1>
        <p className="text-center text-white/70 mb-8">Faça um depósito para começar</p>

        <form onSubmit={handleDeposit} className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {PRESET_AMOUNTS.map(v => (
              <button key={v} type="button"
                className="bg-white/20 hover:bg-white/30 rounded-xl py-2 font-semibold transition"
                onClick={() => setAmount(String(v))}>
                R$ {v}
              </button>
            ))}
          </div>

          <input
            type="number" min="1" step="0.01"
            placeholder="Outro valor (R$)"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="w-full bg-white/20 rounded-xl px-4 py-3 text-white placeholder-white/50 outline-none"
          />

          {error && <p className="text-red-300 text-sm text-center">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 rounded-xl py-3 font-bold text-lg transition">
            {loading ? 'Processando…' : 'Depositar e Jogar'}
          </button>
        </form>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   Active Game
═══════════════════════════════════════════════════ */
interface ActiveGameProps {
  token: string
  serverBalance: number
  cfg: GameCfg
  onEndSession: () => void
}

function ActiveGame({ token, serverBalance, cfg, onEndSession }: ActiveGameProps) {
  const [balloons,  setBalloons]  = useState<Balloon[]>([])
  const [fxMoney,   setFxMoney]   = useState<FxMoney[]>([])
  const [fxParticles, setFxParticles] = useState<FxParticle[]>([])

  // Inicialização lazy lendo do sessionStorage para sobreviver a recargas acidentais
  const [pops,     setPops]     = useState<number>(() => readSessionInt(SESSION_KEY_POPS))
  const [earnings, setEarnings] = useState<number>(() => readSessionFloat(SESSION_KEY_EARNINGS))

  const [balance,  setBalance]  = useState(serverBalance)
  const [popping,  setPopping]  = useState<Record<string, boolean>>({})
  const [ending,   setEnding]   = useState(false)
  const [endError, setEndError] = useState('')

  const areaRef  = useRef<HTMLDivElement>(null)
  const spawnRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Sincroniza pops no sessionStorage sempre que mudar
  useEffect(() => {
    try { sessionStorage.setItem(SESSION_KEY_POPS, String(pops)) } catch { /* indisponível */ }
  }, [pops])

  // Sincroniza earnings no sessionStorage sempre que mudar
  useEffect(() => {
    try { sessionStorage.setItem(SESSION_KEY_EARNINGS, String(earnings)) } catch { /* indisponível */ }
  }, [earnings])

  // O saldo exibido acompanha o serverBalance caso o componente receba uma atualização externa,
  // mas nunca é substituído pelo valor armazenado no sessionStorage
  useEffect(() => {
    setBalance(serverBalance)
  }, [serverBalance])

  // Spawn de balões
  useEffect(() => {
    spawnRef.current = setInterval(() => {
      setBalloons(prev => {
        const alive = prev.filter(b => !b.popped)
        if (alive.length >= cfg.maxB) return prev
        return [...prev, mkBalloon(cfg)]
      })
    }, cfg.spawnMs)
    return () => { if (spawnRef.current) clearInterval(spawnRef.current) }
  }, [cfg])

  // Remoção de balões que saíram da tela
  useEffect(() => {
    const id = setInterval(() => {
      setBalloons(prev => prev.filter(b => !b.popped))
    }, 2000)
    return () => clearInterval(id)
  }, [])

  const popBalloon = useCallback(async (balloon: Balloon) => {
    if (balloon.popped || popping[balloon.id]) return
    setPopping(p => ({ ...p, [balloon.id]: true }))
    setBalloons(prev => prev.map(b => b.id === balloon.id ? { ...b, popped: true } : b))

    // Efeito visual de partículas
    const px = balloon.x
    const py = 50
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
    }, 700)

    try {
      const res = await fetch('/api/game/pop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ balloonId: balloon.id, value: balloon.value }),
      })
      const data = await res.json()
      if (!res.ok) return

      const gained: number = data.earned ?? balloon.value
      setBalance(data.balance ?? (b => b - balloon.value))
      setPops(p => p + 1)
      setEarnings(e => parseFloat((e + gained).toFixed(2)))

      // Efeito de texto monetário
      const fx: FxMoney = { id: uid(), x: balloon.x, y: 40, value: gained }
      setFxMoney(prev => [...prev, fx])
      setTimeout(() => setFxMoney(prev => prev.filter(f => f.id !== fx.id)), 1000)
    } finally {
      setPopping(p => { const next = { ...p }; delete next[balloon.id]; return next })
    }
  }, [token, popping])

  const handleEndSession = useCallback(async () => {
    setEnding(true); setEndError('')
    try {
      await fetch('/api/game/end', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch {
      // Encerra localmente mesmo que o servidor falhe
    }
    // Remove as chaves antes de navegar
    clearSessionGameKeys()
    onEndSession()
  }, [token, onEndSession])

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-400 via-sky-300 to-sky-200 relative overflow-hidden select-none">

      {/* HUD */}
      <div className="absolute top-0 left-0 right