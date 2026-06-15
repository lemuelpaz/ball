import { NextRequest, NextResponse } from 'next/server'
import { prisma, getConfig, setConfig } from '@/lib/db'
import { isAdminRequest } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { resetTokenCache } from '@/lib/veopag'

const CONFIG_KEYS = [
  'veopag_client_id', 'veopag_client_secret', 'veopag_base_url',
  'game_balloon_values', 'game_spawn_interval', 'game_min_speed', 'game_max_speed',
  'game_min_size', 'game_max_size', 'game_max_balloons',
  'finance_min_deposit', 'finance_min_withdrawal', 'finance_max_withdrawal', 'finance_daily_limit',
  'admin_password',
]

const DEFAULTS: Record<string, string> = {
  veopag_base_url: 'https://api.veopag.com',
  game_balloon_values: '0.10,0.25,0.50,1.00,2.00,5.00',
  game_spawn_interval: '1500',
  game_min_speed: '4',
  game_max_speed: '8',
  game_min_size: '60',
  game_max_size: '100',
  game_max_balloons: '10',
  finance_min_deposit: '10.00',
  finance_min_withdrawal: '20.00',
  finance_max_withdrawal: '1000.00',
  finance_daily_limit: '5000.00',
}

const PUBLIC_GAME_KEYS = [
  'game_balloon_values', 'game_spawn_interval', 'game_min_speed', 'game_max_speed',
  'game_min_size', 'game_max_size', 'game_max_balloons',
]

export async function GET(req: NextRequest) {
  const isAdmin = isAdminRequest(req)
  if (!isAdmin) {
    // Return only public game config for non-admin requests
    const configs = await prisma.config.findMany({ where: { key: { in: PUBLIC_GAME_KEYS } } })
    const result: Record<string, string> = {}
    for (const k of PUBLIC_GAME_KEYS) result[k] = DEFAULTS[k] ?? ''
    for (const c of configs) result[c.key] = c.value
    return NextResponse.json(result)
  }

  const configs = await prisma.config.findMany({ where: { key: { in: CONFIG_KEYS } } })
  const result: Record<string, string> = { ...DEFAULTS }

  for (const c of configs) {
    if (c.key === 'veopag_client_secret') {
      result[c.key] = c.value ? '••••••••' : ''
    } else if (c.key === 'admin_password') {
      result[c.key] = c.value ? '••••••••' : ''
    } else {
      result[c.key] = c.value
    }
  }

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()

  for (const [key, value] of Object.entries(body)) {
    if (!CONFIG_KEYS.includes(key)) continue
    if (typeof value !== 'string') continue
    if (value === '••••••••') continue

    if (key === 'admin_password' && value) {
      const hashed = await bcrypt.hash(value, 10)
      await setConfig(key, hashed)
    } else if (key === 'veopag_client_id' || key === 'veopag_client_secret') {
      await setConfig(key, value)
      resetTokenCache()
    } else {
      await setConfig(key, value)
    }
  }

  return NextResponse.json({ success: true })
}

export async function PUT(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    const { veopagGetBalance } = await import('@/lib/veopag')
    const balance = await veopagGetBalance()
    return NextResponse.json({ success: true, balance })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro na conexão'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
