'use client'
import { useState, useEffect, useCallback, useRef, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { isEmailValido } from '@/lib/validacoes'

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
  const [emailErro, setEmailErro] = useState('')

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

  const handleGenerate = useCallback(async (
    e: FormEvent<HTMLFormElement>,
    email: string,
    amount: number,
  ) => {
    e.preventDefault()
    setEmailErro('')

    if (!isEmailValido(email)) {
      setEmailErro('Informe um endereço de e-mail válido.')
      return
    }

    try {
      const res = await fetch('/api/wallet/deposit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email, amount }),
      })

      if (!res.ok) {
        setEmailErro('Não foi possível processar o depósito. Tente novamente.')
        return
      }

      const data = await res.json()
      setBalance(data.balance ?? balance)
      setPhase('game')
    } catch {
      setEmailErro('Ocorreu um erro inesperado. Tente novamente.')
    }
  }, [token, balance])

  if (phase === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-950">
        <p className="text-white text-xl animate-pulse">Carregando…</p>
      </main>
    )
  }

  if (phase === 'deposit') {
    return (
      <DepositPhase
        onGenerate={handleGenerate}
        emailErro={emailErro}
      />
    )
  }

  return (
    <GamePhase
      token={token}
      balance={balance}
      setBalance={setBalance}
      cfg={cfg}
    />
  )
}

/* ═══════════════════════════════════════════════════
   Deposit Phase
═══════════════════════════════════════════════════ */
interface DepositPhaseProps {
  onGenerate: (e: FormEvent<HTMLFormElement>, email: string, amount: number) => Promise<void>
  emailErro: string
}

function DepositPhase({ onGenerate, emailErro }: DepositPhaseProps) {
  const [email,  setEmail]  = useState('')
  const [amount, setAmount] = useState(PRESET_AMOUNTS[0])

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-950 p-4">
      <div className="w-full max-w-md rounded-2xl bg-gray-900 p-8 shadow-2xl">
        <h1 className="mb-6 text-center text-3xl font-bold text-white">Depositar</h1>

        <form onSubmit={(e) => onGenerate(e, email, amount)} noValidate>
          <div className="mb-4">
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-300">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full rounded-lg bg-gray-800 px-4 py-2 text-white outline-none transition
                focus:ring-2 ${emailErro ? 'ring-2 ring-red-500' : 'focus:ring-purple-500'}`}
              placeholder="seu@email.com"
              required
            />
            {emailErro && (
              <p role="alert" className="mt-1 text-sm text-red-400">
                {emailErro}
              </p>
            )}
          </div>

          <div className="mb-6">
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Valor do depósito
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PRESET_AMOUNTS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAmount(v)}
                  className={`rounded-lg py-2 font-semibold transition
                    ${amount === v
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
                >
                  R$ {v}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-purple-600 py-3 font-bold text-white
              transition hover:bg-purple-500 active:scale-95"
          >
            Gerar QR Code
          </button>
        </form>
      </div>
    </main>
  )
}

/* ═══════════════════════════════════════════════════
   Game Phase
═══════════════════════════════════════════════════ */
interface GamePhaseProps {
  token: string
  balance: number
  setBalance: (v: number) => void
  cfg: GameCfg
}

function GamePhase({ token, balance, setBalance, cfg }: GamePhaseProps) {
  const [balloons,    setBalloons]    = useState<Balloon[]>([])
  const [fxMoney,     setFxMoney]     = useState<FxMoney[]>([])
  const [fxParticles, setFxParticles] = useState<FxParticle[]>([])
  const balanceRef = useRef(balance)

  useEffect(() => { balanceRef.current = balance }, [balance])

  /* spawn */
  useEffect(() => {
    const interval = setInterval(() => {
      setBalloons(prev => {
        if (prev.filter(b => !b.popped).length >= cfg.maxB) return prev
        return [...prev, mkBalloon(cfg)]
      })
    }, cfg.spawnMs)
    return () => clearInterval(interval)
  }, [cfg])

  /* float */
  useEffect(() => {
    let raf: number
    const step = () => {
      setBalloons(prev =>
        prev
          .map(b => b.popped ? b : { ...b, x: b.x })
          .filter(b => !b.popped)
      )
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [])

  const pop = useCallback(async (balloon: Balloon, clientX: number, clientY: number) => {
    setBalloons(prev => prev.map(b => b.id === balloon.id ? { ...b, popped: true } : b))

    const particles: FxParticle[] = Array.from({ length: 8 }, () => ({
      id: uid(),
      x: clientX, y: clientY,
      tx: clientX + (Math.random() - 0.5) * 120,
      ty: clientY + (Math.random() - 0.5) * 120,
      color: balloon.color,
    }))
    setFxParticles(prev => [...prev, ...particles])
    setTimeout(() => {
      setFxParticles(prev => prev.filter(p => !particles.some(pp => pp.id === p.id)))
    }, 600)

    const moneyFx: FxMoney = { id: uid(), x: clientX, y: clientY, value: balloon.value }
    setFxMoney(prev => [...prev, moneyFx])
    setTimeout(() => setFxMoney(prev => prev.filter(m => m.id !== moneyFx.id)), 900)

    try {
      const res = await fetch('/api/wallet/pop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ value: balloon.value }),
      })
      if (res.ok) {
        const data = await res.json()
        setBalance(data.balance ?? balanceRef.current + balloon.value)
      }
    } catch {
      /* falha silenciosa — o saldo será sincronizado no próximo ciclo */
    }
  }, [token, setBalance])

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-gray-950">
      {/* HUD */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4">
        <span className="text-lg font-bold text-white">🎈 Balão</span>
        <span className="rounded-full bg-gray-800 px-4 py-1 text-sm font-semibold text-green-400">
          R$ {balance.toFixed(2)}
        </span>
      </header>

      {/* Arena */}
      <div className="relative flex-1">
        {balloons.map(b => (
          <button
            key={b.id}
            onClick={(e) => pop(b, e.clientX, e.clientY)}
            style={{
              left:   `${b.x}%`,
              bottom: '0%',
              width:  b.size,
              height: b.size,
              background: b.color,
              borderRadius: '50%',
              position: 'absolute',
              cursor: 'pointer',
              border: 'none',
              boxShadow: `0 0 12px ${b.color}88`,
              transition: 'bottom 0.1s linear',
            }}
            aria-label={`Balão R$ ${b.value.toFixed(2)}`}
          >
            <span className="text-xs font-bold text-white drop-shadow">
              R${b.value.toFixed(2)}
            </span>
          </button>
        ))}

        {fxMoney.map(m => (
          <div
            key={m.id}
            className="pointer-events-none absolute animate-bounce text-sm font-bold text-green-300"
            style={{ left: m.x, top: m.y }}
          >
            +R${m.value.toFixed(2)}
          </div>
        ))}

        {fxParticles.map(p => (
          <div
            key={p.id}
            className="pointer-events-none absolute h-2 w-2 rounded-full"
            style={{ left: p.x, top: p.y, background: p.color }}
          />
        ))}
      </div>
    </main>
  )
}