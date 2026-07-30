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

const PIX_EXPIRACAO_MS = 30 * 60 * 1000
const PIX_TIMESTAMP_KEY = 'pixCriadoEm'

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

function calcularTempoRestante(): number {
  const criado = localStorage.getItem(PIX_TIMESTAMP_KEY)
  if (!criado) return 0
  const decorrido = Date.now() - parseInt(criado, 10)
  const restante = PIX_EXPIRACAO_MS - decorrido
  return restante > 0 ? Math.floor(restante / 1000) : 0
}

function formatarCountdown(segundos: number): string {
  const m = Math.floor(segundos / 60).toString().padStart(2, '0')
  const s = (segundos % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

/* ═══════════════════════════════════════════════════
   DepositGate
═══════════════════════════════════════════════════ */
type DepositStep = 'form' | 'qr' | 'checking'

interface DepositGateProps {
  token: string
  emailErro: string
  setEmailErro: (v: string) => void
  onDeposited: () => void
}

function DepositGate({ token, emailErro, setEmailErro, onDeposited }: DepositGateProps) {
  const [step,        setStep]        = useState<DepositStep>('form')
  const [amount,      setAmount]      = useState<number | ''>('')
  const [email,       setEmail]       = useState('')
  const [qrCode,      setQrCode]      = useState('')
  const [pixKey,      setPixKey]      = useState('')
  const [depositErro, setDepositErro] = useState('')
  const [copiado,     setCopiado]     = useState(false)
  const [countdown,   setCountdown]   = useState(0)
  const [pixExpirado, setPixExpirado] = useState(false)

  useEffect(() => {
    if (step !== 'qr') return
    const inicial = calcularTempoRestante()
    setCountdown(inicial)
    if (inicial === 0) { setPixExpirado(true); return }

    const intervalo = setInterval(() => {
      const restante = calcularTempoRestante()
      setCountdown(restante)
      if (restante === 0) { setPixExpirado(true); clearInterval(intervalo) }
    }, 1000)

    return () => clearInterval(intervalo)
  }, [step])

  async function handleGerarPix(e: FormEvent) {
    e.preventDefault()
    setDepositErro('')
    if (!amount) { setDepositErro('Escolha um valor.'); return }
    if (!isEmailValido(email)) { setEmailErro('E-mail inválido.'); return }
    setEmailErro('')

    try {
      const res = await fetch('/api/pix/criar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount, email }),
      })
      const data = await res.json()
      if (!res.ok) { setDepositErro(data.erro ?? 'Erro ao gerar PIX.'); return }
      setQrCode(data.qrCode)
      setPixKey(data.pixKey)
      localStorage.setItem(PIX_TIMESTAMP_KEY, String(Date.now()))
      setStep('qr')
    } catch {
      setDepositErro('Erro de conexão.')
    }
  }

  async function handleVerificarPagamento() {
    setStep('checking')
    try {
      const res = await fetch('/api/pix/verificar', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.pago) { onDeposited(); return }
      setDepositErro('Pagamento ainda não confirmado.')
      setStep('qr')
    } catch {
      setDepositErro('Erro ao verificar pagamento.')
      setStep('qr')
    }
  }

  async function copiarChavePix() {
    await navigator.clipboard.writeText(pixKey)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  if (step === 'form') return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'#0f172a', padding:'1rem' }}>
      <div style={{ background:'#1e293b', borderRadius:'1.5rem', padding:'2rem', width:'100%', maxWidth:'420px', boxShadow:'0 8px 32px rgba(0,0,0,0.4)' }}>
        <h1 style={{ textAlign:'center', color:'#f8fafc', marginBottom:'1.5rem', fontSize:'1.5rem' }}>💰 Faça seu depósito</h1>
        <form onSubmit={handleGerarPix}>
          <p style={{ color:'#94a3b8', marginBottom:'0.75rem' }}>Escolha o valor:</p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'0.5rem', marginBottom:'1rem' }}>
            {PRESET_AMOUNTS.map(v => (
              <button key={v} type="button"
                onClick={() => setAmount(v)}
                style={{ padding:'0.6rem', borderRadius:'0.75rem', border:'2px solid', borderColor: amount === v ? '#6366f1' : '#334155', background: amount === v ? '#6366f1' : '#0f172a', color:'#f8fafc', cursor:'pointer', fontWeight: amount === v ? 700 : 400 }}>
                R$ {v}
              </button>
            ))}
          </div>
          <input
            type="email" placeholder="Seu e-mail" value={email}
            onChange={e => setEmail(e.target.value)}
            style={{ width:'100%', padding:'0.75rem', borderRadius:'0.75rem', border:'1px solid #334155', background:'#0f172a', color:'#f8fafc', marginBottom:'0.5rem', boxSizing:'border-box' }}
          />
          {emailErro && <p style={{ color:'#f87171', fontSize:'0.85rem', marginBottom:'0.5rem' }}>{emailErro}</p>}
          {depositErro && <p style={{ color:'#f87171', fontSize:'0.85rem', marginBottom:'0.5rem' }}>{depositErro}</p>}
          <button type="submit"
            style={{ width:'100%', padding:'0.85rem', borderRadius:'0.75rem', background:'#6366f1', color:'#fff', fontWeight:700, fontSize:'1rem', border:'none', cursor:'pointer', marginTop:'0.5rem' }}>
            Gerar PIX
          </button>
        </form>
      </div>
    </div>
  )

  if (step === 'checking') return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'#0f172a' }}>
      <p style={{ color:'#94a3b8', fontSize:'1.2rem' }}>Verificando pagamento…</p>
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'#0f172a', padding:'1rem' }}>
      <div style={{ background:'#1e293b', borderRadius:'1.5rem', padding:'2rem', width:'100%', maxWidth:'420px', textAlign:'center', boxShadow:'0 8px 32px rgba(0,0,0,0.4)' }}>
        <h2 style={{ color:'#f8fafc', marginBottom:'0.5rem' }}>📲 Pague via PIX</h2>
        {pixExpirado ? (
          <p style={{ color:'#f87171' }}>PIX expirado. Recarregue a página para gerar um novo.</p>
        ) : (
          <>
            <p style={{ color:'#94a3b8', marginBottom:'1rem' }}>Expira em: <strong style={{ color:'#fbbf24' }}>{formatarCountdown(countdown)}</strong></p>
            {qrCode && <img src={qrCode} alt="QR Code PIX" style={{ width:'200px', height:'200px', borderRadius:'0.75rem', marginBottom:'1rem' }} />}
            <div style={{ display:'flex', gap:'0.5rem', justifyContent:'center', marginBottom:'1rem' }}>
              <input readOnly value={pixKey} style={{ flex:1, padding:'0.6rem', borderRadius:'0.75rem', border:'1px solid #334155', background:'#0f172a', color:'#f8fafc', fontSize:'0.8rem' }} />
              <button onClick={copiarChavePix}
                style={{ padding:'0.6rem 1rem', borderRadius:'0.75rem', background: copiado ? '#34d399' : '#6366f1', color:'#fff', border:'none', cursor:'pointer' }}>
                {copiado ? '✓' : 'Copiar'}
              </button>
            </div>
            {depositErro && <p style={{ color:'#f87171', fontSize:'0.85rem', marginBottom:'0.5rem' }}>{depositErro}</p>}
            <button onClick={handleVerificarPagamento}
              style={{ width:'100%', padding:'0.85rem', borderRadius:'0.75rem', background:'#22c55e', color:'#fff', fontWeight:700, fontSize:'1rem', border:'none', cursor:'pointer' }}>
              Já paguei ✓
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   BalloonEl
═══════════════════════════════════════════════════ */
interface BalloonElProps {
  balloon: Balloon
  paused: boolean
  onPop: (b: Balloon) => void
}

function BalloonEl({ balloon, paused, onPop }: BalloonElProps) {
  return (
    <div
      onClick={() => { if (!paused) onPop(balloon) }}
      style={{
        position: 'absolute',
        left: `${balloon.x}%`,
        bottom: '-120px',
        width: `${balloon.size}px`,
        height: `${balloon.size * 1.2}px`,
        cursor: paused ? 'default' : 'pointer',
        animation: `falling ${balloon.speed}s linear forwards`,
        animationPlayState: paused ? 'paused' : 'running',
        userSelect: 'none',
        filter: balloon.popped ? 'blur(4px) opacity(0.3)' : 'none',
        transition: 'filter 0.15s',
        zIndex: 10,
      }}
    >
      <svg viewBox="0 0 100 130" width="100%" height="100%">
        <ellipse cx="50" cy="50" rx="42" ry="48" fill={balloon.color} />
        <ellipse cx="38" cy="32" rx="10" ry="14" fill="rgba(255,255,255,0.25)" transform="rotate(-20,38,32)" />
        <polygon points="50,98 44,110 56,110" fill={balloon.color} />
        <line x1="50" y1="110" x2="50" y2="128" stroke="#94a3b8" strokeWidth="1.5" />
      </svg>
      <div style={{ position:'absolute', top:'38%', left:'50%', transform:'translate(-50%,-50%)', color:'#fff', fontWeight:800, fontSize:`${balloon.size * 0.18}px`, textShadow:'0 1px 3px rgba(0,0,0,0.5)', pointerEvents:'none' }}>
        R${balloon.value.toFixed(2)}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   GameScreen
═══════════════════════════════════════════════════ */
interface GameScreenProps {
  token: string
  saldo: number
  onSaldoUpdate: (novo: number) => void
}

function GameScreen({ token, saldo, onSaldoUpdate }: GameScreenProps) {
  const [cfg]        = useState<GameCfg>(DEFAULT_CFG)
  const [balloons,   setBalloons]   = useState<Balloon[]>([])
  const [score,      setScore]      = useState(0)
  const [paused,     setPaused]     = useState(false)
  const [fxMoney,    setFxMoney]    = useState<FxMoney[]>([])
  const [fxParticles,setFxParticles]= useState<FxParticle[]>([])
  const spawnRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const cleanRef  = useRef<ReturnType<typeof setInterval> | null>(null)

  const sp