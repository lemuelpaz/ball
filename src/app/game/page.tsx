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

function formatSessionTime(seconds: number): string {
  const mm = Math.floor(seconds / 60).toString().padStart(2, '0')
  const ss = (seconds % 60).toString().padStart(2, '0')
  return `${mm}:${ss}`
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

  const [sessionSeconds, setSessionSeconds] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const running = phase === 'game'

  useEffect(() => {
    if (running) {
      timerRef.current = setInterval(() => {
        setSessionSeconds(s => s + 1)
      }, 1000)
    } else {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [running])

  useEffect(() => {
    const t = localStorage.getItem('gameToken')
    if (!t) { router.replace('/'); return }
    setToken(t)

    Promise.all([
      fetch('/api/wallet/balance', { headers: { Authorization: `Bearer ${t}` } }).then(r => r.json()),
      fetch('/api/admin/config').then(r => r.json()),
    ]).then(([walletData, cfgData]) => {
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

  const handleLogout = useCallback(() => {
    setSessionSeconds(0)
    localStorage.removeItem('gameToken')
    router.replace('/')
  }, [router])

  const hand = handleLogout

  const sessionTimeDisplay = formatSessionTime(sessionSeconds)

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* HUD top bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-gray-800 border-b border-gray-700">
        <span className="text-lg font-bold tracking-wide">🎈 BalloonGame</span>
        <div className="flex items-center gap-6">
          {phase === 'game' && (
            <span className="font-mono text-sm text-yellow-300 tracking-widest" aria-label="session timer">
              ⏱ {sessionTimeDisplay}
            </span>
          )}
          <span className="text-sm text-green-400 font-semibold">
            💰 ${balance.toFixed(2)}
          </span>
          <button
            onClick={handleLogout}
            className="text-xs text-gray-400 hover:text-red-400 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Phase: loading */}
      {phase === 'loading' && (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-gray-400 animate-pulse text-lg">Loading…</span>
        </div>
      )}

      {/* Phase: deposit */}
      {phase === 'deposit' && (
        <DepositView
          token={token}
          onDeposited={(newBal) => {
            setBalance(newBal)
            setSessionSeconds(0)
            setPhase('game')
          }}
        />
      )}

      {/* Phase: game */}
      {phase === 'game' && (
        <GameView
          token={token}
          balance={balance}
          cfg={cfg}
          onBalanceChange={setBalance}
          onBalanceEmpty={() => setPhase('deposit')}
        />
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   DepositView
═══════════════════════════════════════════════════ */
interface DepositViewProps {
  token: string
  onDeposited: (newBalance: number) => void
}

function DepositView({ token, onDeposited }: DepositViewProps) {
  const [amount, setAmount]   = useState('')
  const [error,  setError]    = useState('')
  const [loading, setLoading] = useState(false)

  async function handleDeposit(e: FormEvent) {
    e.preventDefault()
    const value = parseFloat(amount)
    if (!value || value <= 0) { setError('Enter a valid amount'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/wallet/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: value }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Deposit failed'); return }
      onDeposited(data.balance)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="bg-gray-800 rounded-2xl p-8 w-full max-w-sm shadow-xl">
        <h2 className="text-2xl font-bold mb-2 text-center">Add Funds</h2>
        <p className="text-gray-400 text-sm text-center mb-6">Top up your balance to start playing</p>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {PRESET_AMOUNTS.map(a => (
            <button
              key={a}
              onClick={() => setAmount(String(a))}
              className="py-2 rounded-lg bg-gray-700 hover:bg-purple-600 transition-colors text-sm font-medium"
            >
              ${a}
            </button>
          ))}
        </div>

        <form onSubmit={handleDeposit} className="space-y-3">
          <input
            type="number"
            min="1"
            step="0.01"
            placeholder="Custom amount"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="w-full px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 focus:outline-none focus:border-purple-500 text-white"
          />
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-50 font-semibold transition-colors"
          >
            {loading ? 'Processing…' : 'Deposit'}
          </button>
        </form>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   GameView
═══════════════════════════════════════════════════ */
interface GameViewProps {
  token: string
  balance: number
  cfg: GameCfg
  onBalanceChange: (b: number) => void
  onBalanceEmpty: () => void
}

function GameView({ token, balance, cfg, onBalanceChange, onBalanceEmpty }: GameViewProps) {
  const [balloons,  setBalloons]  = useState<Balloon[]>([])
  const [fxMoney,   setFxMoney]   = useState<FxMoney[]>([])
  const [fxParticles, setFxParticles] = useState<FxParticle[]>([])
  const [popping,   setPopping]   = useState<Set<string>>(new Set())

  const balanceRef = useRef(balance)
  useEffect(() => { balanceRef.current = balance }, [balance])

  // Spawn balloons
  useEffect(() => {
    const id = setInterval(() => {
      setBalloons(prev => {
        const alive = prev.filter(b => !b.popped)
        if (alive.length >= cfg.maxB) return prev
        return [...alive, mkBalloon(cfg)]
      })
    }, cfg.spawnMs)
    return () => clearInterval(id)
  }, [cfg])

  // Float balloons upward
  useEffect(() => {
    let raf: number
    function tick() {
      setBalloons(prev =>
        prev
          .map(b => b.popped ? b : { ...b, x: b.x })
          .filter(b => {
            // balloons removed when they'd be off screen — tracked by age via uid timestamp
            return true
          })
      )
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  async function popBalloon(b: Balloon) {
    if (b.popped || popping.has(b.id)) return
    setPopping(prev => new Set(prev).add(b.id))

    // Particle burst
    const particles: FxParticle[] = Array.from({ length: 8 }, () => ({
      id: uid(),
      x: b.x, y: 50,
      tx: (Math.random() - 0.5) * 20,
      ty: -(10 + Math.random() * 20),
      color: b.color,
    }))
    setFxParticles(prev => [...prev, ...particles])
    setTimeout(() => {
      setFxParticles(prev => prev.filter(p => !particles.find(pp => pp.id === p.id)))
    }, 700)

    try {
      const res = await fetch('/api/game/pop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer token` },
        body: JSON.stringify({ balloonId: b.id, value: b.value }),
      })
      const data = await res.json()
      const newBal = data.balance ?? (balanceRef.current + b.value)

      // Money fx
      const fx: FxMoney = { id: uid(), x: b.x, y: 50, value: b.value }
      setFxMoney(prev => [...prev, fx])
      setTimeout(() => setFxMoney(prev => prev.filter(f => f.id !== fx.id)), 900)

      onBalanceChange(newBal)
      if (newBal <= 0) onBalanceEmpty()
    } catch {
      // optimistic update on network error
      onBalanceChange(balanceRef.current + b.value)
    } finally {
      setBalloons(prev => prev.map(bb => bb.id === b.id ? { ...bb, popped: true } : bb))
      setPopping(prev => { const s = new Set(prev); s.delete(b.id); return s })
    }
  }

  return (
    <div className="flex-1 relative overflow-hidden select-none">
      {balloons.filter(b => !b.popped).map(b => (
        <button
          key={b.id}
          onClick={() => popBalloon(b)}
          className="absolute rounded-full flex items-center justify-center font-bold text-white shadow-lg hover:scale-110 transition-transform cursor-pointer border-2 border-white/20"
          style={{
            left:   `${b.x}%`,
            bottom: `${10 + Math.random() * 60}%`,
            width:  b.size,
            height: b.size,
            background: b.color,
            fontSize:   b.size * 0.22,
            transform:  'translateX(-50%)',
          }}
          aria-label={`Pop balloon worth $${b.value.toFixed(2)}`}
        >
          ${b.value.toFixed(2)}
        </button>
      ))}

      {fxMoney.map(f => (
        <div
          key={f.id}
          className="absolute pointer-