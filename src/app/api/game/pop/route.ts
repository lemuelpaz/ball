import { NextRequest, NextResponse } from 'next/server'
import { prisma, getConfig } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const user = getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { value } = await req.json()
    if (typeof value !== 'number' || value <= 0) {
      return NextResponse.json({ error: 'Valor inválido' }, { status: 400 })
    }

    const allowedValuesStr = await getConfig('game_balloon_values', '0.10,0.25,0.50,1.00,2.00,5.00')
    const allowedValues = allowedValuesStr.split(',').map(Number)
    const maxAllowed = Math.max(...allowedValues)

    if (value > maxAllowed * 1.01) {
      return NextResponse.json({ error: 'Valor não permitido' }, { status: 400 })
    }

    const [updatedUser] = await prisma.$transaction([
      prisma.user.update({
        where: { id: user.userId },
        data: { balance: { increment: value }, totalWon: { increment: value } },
      }),
      prisma.transaction.create({
        data: { userId: user.userId, type: 'balloon_pop', amount: value, status: 'COMPLETED' },
      }),
    ])

    return NextResponse.json({ balance: updatedUser.balance, earned: value })
  } catch (err) {
    console.error('Pop error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
