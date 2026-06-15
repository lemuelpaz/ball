import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { signUserToken } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { getConfig, setConfig } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const { name, phone } = await req.json()

    if (!name?.trim() || !phone?.trim()) {
      return NextResponse.json({ error: 'Nome e telefone são obrigatórios' }, { status: 400 })
    }

    const cleanPhone = phone.replace(/\D/g, '')
    if (cleanPhone.length < 10) {
      return NextResponse.json({ error: 'Telefone inválido' }, { status: 400 })
    }

    let user = await prisma.user.findUnique({ where: { phone: cleanPhone } })

    if (!user) {
      user = await prisma.user.create({
        data: { name: name.trim(), phone: cleanPhone, balance: 0 },
      })
    }

    const token = signUserToken({ userId: user.id, phone: user.phone })

    return NextResponse.json({
      token,
      user: { id: user.id, name: user.name, phone: user.phone, balance: user.balance },
    })
  } catch (err) {
    console.error('Login error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { password } = await req.json()
    if (!password) return NextResponse.json({ error: 'Senha obrigatória' }, { status: 400 })

    const adminHash = await getConfig('admin_password')
    if (!adminHash) {
      const defaultHash = await bcrypt.hash('admin123', 10)
      await setConfig('admin_password', defaultHash)
      const match = await bcrypt.compare(password, defaultHash)
      if (!match) return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 })
    } else {
      const match = await bcrypt.compare(password, adminHash)
      if (!match) return NextResponse.json({ error: 'Senha incorreta' }, { status: 401 })
    }

    const { signAdminToken } = await import('@/lib/auth')
    const token = signAdminToken()
    return NextResponse.json({ token })
  } catch (err) {
    console.error('Admin login error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
