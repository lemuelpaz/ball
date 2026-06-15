import { getConfig } from './db'

interface VeopagToken { token: string; expiresAt: number }
let cachedToken: VeopagToken | null = null

async function getCredentials() {
  const [clientId, clientSecret, baseUrl] = await Promise.all([
    getConfig('veopag_client_id'),
    getConfig('veopag_client_secret'),
    getConfig('veopag_base_url', 'https://api.veopag.com'),
  ])
  return { clientId, clientSecret, baseUrl }
}

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.token

  const { clientId, clientSecret, baseUrl } = await getCredentials()
  if (!clientId || !clientSecret) throw new Error('VeoPag não configurado. Configure no painel Admin.')

  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret }),
  })

  if (!res.ok) throw new Error('Falha na autenticação com VeoPag')

  const data = await res.json()
  cachedToken = { token: data.token, expiresAt: Date.now() + 55 * 60 * 1000 }
  return data.token
}

export async function veopagCreateDeposit(params: {
  amount: number
  externalId: string
  payer: { name: string; email: string; document: string; phone?: string }
  callbackUrl?: string
}) {
  const { baseUrl } = await getCredentials()
  const token = await getToken()

  const res = await fetch(`${baseUrl}/api/payments/deposit`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: params.amount,
      external_id: params.externalId,
      payer: params.payer,
      clientCallbackUrl: params.callbackUrl,
    }),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.message ?? 'Falha ao criar depósito')
  return data
}

export async function veopagCreateWithdrawal(params: {
  amount: number
  externalId: string
  pixKey: string
  pixKeyType: 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP'
  receiverName: string
}) {
  const { baseUrl } = await getCredentials()
  const token = await getToken()

  const res = await fetch(`${baseUrl}/api/withdrawals/withdraw`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: params.amount,
      external_id: params.externalId,
      pix_key: params.pixKey,
      pix_key_type: params.pixKeyType,
      receiver_name: params.receiverName,
    }),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.message ?? 'Falha ao criar saque')
  return data
}

export async function veopagGetBalance() {
  const { baseUrl } = await getCredentials()
  const token = await getToken()

  const res = await fetch(`${baseUrl}/api/accounts/balance`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.message ?? 'Falha ao consultar saldo')
  return data
}

export function resetTokenCache() {
  cachedToken = null
}
