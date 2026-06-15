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
          <p className="text-gray-600 text-xs text-center mt-4">Senha padrão: admin123</p>
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
  const [testResult, setTestResult] = useState('')
  const [userTotal, setUserTotal] = useState(0)

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  useEffect(() => {
    fetch('/api/admin/config', { headers }).then(r => r.json()).then(setConfig).catch(() => {})
  }, [])

  useEffect(() => {
    if (tab === 'users') {
      fetch('/api/admin/users', { headers }).then(r => r.json()).then(d => {
        setUsers(d.users ?? [])
        setUserTotal(d.total ?? 0)
      }).catch(() => {})
    }
  }, [tab])

  const saveConfig = async (updates: Record<string, string>) => {
    setSaving(true); setSaved(false)
    try {
      await fetch('/api/admin/config', { method: 'POST', headers, body: JSON.stringify(updates) })
      setConfig(prev => ({ ...prev, ...updates }))
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally { setSaving(false) }
  }

  const testConnection = async () => {
    setTesting(true); setTestResult('')
    try {
      const res = await fetch('/api/admin/config', { method: 'PUT', headers })
      const data = await res.json()
      if (res.ok) setTestResult(`✅ Conectado! Saldo: R$ ${data.balance?.available?.toFixed(2) ?? 'N/A'}`)
      else setTestResult(`❌ ${data.error}`)
    } catch { setTestResult('❌ Erro de conexão') } finally { setTesting(false) }
  }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'gateway',   label: 'Gateway',   icon: '🔌' },
    { id: 'game',      label: 'Jogo',      icon: '🎮' },
    { id: 'financial', label: 'Financeiro',icon: '💰' },
    { id: 'users',     label: 'Usuários',  icon: '👥' },
  ]

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col" style={{ overflowY: 'auto' }}>
      {/* Top bar */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center gap-4">
        <span className="text-2xl">⚙️</span>
        <span className="text-white font-black text-xl">BalloonBet Admin</span>
        <div className="ml-auto flex items-center gap-3">
          {saved && <span className="text-green-400 text-sm font-medium">✓ Salvo!</span>}
          <a href="/" className="px-3 py-2 rounded-lg bg-gray-800 text-gray-300 text-sm hover:bg-gray-700 transition">
            🎈 Ver Jogo
          </a>
          <button onClick={onLogout} className="px-3 py-2 rounded-lg bg-gray-800 text-gray-300 text-sm hover:bg-gray-700 transition">
            Sair
          </button>
        </div>
      </div>

      <div className="flex flex-1">
        {/* Sidebar */}
        <div className="w-56 bg-gray-900 border-r border-gray-800 flex-shrink-0 p-4 space-y-1">
          {tabs.map(t => (
            <button
              key={t.id} onClick={() => setTab(t.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition ${
                tab === t.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <span className="text-lg">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">

          {/* ─── GATEWAY TAB ─── */}
          {tab === 'gateway' && (
            <GatewayTab config={config} onSave={saveConfig} onTest={testConnection}
              testing={testing} testResult={testResult} saving={saving} />
          )}

          {/* ─── GAME TAB ─── */}
          {tab === 'game' && (
            <GameConfigTab config={config} onSave={saveConfig} saving={saving} />
          )}

          {/* ─── FINANCIAL TAB ─── */}
          {tab === 'financial' && (
            <FinancialTab config={config} onSave={saveConfig} saving={saving} />
          )}

          {/* ─── USERS TAB ─── */}
          {tab === 'users' && (
            <UsersTab users={users} total={userTotal} token={token} />
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Gateway Tab ─── */
function GatewayTab({ config, onSave, onTest, testing, testResult, saving }: {
  config: Record<string,string>; onSave: (u: Record<string,string>) => void
  onTest: () => void; testing: boolean; testResult: string; saving: boolean
}) {
  const [form, setForm] = useState({ veopag_client_id: '', veopag_client_secret: '', veopag_base_url: '' })
  useEffect(() => {
    setForm({
      veopag_client_id:     config.veopag_client_id     ?? '',
      veopag_client_secret: config.veopag_client_secret ?? '',
      veopag_base_url:      config.veopag_base_url      ?? 'https://api.veopag.com',
    })
  }, [config])

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-white font-black text-2xl">🔌 Configurações de Gateway</h2>
        <p className="text-gray-400 text-sm mt-1">Credenciais da VeoPag para processamento de pagamentos PIX</p>
      </div>

      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 space-y-4">
        <h3 className="text-indigo-400 font-bold">Credenciais VeoPag</h3>

        <div>
          <label className="text-gray-300 text-sm font-medium block mb-1.5">Client ID</label>
          <input value={form.veopag_client_id} onChange={e => f('veopag_client_id', e.target.value)}
            placeholder="Seu client_id do dashboard VeoPag"
            className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-400 transition" />
        </div>

        <div>
          <label className="text-gray-300 text-sm font-medium block mb-1.5">Client Secret</label>
          <input type="password" value={form.veopag_client_secret} onChange={e => f('veopag_client_secret', e.target.value)}
            placeholder="••••••••••••••••"
            className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-400 transition" />
          <p className="text-yellow-500/70 text-xs mt-1">⚠ O client_secret é exibido uma única vez no dashboard. Guarde-o com segurança.</p>
        </div>

        <div>
          <label className="text-gray-300 text-sm font-medium block mb-1.5">Base URL</label>
          <input value={form.veopag_base_url} onChange={e => f('veopag_base_url', e.target.value)}
            placeholder="https://api.veopag.com"
            className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-400 transition" />
        </div>

        <div className="flex gap-3">
          <button onClick={() => onSave(form)} disabled={saving}
            className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition disabled:opacity-50">
            {saving ? 'Salvando...' : 'Salvar Credenciais'}
          </button>
          <button onClick={onTest} disabled={testing}
            className="px-6 py-3 rounded-xl bg-green-700 hover:bg-green-600 text-white font-bold transition disabled:opacity-50">
            {testing ? 'Testando...' : '🔗 Testar'}
          </button>
        </div>

        {testResult && (
          <div className={`rounded-xl px-4 py-3 text-sm ${testResult.startsWith('✅') ? 'bg-green-900/40 text-green-300 border border-green-700/40' : 'bg-red-900/40 text-red-300 border border-red-700/40'}`}>
            {testResult}
          </div>
        )}
      </div>

      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 space-y-3">
        <h3 className="text-indigo-400 font-bold">Webhook URL</h3>
        <p className="text-gray-400 text-sm">Configure esta URL no dashboard da VeoPag para receber notificações de pagamento:</p>
        <div className="bg-gray-800 rounded-xl px-4 py-3 font-mono text-green-400 text-sm break-all select-all">
          {typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/api/webhooks/veopag
        </div>
        <p className="text-gray-500 text-xs">Eventos: Deposit (COMPLETED), Withdrawal (COMPLETED)</p>
      </div>

      <div className="bg-blue-950/40 border border-blue-800/40 rounded-2xl p-5">
        <h3 className="text-blue-300 font-bold mb-2">📖 Documentação VeoPag</h3>
        <ul className="text-gray-400 text-sm space-y-1">
          <li>• Autenticação: POST /api/auth/login com client_id + client_secret</li>
          <li>• Depósito PIX: POST /api/payments/deposit</li>
          <li>• Saque PIX: POST /api/withdrawals/withdraw</li>
          <li>• Saldo: GET /api/accounts/balance</li>
          <li>• Token válido por 1h — cache de 55 min recomendado</li>
        </ul>
      </div>
    </div>
  )
}

/* ─── Game Config Tab ─── */
function GameConfigTab({ config, onSave, saving }: {
  config: Record<string,string>; onSave: (u: Record<string,string>) => void; saving: boolean
}) {
  const [form, setForm] = useState({
    game_balloon_values: '0.10,0.25,0.50,1.00,2.00,5.00',
    game_spawn_interval: '1500',
    game_min_speed: '4',
    game_max_speed: '8',
    game_min_size: '60',
    game_max_size: '100',
    game_max_balloons: '10',
  })
  useEffect(() => {
    setForm(p => ({
      game_balloon_values: config.game_balloon_values ?? p.game_balloon_values,
      game_spawn_interval: config.game_spawn_interval ?? p.game_spawn_interval,
      game_min_speed:      config.game_min_speed      ?? p.game_min_speed,
      game_max_speed:      config.game_max_speed      ?? p.game_max_speed,
      game_min_size:       config.game_min_size        ?? p.game_min_size,
      game_max_size:       config.game_max_size        ?? p.game_max_size,
      game_max_balloons:   config.game_max_balloons    ?? p.game_max_balloons,
    }))
  }, [config])

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-white font-black text-2xl">🎮 Configurações do Jogo</h2>
        <p className="text-gray-400 text-sm mt-1">Ajuste a dinâmica dos balões e prêmios</p>
      </div>

      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 space-y-5">
        <div>
          <label className="text-gray-300 text-sm font-medium block mb-1">
            Valores dos Balões (R$) <span className="text-gray-500">separados por vírgula</span>
          </label>
          <input value={form.game_balloon_values} onChange={e => f('game_balloon_values', e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-600 text-white focus:outline-none focus:border-indigo-400 transition" />
          <p className="text-gray-500 text-xs mt-1">Ex: 0.10,0.25,0.50,1.00,2.00,5.00</p>
        </div>

        <div>
          <label className="text-gray-300 text-sm font-medium block mb-1">
            Intervalo de Spawn (ms)
          </label>
          <input type="number" value={form.game_spawn_interval} onChange={e => f('game_spawn_interval', e.target.value)}
            min="500" max="10000"
            className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-600 text-white focus:outline-none focus:border-indigo-400 transition" />
          <p className="text-gray-500 text-xs mt-1">Tempo entre cada balão novo (ms). Menor = mais rápido.</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-gray-300 text-sm font-medium block mb-1">Velocidade Mín (s)</label>
            <input type="number" value={form.game_min_speed} onChange={e => f('game_min_speed', e.target.value)}
              min="1" max="20" step="0.5"
              className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-600 text-white focus:outline-none focus:border-indigo-400 transition" />
          </div>
          <div>
            <label className="text-gray-300 text-sm font-medium block mb-1">Velocidade Máx (s)</label>
            <input type="number" value={form.game_max_speed} onChange={e => f('game_max_speed', e.target.value)}
              min="1" max="20" step="0.5"
              className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-600 text-white focus:outline-none focus:border-indigo-400 transition" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-gray-300 text-sm font-medium block mb-1">Tamanho Mín (px)</label>
            <input type="number" value={form.game_min_size} onChange={e => f('game_min_size', e.target.value)}
              min="30" max="200"
              className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-600 text-white focus:outline-none focus:border-indigo-400 transition" />
          </div>
          <div>
            <label className="text-gray-300 text-sm font-medium block mb-1">Tamanho Máx (px)</label>
            <input type="number" value={form.game_max_size} onChange={e => f('game_max_size', e.target.value)}
              min="30" max="200"
              className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-600 text-white focus:outline-none focus:border-indigo-400 transition" />
          </div>
          <div>
            <label className="text-gray-300 text-sm font-medium block mb-1">Máx Balões Tela</label>
            <input type="number" value={form.game_max_balloons} onChange={e => f('game_max_balloons', e.target.value)}
              min="1" max="30"
              className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-600 text-white focus:outline-none focus:border-indigo-400 transition" />
          </div>
        </div>

        <button onClick={() => onSave(form)} disabled={saving}
          className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition disabled:opacity-50">
          {saving ? 'Salvando...' : 'Salvar Configurações do Jogo'}
        </button>
      </div>
    </div>
  )
}

/* ─── Financial Tab ─── */
function FinancialTab({ config, onSave, saving }: {
  config: Record<string,string>; onSave: (u: Record<string,string>) => void; saving: boolean
}) {
  const [form, setForm] = useState({
    finance_min_deposit: '10.00',
    finance_min_withdrawal: '20.00',
    finance_max_withdrawal: '1000.00',
    finance_daily_limit: '5000.00',
    admin_password: '',
  })
  useEffect(() => {
    setForm(p => ({
      finance_min_deposit:     config.finance_min_deposit     ?? p.finance_min_deposit,
      finance_min_withdrawal:  config.finance_min_withdrawal  ?? p.finance_min_withdrawal,
      finance_max_withdrawal:  config.finance_max_withdrawal  ?? p.finance_max_withdrawal,
      finance_daily_limit:     config.finance_daily_limit     ?? p.finance_daily_limit,
      admin_password: '',
    }))
  }, [config])

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  const handleSave = () => {
    const updates: Record<string, string> = { ...form }
    if (!updates.admin_password) delete updates.admin_password
    onSave(updates)
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-white font-black text-2xl">💰 Configurações Financeiras</h2>
        <p className="text-gray-400 text-sm mt-1">Limites de depósito e saque</p>
      </div>

      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 space-y-5">
        <h3 className="text-indigo-400 font-bold">Limites de Transação</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-gray-300 text-sm font-medium block mb-1">Depósito Mínimo (R$)</label>
            <input type="number" value={form.finance_min_deposit} onChange={e => f('finance_min_deposit', e.target.value)}
              min="1" step="0.01"
              className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-600 text-white focus:outline-none focus:border-indigo-400 transition" />
          </div>
          <div>
            <label className="text-gray-300 text-sm font-medium block mb-1">Saque Mínimo (R$)</label>
            <input type="number" value={form.finance_min_withdrawal} onChange={e => f('finance_min_withdrawal', e.target.value)}
              min="1" step="0.01"
              className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-600 text-white focus:outline-none focus:border-indigo-400 transition" />
          </div>
          <div>
            <label className="text-gray-300 text-sm font-medium block mb-1">Saque Máximo (R$)</label>
            <input type="number" value={form.finance_max_withdrawal} onChange={e => f('finance_max_withdrawal', e.target.value)}
              min="1" step="0.01"
              className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-600 text-white focus:outline-none focus:border-indigo-400 transition" />
          </div>
          <div>
            <label className="text-gray-300 text-sm font-medium block mb-1">Limite Diário Saque (R$)</label>
            <input type="number" value={form.finance_daily_limit} onChange={e => f('finance_daily_limit', e.target.value)}
              min="1" step="0.01"
              className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-600 text-white focus:outline-none focus:border-indigo-400 transition" />
          </div>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 space-y-4">
        <h3 className="text-indigo-400 font-bold">Segurança Admin</h3>
        <div>
          <label className="text-gray-300 text-sm font-medium block mb-1">Nova Senha Admin</label>
          <input type="password" value={form.admin_password} onChange={e => f('admin_password', e.target.value)}
            placeholder="Deixe em branco para não alterar"
            className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-400 transition" />
        </div>
      </div>

      <button onClick={handleSave} disabled={saving}
        className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition disabled:opacity-50">
        {saving ? 'Salvando...' : 'Salvar Configurações Financeiras'}
      </button>
    </div>
  )
}

/* ─── Users Tab ─── */
function UsersTab({ users, total, token }: { users: UserRow[]; total: number; token: string }) {
  const [editId,       setEditId]       = useState<number | null>(null)
  const [editBalance,  setEditBalance]  = useState('')
  const [saving,       setSaving]       = useState(false)

  const saveBalance = async (userId: number) => {
    setSaving(true)
    try {
      await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, balance: parseFloat(editBalance) }),
      })
      setEditId(null)
      window.location.reload()
    } finally { setSaving(false) }
  }

  const totalBalance = users.reduce((s, u) => s + u.balance, 0)

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-white font-black text-2xl">👥 Usuários</h2>
        <p className="text-gray-400 text-sm mt-1">{total} usuário(s) cadastrado(s)</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Usuários', value: total, icon: '👤' },
          { label: 'Saldo Total', value: `R$ ${totalBalance.toFixed(2)}`, icon: '💰' },
          { label: 'Total Ganho', value: `R$ ${users.reduce((s,u)=>s+u.totalWon,0).toFixed(2)}`, icon: '🎈' },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 border border-gray-700 rounded-xl p-4">
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className="text-white font-black text-xl">{s.value}</div>
            <div className="text-gray-400 text-xs">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                {['#','Nome','Telefone','Saldo','Depositado','Ganhos','Cadastro','Ações'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-gray-400 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition">
                  <td className="px-4 py-3 text-gray-500">{u.id}</td>
                  <td className="px-4 py-3 text-white font-medium">{u.name}</td>
                  <td className="px-4 py-3 text-gray-300">{u.phone}</td>
                  <td className="px-4 py-3">
                    {editId === u.id ? (
                      <div className="flex gap-2">
                        <input type="number" value={editBalance} onChange={e => setEditBalance(e.target.value)}
                          step="0.01"
                          className="w-24 px-2 py-1 rounded bg-gray-700 border border-gray-500 text-white text-xs focus:outline-none" />
                        <button onClick={() => saveBalance(u.id)} disabled={saving}
                          className="px-2 py-1 rounded bg-green-700 text-white text-xs disabled:opacity-50">✓</button>
                        <button onClick={() => setEditId(null)}
                          className="px-2 py-1 rounded bg-gray-700 text-white text-xs">✕</button>
                      </div>
                    ) : (
                      <span className="text-yellow-400 font-bold">R$ {u.balance.toFixed(2)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-green-400">R$ {u.totalDeposited.toFixed(2)}</td>
                  <td className="px-4 py-3 text-purple-400">R$ {u.totalWon.toFixed(2)}</td>
                  <td className="px-4 py-3 text-gray-400">{new Date(u.createdAt).toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => { setEditId(u.id); setEditBalance(u.balance.toFixed(2)) }}
                      className="px-3 py-1 rounded-lg bg-indigo-700 hover:bg-indigo-600 text-white text-xs transition">
                      Editar Saldo
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
