import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { isAdminRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') ?? '1')
  const limit = 20

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true, name: true, phone: true, balance: true,
        totalDeposited: true, totalWon: true, createdAt: true,
      },
    }),
    prisma.user.count(),
  ])

  return NextResponse.json({ users, total, page, pages: Math.ceil(total / limit) })
}

export async function PATCH(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { userId, balance } = await req.json()
  if (!userId || typeof balance !== 'number') {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { balance },
  })

  return NextResponse.json({ success: true, balance: user.balance })
}
