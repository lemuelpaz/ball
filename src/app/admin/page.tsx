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
  const [loadingUsers, setLoadingUsers] = useState(false)

  const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

  useEffect(() => {
    fetch('/api/admin/config', { headers: authHeaders })
      .then(r => r.json())
      .then(d => setConfig(d.config ?? {}))
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (tab !== 'users') return
    setLoadingUsers(true)
    fetch('/api/admin/users', { headers: authHeaders })
      .then(r => r.json())
      .then(d => setUsers(d.users ?? []))
      .catch(() => {})
      .finally(() => setLoadingUsers(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const saveConfig = async () => {
    setSaving(true); setSaved(false)
    await fetch('/api/admin/config', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ config }),
    })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const testGateway = async () => {
    setTesting(true); setTestResult(null)
    const res = await fetch('/api/admin/test-gateway', { method: 'POST', headers: authHeaders })
    const d = await res.json()
    setTestResult(res.ok ? '✅ ' + (d.message ?? 'OK') : '❌ ' + (d.error ?? 'Falha'))
    setTesting(false)
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'gateway',   label: '💳 Gateway'   },
    { key: 'game',      label: '🎮 Jogo'       },
    { key: 'financial', label: '💰 Financeiro' },
    { key: 'users',     label: '👥 Usuários'   },
  ]

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <h1 className="font-black text-lg">⚙️ Painel Admin</h1>
        <div className="flex gap-3">
          <a href="/" className="text-gray-400 text-sm hover:text-white transition">← Jogo</a>
          <button onClick={onLogout} className="text-red-400 text-sm hover:text-red-300 transition">Sair</button>
        </div>
      </header>

      <div className="flex gap-1 px-6 pt-6">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-t-lg text-sm font-semibold transition ${
              tab === t.key
                ? 'bg-gray-800 text-white'
                : 'bg-gray-900 text-gray-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <main className="bg-gray-800 mx-6 rounded-b-2xl rounded-tr-2xl p-6 mb-8">
        {tab === 'gateway'   && <GatewayTab   config={config} setConfig={setConfig} saving={saving} saved={saved} onSave={saveConfig} testing={testing} testResult={testResult} onTest={testGateway} />}
        {tab === 'game'      && <GameTab      config={config} setConfig={setConfig} saving={saving} saved={saved} onSave={saveConfig} />}
        {tab === 'financial' && <FinancialTab config={config} setConfig={setConfig} saving={saving} saved={saved} onSave={saveConfig} />}
        {tab === 'users'     && <UsersTab     users={users} setUsers={setUsers} loading={loadingUsers} token={token} />}
      </main>
    </div>
  )
}

/* ─── Config field helper ─── */
function Field({ label, name, config, setConfig, type = 'text' }: {
  label: string; name: string; config: Record<string, string>
  setConfig: (c: Record<string, string>) => void; type?: string
}) {
  return (
    <div>
      <label className="block text-gray-400 text-sm mb-1">{label}</label>
      <input
        type={type}
        value={config[name] ?? ''}
        onChange={e => setConfig({ ...config, [name]: e.target.value })}
        className="w-full px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-400 transition"
      />
    </div>
  )
}

function SaveBar({ saving, saved, onSave }: { saving: boolean; saved: boolean; onSave: () => void }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <button
        onClick={onSave} disabled={saving}
        className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 font-semibold transition"
      >
        {saving ? 'Salvando…' : 'Salvar'}
      </button>
      {saved && <span className="text-green-400 text-sm">✅ Salvo!</span>}
    </div>
  )
}

/* ─── Gateway Tab ─── */
function GatewayTab({ config, setConfig, saving, saved, onSave, testing, testResult, onTest }: {
  config: Record<string, string>; setConfig: (c: Record<string, string>) => void
  saving: boolean; saved: boolean; onSave: () => void
  testing: boolean; testResult: string | null; onTest: () => void
}) {
  return (
    <div className="space-y-4">
      <h2 className="font-bold text-lg">Configurações do Gateway de Pagamento</h2>
      <Field label="Client ID"     name="GATEWAY_CLIENT_ID"     config={config} setConfig={setConfig} />
      <Field label="Client Secret" name="GATEWAY_CLIENT_SECRET" config={config} setConfig={setConfig} type="password" />
      <Field label="URL Base"      name="GATEWAY_BASE_URL"      config={config} setConfig={setConfig} />
      <SaveBar saving={saving} saved={saved} onSave={onSave} />
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={onTest} disabled={testing}
          className="px-5 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-50 font-semibold transition"
        >
          {testing ? 'Testando…' : 'Testar Conexão'}
        </button>
        {testResult && <span className="text-sm">{testResult}</span>}
      </div>
    </div>
  )
}

/* ─── Game Tab ─── */
function GameTab({ config, setConfig, saving, saved, onSave }: {
  config: Record<string, string>; setConfig: (c: Record<string, string>) => void
  saving: boolean; saved: boolean; onSave: () => void
}) {
  return (
    <div className="space-y-4">
      <h2 className="font-bold text-lg">Configurações do Jogo</h2>
      <Field label="RTP (%)"                 name="GAME_RTP"              config={config} setConfig={setConfig} />
      <Field label="Aposta Mínima (R$)"      name="GAME_BET_MIN"          config={config} setConfig={setConfig} />
      <Field label="Aposta Máxima (R$)"      name="GAME_BET_MAX"          config={config} setConfig={setConfig} />
      <Field label="Multiplicador Máximo"    name="GAME_MAX_MULTIPLIER"   config={config} setConfig={setConfig} />
      <SaveBar saving={saving} saved={saved} onSave={onSave} />
    </div>
  )
}

/* ─── Financial Tab ─── */
function FinancialTab({ config, setConfig, saving, saved, onSave }: {
  config: Record<string, string>; setConfig: (c: Record<string, string>) => void
  saving: boolean; saved: boolean; onSave: () => void
}) {
  return (
    <div className="space-y-4">
      <h2 className="font-bold text-lg">Configurações Financeiras</h2>
      <Field label="Depósito Mínimo (R$)"   name="FINANCE_DEPOSIT_MIN"   config={config} setConfig={setConfig} />
      <Field label="Depósito Máximo (R$)"   name="FINANCE_DEPOSIT_MAX"   config={config} setConfig={setConfig} />
      <Field label="Saque Mínimo (R$)"      name="FINANCE_WITHDRAW_MIN"  config={config} setConfig={setConfig} />
      <Field label="Saque Máximo (R$)"      name="FINANCE_WITHDRAW_MAX"  config={config} setConfig={setConfig} />
      <SaveBar saving={saving} saved={saved} onSave={onSave} />
    </div>
  )
}

/* ─── Users Tab ─── */
function UsersTab({ users, setUsers, loading, token }: {
  users: UserRow[]
  setUsers: (u: UserRow[]) => void
  loading: boolean
  token: string
}) {
  const [editingId,   setEditingId]   = useState<number | null>(null)
  const [editBalance, setEditBalance] = useState('')
  const [savingId,    setSavingId]    = useState<number | null>(null)
  const [errorId,     setErrorId]     = useState<number | null>(null)

  const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

  const startEdit = (user: UserRow) => {
    setEditingId(user.id)
    setEditBalance(String(user.balance))
    setErrorId(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditBalance('')
    setErrorId(null)
  }

  const saveBalance = async (userId: number) => {
    setSavingId(userId)
    setErrorId(null)
    const res = await fetch(`/api/admin/users/${userId}/balance`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ balance: parseFloat(editBalance) }),
    })

    if (!res.ok) {
      setErrorId(userId)
      setSavingId(null)
      return
    }

    const novoSaldo = parseFloat(editBalance)
    setUsers(users.map(u => u.id === userId ? { ...u, balance: novoSaldo } : u))
    setSavingId(null)
    setEditingId(null)
    setEditBalance('')
  }

  if (loading) {
    return <div className="text-gray-400 text-sm py-4">Carregando usuários…</div>
  }

  if (users.length === 0) {
    return <div className="text-gray-400 text-sm py-4">Nenhum usuário encontrado.</div>
  }

  return (
    <div className="space-y-4">
      <h2 className