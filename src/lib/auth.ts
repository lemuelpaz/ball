import jwt from 'jsonwebtoken'
import { NextRequest } from 'next/server'

export function validateEnvConfig(): void {
  if (!process.env.JWT_SECRET) {
    throw new Error(
      '[auth] JWT_SECRET is required. Add JWT_SECRET=<strong-random-secret> to your .env file.'
    )
  }
}

function getSecret(): string {
  validateEnvConfig()
  return process.env.JWT_SECRET as string
}

export function signUserToken(payload: { userId: number; phone: string }) {
  return jwt.sign({ ...payload, type: 'user' }, getSecret(), { expiresIn: '30d' })
}

export function signAdminToken() {
  return jwt.sign({ type: 'admin', isAdmin: true }, getSecret(), { expiresIn: '8h' })
}

export function getUserFromRequest(req: NextRequest): { userId: number; phone: string } | null {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  try {
    const payload = jwt.verify(auth.slice(7), getSecret()) as Record<string, unknown>
    if (payload.type !== 'user') return null
    return { userId: payload.userId as number, phone: payload.phone as string }
  } catch {
    return null
  }
}

export function isAdminRequest(req: NextRequest): boolean {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return false
  try {
    const payload = jwt.verify(auth.slice(7), getSecret()) as Record<string, unknown>
    return payload.isAdmin === true
  } catch {
    return false
  }
}
