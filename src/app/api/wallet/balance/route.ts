import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const dbUser = await prisma.user.findUnique({ where: { id: user.userId } })
  if (!dbUser) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

  const transactions = await prisma.transaction.findMany({
    where: { userId: user.userId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  return NextResponse.json({
    balance: dbUser.balance,
    totalDeposited: dbUser.totalDeposited,
    totalWon: dbUser.totalWon,
    transactions,
  })
}
