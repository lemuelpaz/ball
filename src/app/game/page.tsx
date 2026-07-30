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

  const pollingRef   = useRef<NodeJS.Timeout | null>(null)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)

  const pararPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

  const pararCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
      countdownRef.current = null
    }
  }, [])

  const iniciarCountdown = useCallback(() => {
    pararCountdown()
    const inicial = calcularTempoRestante()
    if (inicial <= 0) {
      setPixExpirado(true)
      pararPolling()
      return
    }
    setCountdown(inicial)
    setPixExpirado(false)

    countdownRef.current = setInterval(() => {
      const restante = calcularTempoRestante()
      if (restante <= 0) {
        setCountdown(0)
        setPixExpirado(true)
        pararPolling()
        pararCountdown()
        return
      }
      setCountdown(restante)
    }, 1000)
  }, [pararCountdown, pararPolling])

  /* suporte a recarga de página: se já havia um PIX ativo, retoma o QR */
  useEffect(() => {
    const criado = localStorage.getItem(PIX_TIMESTAMP_KEY)
    if (!criado) return
    const restante = calcularTempoRestante()
    if (restante > 0) {
      setStep('qr')
      iniciarCountdown()
    } else {
      localStorage.removeItem(PIX_TIMESTAMP_KEY)
      setPixExpirado(true)
      setStep('qr')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    return () => {
      pararPolling()
      pararCountdown()
    }
  }, [pararPolling, pararCountdown])

  const iniciarPolling = useCallback((depositId: string) => {
    pararPolling()
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/wallet/deposit/status?id=${depositId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) return
        const data = await res.json()
        if (data.status === 'approved') {
          pararPolling()
          pararCountdown()
          onDeposited()
        }
      } catch {
        /* erros de rede são ignorados — próxima iteração tentará novamente */
      }
    }, 5000)
  }, [token, onDeposited, pararPolling, pararCountdown])

  const handleGerarPix = useCallback(async (e: FormEvent) => {
    e.preventDefault()
    setDepositErro('')

    if (!amount || Number(amount) <= 0) {
      setDepositErro('Informe um valor válido.')
      return
    }
    if (!isEmailValido(email)) {
      setEmailErro('E-mail inválido.')
      return
    }
    setEmailErro('')

    try {
      const res = await fetch('/api/wallet/deposit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount: Number(amount), email }),
      })
      const data = await res.json()
      if (!res.ok) {
        setDepositErro('Não foi possível gerar o PIX. Tente novamente.')
        return
      }

      const agora = Date.now().toString()
      localStorage.setItem(PIX_TIMESTAMP_KEY, agora)

      setQrCode(data.qrCode ?? '')
      setPixKey(data.pixKey ?? '')
      setPixExpirado(false)
      setStep('qr')
      iniciarCountdown()
      if (data.id) iniciarPolling(data.id)
    } catch {
      setDepositErro('Erro ao conectar. Tente novamente.')
    }
  }, [amount, email, token, setEmailErro, iniciarCountdown, iniciarPolling])

  const handleNovoPixAposExpiracao = useCallback(() => {
    pararPolling()
    pararCountdown()
    localStorage.removeItem(PIX_TIMESTAMP_KEY)
    setQrCode('')
    setPixKey('')
    setPixExpirado(false)
    setCountdown(0)
    setAmount('')
    setEmail('')
    setDepositErro('')
    setStep('form')
  }, [pararPolling, pararCountdown])

  const handleCopiar = useCallback(async () => {
    if (!pixKey) return
    try {
      await navigator.clipboard.writeText(pixKey)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      /* falha silenciosa: usuário pode copiar manualmente */
    }
  }, [pixKey])

  if (step === 'form') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 w-full max-w-md border border-white/20">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">Depositar via PIX</h2>
          <form onSubmit={handleGerarPix} className="space-y-4">
            <div>
              <label className="block text-white/80 text-sm mb-2">Valor (R$)</label>
              <div className="grid grid-cols-3 gap-2 mb-2">
                {PRESET_AMOUNTS.map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setAmount(v)}
                    className={`py-2 rounded-lg text-sm font-semibold transition-colors ${
                      amount === v
                        ? 'bg-purple-500 text-white'
                        : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    R$ {v}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min="1"
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Outro valor"
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-white/40 focus:outline-none focus:border-purple-400"
              />
            </div>
            <div>
              <label className="block text-white/80 text-sm mb-2">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-white/40 focus:outline-none focus:border-purple-400"
              />
              {emailErro && <p className="text-red-400 text-xs mt-1">{emailErro}</p>}
            </div>
            {depositErro && <p className="text-red-400 text-sm text-center">{depositErro}</p>}
            <button
              type="submit"
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl transition-colors"
            >
              Gerar PIX
            </button>
          </form>
        </div>
      </div>
    )
  }

  if (step === 'qr') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 w-full max-w-md border border-white/20 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Pague via PIX</h2>

          {pixExpirado ? (
            <div className="space-y-4">
              <p className="text-red-400 font-semibold text-lg">PIX expirado</p>
              <p className="text-white/60 text-sm">O QR Code expirou após 30 minutos.</p>
              <button
                onClick={handleNovoPixAposExpiracao}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl transition-colors"
              >
                Gerar novo PIX
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-white/70 text-sm">Expira em:</span>
                <span className="text-yellow-400 font-mono font-bold text-lg">
                  {formatarCountdown(countdown)}
                </span>
              </div>
              {qrCode && (
                <div className="flex justify-center mb-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrCode} alt="QR Code PIX" className="w-48 h-48 rounded-lg" />
                </div>
              )}
              {pixKey && (
                <div className="space-y-2">
                  <p className="text-white/70 text-sm">Ou copie a chave PIX:</p>
                  <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white/80 text-xs break-all">
                    {pixKey}
                  </div>
                  <button
                    onClick={handleCopiar}
                    className="w-full bg-white/10 hover:bg-white/20 text-white font-semibold py-2 rounded-lg transition-colors text-sm"
                  >
                    {copiado ? '✓ Copiado!' : 'Copiar chave PIX'}
                  </button>
                </div>
              )}
              <p className="text-white/50 text-xs">Aguardando confirmação do pagamento…</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  return null
}

/* ═══════════════════════════════════════════════════
   Main Page — state machine
═══════════════════════════════════════════════════ */
export default function GamePage() {
  const router  = use