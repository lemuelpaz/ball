'use client'
import { useState, useEffect, useCallback, useRef, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { isValidCpf } from '@/lib/cpf'

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

  const handleDepositSuccess = useCallback((newBalance: number) => {
    setBalance(newBalance)
    setPhase('game')
  }, [])

  if (phase === 'loading') return <LoadingScreen />

  if (phase === 'deposit') {
    return (
      <DepositGate
        token={token}
        onSuccess={handleDepositSuccess}
        onLogout={() => { localStorage.clear(); router.replace('/') }}
      />
    )
  }

  return (
    <ActiveGame
      token={token}
      initialBalance={balance}
      cfg={cfg}
      onNeedDeposit={() => setPhase('deposit')}
      onLogout={() => { localStorage.clear(); router.replace('/') }}
    />
  )
}

/* ═══════════════════════════════════════════════════
   Loading Screen
═══════════════════════════════════════════════════ */
function LoadingScreen() {
  return (
    <div className="game-bg fixed inset-0 flex items-center justify-center">
      <div className="text-center">
        <div className="text-5xl mb-4 gold-pulse">🎈</div>
        <div className="w-8 h-8 border-3 border-white/20 border-t-white rounded-full spin-slow mx-auto"
          style={{ borderWidth: 3 }} />
        <p className="text-white/50 text-sm mt-3">Carregando...</p>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   Deposit Gate — full screen, shown before first play
═══════════════════════════════════════════════════ */
type DepositStep = 'choose' | 'details' | 'qr'

function DepositGate({
  token, onSuccess, onLogout
}: {
  token: string
  onSuccess: (balance: number) => void
  onLogout: () => void
}) {
  const [step,       setStep]       = useState<DepositStep>('choose')
  const [preset,     setPreset]     = useState(50)
  const [custom,     setCustom]     = useState('')
  const [cpf,        setCpf]        = useState('')
  const [email,      setEmail]      = useState('')
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')
  const [qrcode,     setQrcode]     = useState('')
  const [copied,     setCopied]     = useState(false)
  const [pollStatus, setPollStatus] = useState<'waiting' | 'checking'>('waiting')
  const pollRef = useRef<ReturnType<typeof setInterval>>()

  /* Poll balance after QR is shown */
  useEffect(() => {
    if (step !== 'qr') return
    pollRef.current = setInterval(async () => {
      setPollStatus('checking')
      try {
        const r = await fetch('/api/wallet/balance', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (r.ok) {
          const d = await r.json()
          if ((d.balance ?? 0) > 0) {
            clearInterval(pollRef.current)
            onSuccess(d.balance)
          }
        }
      } finally { setPollStatus('waiting') }
    }, 3500)
    return () => clearInterval(pollRef.current)
  }, [step, token, onSuccess])

  const finalAmount = custom
    ? parseFloat(custom.replace(',', '.')) || 0
    : preset

  function fmtCpf(v: string) {
    const n = v.replace(/\D/g, '').slice(0, 11)
    if (n.length > 9) return `${n.slice(0,3)}.${n.slice(3,6)}.${n.slice(6,9)}-${n.slice(9)}`
    if (n.length > 6) return `${n.slice(0,3)}.${n.slice(3,6)}.${n.slice(6)}`
    if (n.length > 3) return `${n.slice(0,3)}.${n.slice(3)}`
    return n
  }

  async function handleGenerate(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!isValidCpf(cpf)) { setError('CPF inválido'); return }
    if (finalAmount < 10) { setError('Valor mínimo: R$ 10'); return }
    setLoading(true)
    try {
      const res  = await fetch('/api/wallet/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: finalAmount, cpf, email }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Erro ao gerar PIX'); return }
      setQrcode(data.qrcode || '')
      setStep('qr')
    } catch { setError('Erro de conexão') } finally { setLoading(false) }
  }

  async function copyCode() {
    if (!qrcode) return
    try { await navigator.clipboard.writeText(qrcode) } catch {}
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="game-bg fixed inset-0 flex flex-col" style={{ overflowY: 'auto' }}>

      {/* Top bar */}
      <div className="glass-dark bar-top px-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎈</span>
          <span className="text-white font-black text-base">BalloonBet</span>
        </div>
        <button onClick={onLogout} className="text-white/40 text-sm hover:text-white/70 transition">
          Sair
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="glass rounded-3xl w-full max-w-[360px] overflow-hidden slide-up">

          {/* ── Step 1: choose amount ── */}
          {step === 'choose' && (
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="text-5xl mb-2">💰</div>
                <h2 className="text-white font-black text-xl">Faça um depósito</h2>
                <p className="text-white/50 text-sm mt-1">
                  Selecione o valor para começar a jogar
                </p>
              </div>

              {/* Preset grid */}
              <div className="grid grid-cols-3 gap-2.5 mb-4">
                {PRESET_AMOUNTS.map(a => (
                  <button
                    key={a}
                    onPointerDown={() => { setPreset(a); setCustom('') }}
                    className={`py-3.5 rounded-2xl font-black text-sm transition active:scale-90 ${
                      preset === a && !custom
                        ? 'bg-purple-600 text-white ring-2 ring-purple-400 ring-offset-1 ring-offset-transparent'
                        : 'bg-white/10 text-white/80 hover:bg-white/20'
                    }`}
                  >
                    R$ {a}
                  </button>
                ))}
              </div>

              {/* Custom amount */}
              <div className="mb-5">
                <label className="text-white/40 text-xs block mb-1.5">Outro valor</label>
                <input
                  type="number" inputMode="decimal" min="10" step="1"
                  value={custom}
                  onChange={e => { setCustom(e.target.value); setPreset(0) }}
                  placeholder="Ex: 75"
                  className="w-full px-4 py-3 rounded-2xl bg-white/10 border border-white/15 text-white placeholder-white/25
                             focus:outline-none focus:border-purple-400 transition text-center text-lg font-bold"
                />
              </div>

              {/* Selected display */}
              {finalAmount >= 10 && (
                <div className="glass-dark rounded-2xl px-4 py-2.5 flex items-center justify-between mb-4">
                  <span className="text-white/50 text-sm">Valor selecionado</span>
                  <span className="text-yellow-300 font-black text-lg">R$ {finalAmount.toFixed(2)}</span>
                </div>
              )}

              <button
                onPointerDown={() => finalAmount >= 10 && setStep('details')}
                disabled={finalAmount < 10}
                className="w-full py-4 rounded-2xl font-black text-white text-base
                           bg-gradient-to-r from-purple-600 to-pink-600
                           active:scale-95 disabled:opacity-35 transition"
              >
                Continuar →
              </button>
            </div>
          )}

          {/* ── Step 2: enter CPF / email ── */}
          {step === 'details' && (
            <form onSubmit={handleGenerate} className="p-6">
              <button
                type="button"
                onPointerDown={() => setStep('choose')}
                className="flex items-center gap-1 text-white/40 text-sm mb-5 hover:text-white/70 transition"
              >
                ← Voltar
              </button>

              <div className="text-center mb-5">
                <div className="text-5xl mb-2">📋</div>
                <h2 className="text-white font-black text-xl">Seus dados</h2>
                <p className="text-white/50 text-sm mt-1">Necessário para processar o PIX</p>
              </div>

              <div className="space-y-3 mb-5">
                <div>
                  <label className="text-white/50 text-xs font-semibold uppercase tracking-wide block mb-1.5">
                    CPF *
                  </label>
                  <input
                    value={cpf}
                    onChange={e => setCpf(fmtCpf(e.target.value))}
                    placeholder="000.000.000-00"
                    inputMode="numeric"
                    required
                    className="w-full px-4 py-3 rounded-2xl bg-white/10 border border-white/15 text-white placeholder-white/25
                               focus:outline-none focus:border-purple-400 transition text-base tracking-wider"
                  />
                </div>
                <div>
                  <label className="text-white/50 text-xs font-semibold uppercase tracking-wide block mb-1.5">
                    E-mail
                  </label>
                  <input
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    type="email"
                    className="w-full px-4 py-3 rounded-2xl bg-white/10 border border-white/15 text-white placeholder-white/25
                               focus:outline-none focus:border-purple-400 transition text-base"
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-500/15 border border-red-400/30 rounded-2xl px-4 py-3 text-red-300 text-sm mb-4">
                  {error}
                </div>
              )}

              {/* Summary */}
              <div className="glass-dark rounded-2xl px-4 py-3 flex items-center justify-between mb-4">
                <span className="text-white/50 text-sm">Depósito via PIX</span>
                <span className="text-yellow-300 font-black text-xl">R$ {finalAmount.toFixed(2)}</span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-2xl font-black text-white text-base
                           bg-green-600 hover:bg-green-500 active:scale-95 disabled:opacity-50 transition"
              >
                {loading
                  ? <span className="flex items-center justify-center gap-2">
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full spin-slow" />
                      Gerando PIX...
                    </span>
                  : `💳 Gerar PIX — R$ ${finalAmount.toFixed(2)}`
                }
              </button>
            </form>
          )}

          {/* ── Step 3: show QR / copia-cola ── */}
          {step === 'qr' && (
            <div className="p-6">
              <div className="text-center mb-5">
                <div className="text-5xl mb-2">📱</div>
                <h2 className="text-white font-black text-xl">PIX gerado!</h2>
                <p className="text-white/50 text-sm mt-1">
                  Copie o código e pague no seu banco
                </p>
              </div>

              {/* Code box */}
              <div className="bg-black/50 border border-white/10 rounded-2xl p-4 mb-4">
                <p className="text-white/30 text-xs text-center mb-2">PIX Copia e Cola</p>
                <div
                  className="text-green-300 text-xs font-mono break-all leading-relaxed max-h-28 overflow-y-auto select-all text-center"
                  style={{ wordBreak: 'break-all' }}
                >
                  {qrcode || 'Código PIX será exibido aqui'}
                </div>
              </div>

              {/* Copy button */}
              <button
                onPointerDown={copyCode}
                className={`w-full py-3.5 rounded-2xl font-bold text-sm mb-4 transition active:scale-95 ${
                  copied
                    ? 'bg-green-600 text-white'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {copied ? '✓ Código copiado!' : '📋 Copiar código PIX'}
              </button>

              {/* Waiting indicator */}
              <div className="flex flex-col items-center gap-2.5">
                <div className="flex items-center gap-2 text-white/50 text-sm">
                  <span
                    className={`w-2 h-2 rounded-full pulse-dot ${
                      pollStatus === 'checking' ? 'bg-yellow-400' : 'bg-green-400'
                    }`}
                  />
                  {pollStatus === 'checking' ? 'Verificando pagamento...' : 'Aguardando pagamento...'}
                </div>
                <p className="text-white/25 text-xs text-center">
                  O saldo é creditado automaticamente após confirmação
                </p>
              </div>

              {/* Back option */}
              <button
                onPointerDown={() => setStep('details')}
                className="w-full mt-4 py-3 rounded-2xl text-white/30 text-sm hover:text-white/50 transition"
              >
                ← Escolher outro valor
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   Active Game
═══════════════════════════════════════════════════ */
function ActiveGame({
  token, initialBalance, cfg, onNeedDeposit, onLogout,
}: {
  token: string; initialBalance: number; cfg: GameCfg
  onNeedDeposit: () => void; onLogout: () => void
}) {
  const [balloons, setBalloons] = useState<Balloon[]>([])
  const [balance,  setBalance]  = useState(initialBalance)
  const [session,  setSession]  = useState(0)
  const [pops,     setPops]     = useState(0)
  const [running,  setRunning]  = useState(true)
  const [fxMoney,  setFxMoney]  = useState<FxMoney[]>([])
  const [fxPart,   setFxPart]   = useState<FxParticle[]>([])
  const [bump,     setBump]     = useState(false)
  const [menu,     setMenu]     = useState(false)

  const tokenRef   = useRef(token)
  const runRef     = useRef(running)
  const cfgRef     = useRef(cfg)
  const intervalRef = useRef<ReturnType<typeof setInterval>>()

  tokenRef.current = token
  runRef.current   = running
  cfgRef.current   = cfg

  /* Spawn loop */
  useEffect(() => {
    if (!running) { clearInterval(intervalRef.current); return }
    intervalRef.current = setInterval(() => {
      setBalloons(prev => {
        const alive = prev.filter(b => !b.popped)
        if (alive.length >= cfgRef.current.maxB) return alive
        return [...alive, mkBalloon(cfgRef.current)]
      })
    }, cfg.spawnMs)
    return () => clearInterval(intervalRef.current)
  }, [running, cfg.spawnMs])

  /* Pop handler */
  const handlePop = useCallback(async (b: Balloon, clientX: number, clientY: number) => {
    setBalloons(prev => prev.map(x => x.id === b.id ? { ...x, popped: true } : x))

    /* Money float effect */
    const fid = uid()
    setFxMoney(prev => [...prev, { id: fid, x: clientX, y: clientY, value: b.value }])
    setTimeout(() => setFxMoney(p => p.filter(f => f.id !== fid)), 950)

    /* Particle burst */
    const newParts = Array.from({ length: 8 }, (_, i) => {
      const angle = (Math.PI * 2 / 8) * i
      const dist  = 50 + Math.random() * 35
      return { id: uid(), x: clientX, y: clientY, color: b.color,
               tx: Math.cos(angle) * dist, ty: Math.sin(angle) * dist }
    })
    setFxPart(prev => [...prev, ...newParts])
    setTimeout(() => setFxPart(p => p.filter(x => !newParts.find(n => n.id === x.id))), 500)

    /* Remove balloon after pop animation */
    setTimeout(() => setBalloons(p => p.filter(x => x.id !== b.id)), 340)

    /* Optimistic UI */
    setBalance(prev => prev + b.value)
    setSession(prev => prev + b.value)
    setPops(prev => prev + 1)
    setBump(true)
    setTimeout(() => setBump(false), 320)

    /* Server sync */
    try {
      const res = await fetch('/api/game/pop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenRef.current}` },
        body: JSON.stringify({ value: b.value }),
      })
      if (res.ok) {
        const d = await res.json()
        setBalance(d.balance)
      }
    } catch {}
  }, [])

  const removeEscaped = useCallback((id: string) => {
    setBalloons(p => p.filter(b => b.id !== id))
  }, [])

  return (
    <div className="game-bg fixed inset-0 flex flex-col select-none" style={{ touchAction: 'none' }}>

      {/* ── HUD top ── */}
      <div className="glass-dark hud-top flex-shrink-0 px-3 flex items-center gap-2 z-40">
        <span className="text-xl mr-1">🎈</span>

        {/* Balance */}
        <div className={`flex-1 ${bump ? 'do-bump' : ''}`}>
          <p className="text-white/40 text-xs font-semibold uppercase leading-none">Saldo</p>
          <p className="text-yellow-300 font-black text-lg leading-tight gold-pulse">
            R$ {balance.toFixed(2)}
          </p>
        </div>

        {/* Session */}
        <div className="text-center px-3 border-l border-r border-white/10">
          <p className="text-white/40 text-xs font-semibold uppercase leading-none">Sessão</p>
          <p className="text-green-400 font-black text-base leading-tight">
            +R$ {session.toFixed(2)}
          </p>
        </div>

        {/* Pops */}
        <div className="text-center mr-1">
          <p className="text-white/40 text-xs font-semibold uppercase leading-none">Balões</p>
          <p className="text-purple-300 font-black text-base leading-tight">{pops}</p>
        </div>

        {/* Menu button */}
        <button
          onPointerDown={() => setMenu(m => !m)}
          className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white text-lg active:scale-90 transition"
        >
          ☰
        </button>
      </div>

      {/* ── Game area ── */}
      <div className="flex-1 relative overflow-hidden" style={{ touchAction: 'none' }}>

        {/* Stars */}
        <Stars />

        {/* Balloons */}
        {balloons.map(b => (
          <BalloonEl key={b.id} b={b} onPop={handlePop} onEscape={removeEscaped} />
        ))}

        {/* Money fx */}
        {fxMoney.map(f => (
          <div key={f.id} className="float-up pointer-events-none z-50"
            style={{ position: 'absolute', left: f.x, top: f.y,
                     transform: 'translate(-50%,-50%)', zIndex: 50 }}>
            <span style={{ color: '#FFD700', fontWeight: 900, fontSize: 22,
                           textShadow: '0 2px 12px rgba(255,215,0,0.9)' }}>
              +R${f.value.toFixed(2)}
            </span>
          </div>
        ))}

        {/* Particle fx */}
        {fxPart.map(p => (
          <div key={p.id} className="burst-p pointer-events-none"
            style={{
              position: 'absolute', left: p.x - 5, top: p.y - 5,
              width: 10, height: 10, borderRadius: '50%',
              backgroundColor: p.color, zIndex: 49,
              '--tx': `${p.tx}px`, '--ty': `${p.ty}px`,
            } as React.CSSProperties}
          />
        ))}

        {/* Paused overlay */}
        {!running && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="glass-dark rounded-3xl px-10 py-8 text-center">
              <div className="text-5xl mb-3">⏸</div>
              <p className="text-white font-black text-xl">Pausado</p>
              <p className="text-white/50 text-sm mt-1">Toque em ▶ para continuar</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom action bar ── */}
      <div className="glass-dark hud-bottom flex-shrink-0 px-4 flex items-center justify-around z-40">
        <ActionBtn
          icon={running ? '⏸' : '▶'}
          label={running ? 'Pausar' : 'Jogar'}
          color={running ? '#ef4444' : '#22c55e'}
          onPress={() => setRunning(r => !r)}
        />
        <ActionBtn icon="💳" label="Depositar" color="#a78bfa"
          onPress={() => { setMenu(false); onNeedDeposit() }} />
        <ActionBtn icon="💸" label="Sacar"     color="#60a5fa"
          onPress={() => setMenu(true)} />
        <ActionBtn icon="🚪" label="Sair"      color="#6b7280"
          onPress={onLogout} />
      </div>

      {/* ── Slide-up menu (withdraw + history) ── */}
      {menu && (
        <MenuSheet
          token={token}
          balance={balance}
          onClose={() => setMenu(false)}
          onBalanceUpdate={setBalance}
        />
      )}
    </div>
  )
}

/* ── Small action button ── */
function ActionBtn({
  icon, label, color, onPress,
}: { icon: string; label: string; color: string; onPress: () => void }) {
  return (
    <button
      onPointerDown={onPress}
      className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-2xl active:scale-90 transition"
      style={{ minWidth: 60 }}
    >
      <span className="text-2xl">{icon}</span>
      <span className="text-xs font-semibold" style={{ color }}>{label}</span>
    </button>
  )
}

/* ═══════════════════════════════════════════════════
   Balloon Element
═══════════════════════════════════════════════════ */
function BalloonEl({
  b, onPop, onEscape,
}: {
  b: Balloon
  onPop: (b: Balloon, x: number, y: number) => void
  onEscape: (id: string) => void
}) {
  const [popping, setPopping] = useState(false)

  function handleDown(e: React.PointerEvent) {
    e.preventDefault()
    if (popping || b.popped) return
    setPopping(true)
    onPop(b, e.clientX, e.clientY)
  }

  return (
    <div
      onPointerDown={handleDown}
      onAnimationEnd={() => { if (!popping) onEscape(b.id) }}
      className={popping ? 'popping' : 'falling'}
      style={{
        position: 'absolute',
        left: `${b.x}%`,
        top: 0,
        zIndex: 10,
        cursor: popping ? 'default' : 'pointer',
        touchAction: 'none',
        '--spd': `${b.speed}s`,
        transform: 'translateY(-160px)',
        willChange: 'transform',
      } as React.CSSProperties}
    >
      {/* Balloon body */}
      <div style={{
        width: b.size, height: b.size * 1.18,
        borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
        background: `radial-gradient(circle at 35% 32%, ${b.color}ff, ${b.color}bb)`,
        boxShadow: `0 4px 20px ${b.color}60, inset 0 -4px 12px rgba(0,0,0,0.2)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', userSelect: 'none',
      }}>
        {/* Shine */}
        <div style={{
          position: 'absolute', top: '14%', left: '18%',
          width: '28%', height: '18%', borderRadius: '50%',
          background: 'rgba(255,255,255,0.5)',
        }} />
        {/* Value label */}
        <span style={{
          color: '#fff', fontWeight: 900, fontSize: b.size * 0.17,
          textShadow: '0 1px 5px rgba(0,0,0,0.55)',
          letterSpacing: '-0.3px', zIndex: 1,
        }}>
          {b.value % 1 === 0 ? `R$${b.value}` : `R$${b.value.toFixed(2)}`}
        </span>
      </div>
      {/* String */}
      <div style={{
        width: 1.5, height: b.size * 0.38,
        background: 'rgba(255,255,255,0.4)',
        margin: '0 auto', borderRadius: 1,
      }} />
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   Menu Sheet (withdraw + history)
═══════════════════════════════════════════════════ */
type SheetTab = 'withdraw' | 'history'

function MenuSheet({
  token, balance, onClose, onBalanceUpdate,
}: {
  token: string; balance: number
  onClose: () => void; onBalanceUpdate: (b: number) => void
}) {
  const [tab,          setTab]          = useState<SheetTab>('withdraw')
  const [pixKey,       setPixKey]       = useState('')
  const [pixType,      setPixType]      = useState('CPF')
  const [amount,       setAmount]       = useState('')
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [success,      setSuccess]      = useState(false)
  const [transactions, setTransactions] = useState<{type:string;amount:number;createdAt:string}[]>([])
  const [histLoading,  setHistLoading]  = useState(false)

  useEffect(() => {
    if (tab === 'history') {
      setHistLoading(true)
      fetch('/api/wallet/balance', { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(d => setTransactions(d.transactions ?? []))
        .finally(() => setHistLoading(false))
    }
  }, [tab, token])

  async function handleWithdraw(e: FormEvent) {
    e.preventDefault(); setError('')
    const val = parseFloat(amount.replace(',', '.'))
    if (!val || val < 20) { setError('Valor mínimo: R$ 20'); return }
    if (val > balance)    { setError('Saldo insuficiente');  return }
    if (!pixKey.trim())   { setError('Informe a chave PIX'); return }
    setLoading(true)
    try {
      const res  = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: val, pixKey, pixKeyType: pixType }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Erro'); return }
      onBalanceUpdate(balance - val)
      setSuccess(true)
    } catch { setError('Erro de conexão') } finally { setLoading(false) }
  }

  const typeLabel = (t: string) =>
    ({ balloon_pop: '🎈 Balão', deposit: '💳 Depósito', withdrawal: '💸 Saque' } as Record<string,string>)[t] ?? t

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onPointerDown={onClose}
      />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 glass-dark rounded-t-3xl overflow-hidden slide-up"
        style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 mb-4 flex-shrink-0">
          {(['withdraw', 'history'] as SheetTab[]).map(t => (
            <button key={t}
              onPointerDown={() => setTab(t)}
              className={`flex-1 py-2.5 rounded-2xl font-bold text-sm transition ${
                tab === t ? 'bg-indigo-600 text-white' : 'bg-white/10 text-white/60'
              }`}>
              {t === 'withdraw' ? '💸 Sacar' : '📋 Histórico'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="sheet-body flex-1 overflow-y-auto px-4">

          {/* ── Withdraw ── */}
          {tab === 'withdraw' && (
            success ? (
              <div className="text-center py-8 space-y-3">
                <div className="text-5xl">✅</div>
                <p className="text-green-300 font-black text-lg">Saque solicitado!</p>
                <p className="text-white/50 text-sm">Processado em minutos via PIX.</p>
                <button onPointerDown={onClose}
                  className="w-full py-3 rounded-2xl bg-green-600 text-white font-bold">
                  Fechar
                </button>
              </div>
            ) : (
              <form onSubmit={handleWithdraw} className="space-y-3">
                {/* Balance */}
                <div className="glass rounded-2xl px-4 py-3 flex items-center justify-between">
                  <span className="text-white/50 text-sm">Saldo disponível</span>
                  <span className="text-yellow-300 font-black">R$ {balance.toFixed(2)}</span>
                </div>

                {/* Amount */}
                <div>
                  <label className="text-white/50 text-xs font-semibold uppercase tracking-wide block mb-1.5">
                    Valor (R$)
                  </label>
                  <input type="number" inputMode="decimal" min="20" step="0.01"
                    value={amount} onChange={e => setAmount(e.target.value)}
                    placeholder="20,00"
                    className="w-full px-4 py-3 rounded-2xl bg-white/10 border border-white/15 text-white text-base placeholder-white/25
                               focus:outline-none focus:border-indigo-400 transition"
                  />
                </div>

                {/* PIX key type */}
                <div>
                  <label className="text-white/50 text-xs font-semibold uppercase tracking-wide block mb-1.5">
                    Tipo de Chave PIX
                  </label>
                  <select value={pixType} onChange={e => setPixType(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-white/10 border border-white/15 text-white text-base
                               focus:outline-none focus:border-indigo-400 transition">
                    <option value="CPF">CPF</option>
                    <option value="PHONE">Telefone</option>
                    <option value="EMAIL">E-mail</option>
                    <option value="EVP">Chave Aleatória</option>
                    <option value="CNPJ">CNPJ</option>
                  </select>
                </div>

                {/* PIX key */}
                <div>
                  <label className="text-white/50 text-xs font-semibold uppercase tracking-wide block mb-1.5">
                    Chave PIX
                  </label>
                  <input value={pixKey} onChange={e => setPixKey(e.target.value)}
                    placeholder={
                      pixType === 'CPF'   ? '000.000.000-00' :
                      pixType === 'EMAIL' ? 'email@exemplo.com' :
                      pixType === 'PHONE' ? '(11) 99999-9999' : 'Sua chave PIX'
                    }
                    className="w-full px-4 py-3 rounded-2xl bg-white/10 border border-white/15 text-white text-base placeholder-white/25
                               focus:outline-none focus:border-indigo-400 transition"
                  />
                </div>

                {error && (
                  <div className="bg-red-500/15 border border-red-400/30 rounded-2xl px-4 py-3 text-red-300 text-sm">
                    {error}
                  </div>
                )}

                <button type="submit" disabled={loading}
                  className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black transition active:scale-95 disabled:opacity-50">
                  {loading ? 'Processando...' : 'Confirmar Saque'}
                </button>
              </form>
            )
          )}

          {/* ── History ── */}
          {tab === 'history' && (
            histLoading ? (
              <div className="flex justify-center py-8">
                <span className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full spin-slow" />
              </div>
            ) : transactions.length === 0 ? (
              <p className="text-white/30 text-center py-8">Nenhuma transação ainda</p>
            ) : (
              <div className="space-y-2">
                {transactions.map((t, i) => (
                  <div key={i} className="glass rounded-2xl px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium text-sm">{typeLabel(t.type)}</p>
                      <p className="text-white/35 text-xs">
                        {new Date(t.createdAt).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <span className={`font-black text-base ${
                      t.type === 'withdrawal' ? 'text-red-400' : 'text-green-400'
                    }`}>
                      {t.type === 'withdrawal' ? '-' : '+'}R$ {t.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </>
  )
}

/* ── Stars background ── */
function Stars() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {Array.from({ length: 60 }, (_, i) => (
        <div key={i} className="absolute rounded-full bg-white"
          style={{
            width:  `${1 + Math.random() * 2}px`,
            height: `${1 + Math.random() * 2}px`,
            left:  `${Math.random() * 100}%`,
            top:   `${Math.random() * 100}%`,
            animation: `twinkle ${2 + Math.random() * 4}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 6}s`,
          }}
        />
      ))}
    </div>
  )
}
