import jwt from 'jsonwebtoken'
import { NextRequest } from 'next/server'

const SECRET = process.env.JWT_SECRET ?? 'balloon-game-secret-2024'

export function signUserToken(payload: { userId: number; phone: string }) {
  return jwt.sign({ ...payload, type: 'user' }, SECRET, { expiresIn: '30d' })
}

export function signAdminToken() {
  return jwt.sign({ type: 'admin', isAdmin: true }, SECRET, { expiresIn: '8h' })
}

export function getUserFromRequest(req: NextRequest): { userId: number; phone: string } | null {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  try {
    const payload = jwt.verify(auth.slice(7), SECRET) as Record<string, unknown>
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
    const payload = jwt.verify(auth.slice(7), SECRET) as Record<string, unknown>
    return payload.isAdmin === true
  } catch {
    return false
  }
}
