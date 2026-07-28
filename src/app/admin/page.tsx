'use client'
import { useState, useEffect } from 'react'

type Tab = 'gateway' | 'game' | 'financial' | 'users'

interface UserRow {
  id: number; name: string; phone: string; balance: number
  totalDeposited: number; totalWon: number; createdAt: string
}

export default function AdminPage() {
  const [authed,   setAuthed]   = useState(false)
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [token,    setToken]    = useState('')

  useEffect(() => {
    const t = sessionStorage.getItem('adminToken')
    if (t) { setToken(t); setAuthed(true) }
  }, [])

  const login = async (e: React.FormEvent) => {
    e.preventDefault(); setAuthError('')
    const res = await fetch('/api/auth/login', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    const data = await res.json()
    if (!res.ok) { setAuthError(data.error || 'Senha incorreta'); return }
    sessionStorage.setItem('adminToken', data.token)
    setToken(data.token); setAuthed(true)
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 w-full max-w-sm shadow-2xl">
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">🔐</div>
            <h1 className="text-white font-black text-xl">Painel Admin</h1>
            <p className="text-gray-400 text-sm mt-1">Acesso restrito</p>
          </div>
          <form onSubmit={login} className="space-y-4">
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Senha" autoFocus
              className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-400 transition"
            />
            {authError && <div className="text-red-400 text-sm">{authError}</div>}
            <button type="submit" className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition">
              Entrar
            </button>
          </form>

          <div className="mt-4 text-center">
            <a href="/" className="text-gray-500 text-xs hover:text-gray-300">← Voltar ao jogo</a>
          </div>
        </div>
      </div>
    )
  }

  return <AdminPanel token={token} onLogout={() => { setAuthed(false); sessionStorage.removeItem('adminToken') }} />
}

/* ─── Main Admin Panel ─── */
function AdminPanel({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [tab,     setTab]     = useState<Tab>('gateway')
  const [config,  setConfig]  = useState<Record<string, string>>({})
  const [users,   setUsers]   = useState<UserRow[]>([])
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)

  const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

  useEffect(() => {
    fetch('/api/admin/config', { headers: authHeaders })
      .then(r => r.json()).then(d => setConfig(d.config ?? {}))
    fetch('/api/admin/users', { headers: authHeaders })
      .then(r => r.json()).then(d => setUsers(d.users ?? []))
  }, [])

  const saveConfig = async () => {
    setSaving(true); setSaved(false)
    await fetch('/api/admin/config', {
      method: 'POST', headers: authHeaders, body: JSON.stringify({ config }),
    })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const testGateway = async () => {
    setTesting(true); setTestResult(null)
    const res = await fetch('/api/admin/test-gateway', { method: 'POST', headers: authHeaders })
    const data = await res.json()
    setTestResult(res.ok ? '✅ Conexão OK' : `❌ ${data.error ?? 'Falha'}`)
    setTesting(false)
  }

  /* ─── Ajuste de saldo ─── */
  const [balanceUserId,  setBalanceUserId]  = useState('')
  const [balanceAmount,  setBalanceAmount]  = useState('')
  const [balanceLoading, setBalanceLoading] = useState(false)
  const [balanceError,   setBalanceError]   = useState<string | null>(null)
  const [balanceSuccess, setBalanceSuccess] = useState<string | null>(null)

  const adjustBalance = async (e: React.FormEvent) => {
    e.preventDefault()
    setBalanceError(null)
    setBalanceSuccess(null)
    setBalanceLoading(true)

    const res = await fetch('/api/admin/balance', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ userId: Number(balanceUserId), amount: Number(balanceAmount) }),
    })
    const data = await res.json()

    if (!res.ok) {
      setBalanceError(data.error ?? 'Erro ao ajustar saldo')
      setBalanceLoading(false)
      return
    }

    // Atualiza apenas o usuário afetado no estado local, sem reload
    if (data.user) {
      setUsers(prev =>
        prev.map(u => (u.id === data.user.id ? { ...u, balance: data.user.balance } : u))
      )
    }

    setBalanceSuccess(`Saldo atualizado com sucesso`)
    setBalanceUserId('')
    setBalanceAmount('')
    setBalanceLoading(false)
  }

  /* ─── Render ─── */
  const tabs: { key: Tab; label: string }[] = [
    { key: 'gateway',   label: '💳 Gateway'    },
    { key: 'game',      label: '🎮 Jogo'       },
    { key: 'financial', label: '💰 Financeiro' },
    { key: 'users',     label: '👥 Usuários'   },
  ]

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <h1 className="font-black text-lg">⚙️ Painel Admin</h1>
        <div className="flex gap-3 items-center">
          <a href="/" className="text-gray-400 text-sm hover:text-white">← Jogo</a>
          <button onClick={onLogout} className="text-red-400 text-sm hover:text-red-300">Sair</button>
        </div>
      </header>

      <div className="flex border-b border-gray-800 bg-gray-900">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-3 text-sm font-semibold transition ${
              tab === t.key
                ? 'text-white border-b-2 border-indigo-500'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <main className="p-6 max-w-4xl mx-auto space-y-6">
        {/* ─── Gateway ─── */}
        {tab === 'gateway' && (
          <Section title="Configurações do Gateway">
            <ConfigField label="URL do Gateway" k="gatewayUrl" config={config} onChange={setConfig} />
            <ConfigField label="Chave de API"   k="gatewayKey" config={config} onChange={setConfig} secret />
            <div className="flex gap-3 mt-4">
              <SaveButton saving={saving} saved={saved} onSave={saveConfig} />
              <button
                onClick={testGateway} disabled={testing}
                className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm font-semibold disabled:opacity-50"
              >
                {testing ? 'Testando…' : 'Testar conexão'}
              </button>
            </div>
            {testResult && <p className="text-sm mt-2">{testResult}</p>}
          </Section>
        )}

        {/* ─── Game ─── */}
        {tab === 'game' && (
          <Section title="Configurações do Jogo">
            <ConfigField label="RTP (%)"          k="rtp"         config={config} onChange={setConfig} />
            <ConfigField label="Aposta mínima"    k="minBet"      config={config} onChange={setConfig} />
            <ConfigField label="Aposta máxima"    k="maxBet"      config={config} onChange={setConfig} />
            <ConfigField label="Multiplicador max" k="maxMultiplier" config={config} onChange={setConfig} />
            <SaveButton saving={saving} saved={saved} onSave={saveConfig} />
          </Section>
        )}

        {/* ─── Financial ─── */}
        {tab === 'financial' && (
          <Section title="Configurações Financeiras">
            <ConfigField label="Depósito mínimo"  k="minDeposit"  config={config} onChange={setConfig} />
            <ConfigField label="Saque mínimo"     k="minWithdraw" config={config} onChange={setConfig} />
            <ConfigField label="Taxa de saque (%)" k="withdrawFee" config={config} onChange={setConfig} />
            <SaveButton saving={saving} saved={saved} onSave={saveConfig} />

            <hr className="border-gray-800 my-6" />

            <h3 className="text-sm font-bold text-gray-300 mb-3">Ajustar saldo manualmente</h3>
            <form onSubmit={adjustBalance} className="flex flex-wrap gap-3 items-end">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-400">ID do usuário</label>
                <input
                  type="number" value={balanceUserId} onChange={e => setBalanceUserId(e.target.value)}
                  required min={1}
                  className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-600 text-white text-sm w-32 focus:outline-none focus:border-indigo-400"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-400">Valor (positivo ou negativo)</label>
                <input
                  type="number" value={balanceAmount} onChange={e => setBalanceAmount(e.target.value)}
                  required step="0.01"
                  className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-600 text-white text-sm w-40 focus:outline-none focus:border-indigo-400"
                />
              </div>
              <button
                type="submit" disabled={balanceLoading}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold disabled:opacity-50"
              >
                {balanceLoading ? 'Salvando…' : 'Aplicar'}
              </button>
            </form>
            {balanceError   && <p className="text-red-400 text-sm mt-2">{balanceError}</p>}
            {balanceSuccess && <p className="text-green-400 text-sm mt-2">{balanceSuccess}</p>}
          </Section>
        )}

        {/* ─── Users ─── */}
        {tab === 'users' && (
          <Section title="Usuários cadastrados">
            {users.length === 0
              ? <p className="text-gray-500 text-sm">Nenhum usuário encontrado.</p>
              : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-400 border-b border-gray-800">
                        <th className="text-left py-2 pr-4">ID</th>
                        <th className="text-left py-2 pr-4">Nome</th>
                        <th className="text-left py-2 pr-4">Telefone</th>
                        <th className="text-right py-2 pr-4">Saldo</th>
                        <th className="text-right py-2 pr-4">Depositado</th>
                        <th className="text-right py-2">Ganhos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(u => (
                        <tr key={u.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                          <td className="py-2 pr-4 text-gray-400">{u.id}</td>
                          <td className="py-2 pr-4">{u.name}</td>
                          <td className="py-2 pr-4 text-gray-400">{u.phone}</td>
                          <td className="py-2 pr-4 text-right text-green-400">
                            R$ {u.balance.toFixed(2)}
                          </td>
                          <td className="py-2 pr-4 text-right text-blue-400">
                            R$ {u.totalDeposited.toFixed(2)}
                          </td>
                          <td className="py-2 text-right text-yellow-400">
                            R$ {u.totalWon.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            }
          </Section>
        )}
      </main>
    </div>
  )
}

/* ─── Componentes auxiliares ─── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <h2 className="text-base font-bold mb-5">{title}</h2>
      {children}
    </div>
  )
}

function ConfigField({
  label, k, config, onChange, secret = false,
}: {
  label: string
  k: string
  config: Record<string, string>
  onChange: (c: Record<string, string>) => void
  secret?: boolean
}) {
  return