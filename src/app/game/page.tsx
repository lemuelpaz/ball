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

/* ═══════════════════════════════════════════════════
   Hook — contador de tempo de sessão (MM:SS)
   Incrementa apenas enquanto running===true e reseta
   quando chamado resetar().
═══════════════════════════════════════════════════ */
function useTempoDeSessao(running: boolean) {
  const [segundos, setSegundos] = useState(0)

  useEffect(() => {
    if (!running) return

    const id = setInterval(() => {
      setSegundos(s => s + 1)
    }, 1000)

    return () => clearInterval(id)
  }, [running])

  const resetar = useCallback(() => setSegundos(0), [])

  const formatado = (() => {
    const mm = String(Math.floor(segundos / 60)).padStart(2, '0')
    const ss = String(segundos % 60).padStart(2, '0')
    return `${mm}:${ss}`
  })()

  return { formatado, resetar }
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

  const jogoAtivo = phase === 'game'
  const { formatado: tempoDeSessao, resetar: resetarTempo } = useTempoDeSessao(jogoAtivo)

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
    resetarTempo()
    localStorage.removeItem('gameToken')
    router.replace('/')
  }, [router, resetarTempo])

  /* ── tela de carregamento ── */
  if (phase === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <p className="text-white text-lg animate-pulse">Carregando...</p>
      </div>
    )
  }

  /* ── tela de depósito ── */
  if (phase === 'deposit') {
    return (
      <DepositScreen
        token={token}
        onDeposited={(novoSaldo) => {
          setBalance(novoSaldo)
          setPhase('game')
        }}
        onLogout={handleLogout}
      />
    )
  }

  /* ── tela do jogo ── */
  return (
    <GameScreen
      token={token}
      balance={balance}
      cfg={cfg}
      tempoDeSessao={tempoDeSessao}
      onBalanceChange={setBalance}
      onLogout={handleLogout}
    />
  )
}

/* ═══════════════════════════════════════════════════
   DepositScreen
═══════════════════════════════════════════════════ */
interface DepositScreenProps {
  token: string
  onDeposited: (novoSaldo: number) => void
  onLogout: () => void
}

function DepositScreen({ token, onDeposited, onLogout }: DepositScreenProps) {
  const [valor, setValor]     = useState('')
  const [erro,  setErro]      = useState('')
  const [carregando, setCarregando] = useState(false)

  async function handleDeposit(e: FormEvent) {
    e.preventDefault()
    const num = parseFloat(valor)
    if (!num || num <= 0) { setErro('Informe um valor válido.'); return }
    setErro('')
    setCarregando(true)
    try {
      const res = await fetch('/api/wallet/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: num }),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.error ?? 'Erro ao depositar.'); return }
      onDeposited(data.balance)
    } catch {
      setErro('Erro de conexão.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 gap-6 p-4">
      <h1 className="text-white text-2xl font-bold">Faça um depósito para jogar</h1>
      <form onSubmit={handleDeposit} className="flex flex-col gap-3 w-full max-w-xs">
        <div className="flex flex-wrap gap-2 justify-center">
          {PRESET_AMOUNTS.map(v => (
            <button
              key={v}
              type="button"
              onClick={() => setValor(String(v))}
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-sm"
            >
              R$ {v}
            </button>
          ))}
        </div>
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={valor}
          onChange={e => setValor(e.target.value)}
          placeholder="Outro valor (R$)"
          className="rounded px-3 py-2 bg-gray-800 text-white border border-gray-600 focus:outline-none"
        />
        {erro && <p className="text-red-400 text-sm">{erro}</p>}
        <button
          type="submit"
          disabled={carregando}
          className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold py-2 rounded"
        >
          {carregando ? 'Depositando...' : 'Depositar'}
        </button>
      </form>
      <button onClick={onLogout} className="text-gray-400 hover:text-white text-sm underline">
        Sair
      </button>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   GameScreen
═══════════════════════════════════════════════════ */
interface GameScreenProps {
  token: string
  balance: number
  cfg: GameCfg
  tempoDeSessao: string
  onBalanceChange: (b: number) => void
  onLogout: () => void
}

function GameScreen({ token, balance, cfg, tempoDeSessao, onBalanceChange, onLogout }: GameScreenProps) {
  const [balloons,    setBalloons]    = useState<Balloon[]>([])
  const [fxMoney,     setFxMoney]     = useState<FxMoney[]>([])
  const [fxParticles, setFxParticles] = useState<FxParticle[]>([])
  const areaRef = useRef<HTMLDivElement>(null)

  /* spawn */
  useEffect(() => {
    const id = setInterval(() => {
      setBalloons(prev => {
        if (prev.filter(b => !b.popped).length >= cfg.maxB) return prev
        return [...prev, mkBalloon(cfg)]
      })
    }, cfg.spawnMs)
    return () => clearInterval(id)
  }, [cfg])

  /* sobe balões */
  useEffect(() => {
    const id = setInterval(() => {
      setBalloons(prev =>
        prev
          .map(b => b.popped ? b : { ...b, x: b.x })
          .filter(b => {
            /* remove balões que saíram do topo — sem penalidade */
            return true
          })
      )
    }, 50)
    return () => clearInterval(id)
  }, [])

  async function handlePop(b: Balloon, e: React.MouseEvent) {
    if (b.popped) return
    setBalloons(prev => prev.map(p => p.id === b.id ? { ...p, popped: true } : p))

    const rect = areaRef.current?.getBoundingClientRect()
    const fx: FxMoney = {
      id: uid(),
      x: rect ? ((e.clientX - rect.left) / rect.width) * 100 : b.x,
      y: rect ? ((e.clientY - rect.top)  / rect.height) * 100 : 50,
      value: b.value,
    }
    setFxMoney(prev => [...prev, fx])
    setTimeout(() => setFxMoney(prev => prev.filter(f => f.id !== fx.id)), 900)

    /* partículas */
    const particles: FxParticle[] = Array.from({ length: 8 }, () => ({
      id: uid(),
      x: fx.x, y: fx.y,
      tx: fx.x + (Math.random() - 0.5) * 20,
      ty: fx.y + (Math.random() - 0.5) * 20,
      color: b.color,
    }))
    setFxParticles(prev => [...prev, ...particles])
    setTimeout(() => {
      setFxParticles(prev => prev.filter(p => !particles.find(pp => pp.id === p.id)))
    }, 600)

    try {
      const res = await fetch('/api/wallet/pop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ value: b.value }),
      })
      const data = await res.json()
      if (res.ok) onBalanceChange(data.balance)
    } catch { /* falha silenciosa — o efeito visual já foi exibido */ }
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 select-none">
      {/* ── HUD top bar ── */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <span className="text-white font-bold text-lg">🎈 BalloonPop</span>

        <div className="flex items-center gap-4">
          {/* contador de tempo de sessão */}
          <span className="text-gray-300 text-sm font-mono" aria-label="Tempo de sessão">
            ⏱ {tempoDeSessao}
          </span>

          <span className="text-green-400 font-semibold">
            R$ {balance.toFixed(2)}
          </span>

          <button
            onClick={onLogout}
            className="text-gray-400 hover:text-white text-sm underline"
          >
            Sair
          </button>
        </div>
      </div>

      {/* ── área do jogo ── */}
      <div
        ref={areaRef}
        className="relative flex-1 overflow-hidden cursor-crosshair"
      >
        {balloons.filter(b => !b.popped).map(b => (
          <BalloonEl key={b.id} b={b} onPop={handlePop} />
        ))}

        {fxMoney.map(f => (
          <span
            key={f.id}
            className="absolute pointer-events-none text-green-300 font-bold text-sm animate-bounce"
            style={{ left: `${f.x}%`, top: `${f.y}%`, transform: 'translate(-50%,-50%)' }}
          >
            +R${f.value.toFixed(2)}
          </span>
        ))}

        {fxParticles.map(p => (
          <span
            key={p.id}
            className="absolute pointer-events-none rounded-full w-2 h-2"
            style={{