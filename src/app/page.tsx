'use client'
import { useState, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

function fmtPhone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2)  return `(${d}`
  if (d.length <= 6)  return `(${d.slice(0,2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
}

export default function LoginPage() {
  const router = useRouter()
  const [name,    setName]    = useState('')
  const [phone,   setPhone]   = useState('')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (localStorage.getItem('gameToken')) router.replace('/game')
  }, [router])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (name.trim().length < 2) { setError('Digite seu nome completo'); return }
    const raw = phone.replace(/\D/g, '')
    if (raw.length < 10) { setError('Telefone inválido'); return }
    setLoading(true)
    try {
      const res  = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone: raw }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Erro ao entrar'); return }
      localStorage.setItem('gameToken', data.token)
      localStorage.setItem('userData',  JSON.stringify(data.user))
      router.push('/game')
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="game-bg min-h-screen flex flex-col items-center justify-center px-5"
      style={{
        overflowY: 'auto',
        paddingTop: 'max(20px, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(20px, env(safe-area-inset-bottom, 0px))',
      }}>

      {/* Stars */}
      <Stars />

      {/* Card */}
      <div className="glass rounded-3xl p-7 w-full max-w-[360px] relative z-10 slide-up">

        {/* Logo */}
        <div className="text-center mb-7">
          <div className="text-6xl mb-3 inline-block gold-pulse">🎈</div>
          <h1 className="text-white font-black text-3xl tracking-tight">BalloonBet</h1>
          <p className="text-purple-300/80 text-sm mt-1">Estoure balões. Ganhe de verdade.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="text-purple-200 text-xs font-semibold uppercase tracking-wide block mb-2">
              Seu Nome
            </label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="João Silva"
              autoComplete="name"
              className="w-full px-4 py-3.5 rounded-2xl bg-white/10 border border-white/15 text-white placeholder-white/35
                         focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/25 transition text-base"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="text-purple-200 text-xs font-semibold uppercase tracking-wide block mb-2">
              Telefone
            </label>
            <input
              value={phone}
              onChange={e => setPhone(fmtPhone(e.target.value))}
              placeholder="(11) 99999-9999"
              inputMode="tel"
              autoComplete="tel"
              className="w-full px-4 py-3.5 rounded-2xl bg-white/10 border border-white/15 text-white placeholder-white/35
                         focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/25 transition text-base"
            />
          </div>

          {error && (
            <div className="bg-red-500/15 border border-red-400/30 rounded-2xl px-4 py-3 text-red-300 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-2xl font-black text-lg text-white transition-all active:scale-95
                       bg-gradient-to-r from-purple-600 to-pink-600
                       hover:from-purple-500 hover:to-pink-500
                       disabled:opacity-50 disabled:cursor-not-allowed
                       shadow-lg shadow-purple-900/40 mt-2"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full spin-slow" />
                Entrando...
              </span>
            ) : '🎈 Entrar e Jogar'}
          </button>
        </form>

        <p className="text-white/25 text-xs text-center mt-5 leading-relaxed">
          Ao entrar, você concorda com os Termos de Uso.<br />
          Jogue com responsabilidade. Proibido para menores de 18 anos.
        </p>

        <div className="mt-4 text-center">
          <a href="/admin" className="text-white/20 text-xs hover:text-white/50 transition">
            ⚙️ Painel Admin
          </a>
        </div>
      </div>
    </div>
  )
}

function Stars() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      {Array.from({ length: 50 }, (_, i) => (
        <div key={i} className="absolute rounded-full bg-white"
          style={{
            width:  `${1 + Math.random() * 2}px`,
            height: `${1 + Math.random() * 2}px`,
            left:  `${Math.random() * 100}%`,
            top:   `${Math.random() * 100}%`,
            animation: `twinkle ${2 + Math.random() * 4}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 5}s`,
          }}
        />
      ))}
    </div>
  )
}
