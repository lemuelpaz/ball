import { NextRequest, NextResponse } from 'next/server'
import { prisma, getConfig } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { veopagCreateWithdrawal } from '@/lib/veopag'
import { randomUUID } from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const user = getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const body = await req.json()
    const { amount, pixKey, pixKeyType } = body

    const [minStr, maxStr, dailyLimitStr] = await Promise.all([
      getConfig('finance_min_withdrawal', '20.00'),
      getConfig('finance_max_withdrawal', '1000.00'),
      getConfig('finance_daily_limit', '5000.00'),
    ])

    const minWithdrawal = parseFloat(minStr)
    const maxWithdrawal = parseFloat(maxStr)
    const dailyLimit = parseFloat(dailyLimitStr)

    if (!amount || typeof amount !== 'number' || amount < minWithdrawal) {
      return NextResponse.json({ error: `Saque mínimo: R$ ${minWithdrawal.toFixed(2)}` }, { status: 400 })
    }
    if (amount > maxWithdrawal) {
      return NextResponse.json({ error: `Saque máximo: R$ ${maxWithdrawal.toFixed(2)}` }, { status: 400 })
    }
    if (!pixKey || typeof pixKey !== 'string' || !pixKeyType || typeof pixKeyType !== 'string') {
      return NextResponse.json({ error: 'Chave PIX é obrigatória' }, { status: 400 })
    }

    const dbUser = await prisma.user.findUnique({ where: { id: user.userId } })
    if (!dbUser) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    if (dbUser.balance < amount) {
      return NextResponse.json({ error: 'Saldo insuficiente' }, { status: 400 })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayWithdrawals = await prisma.transaction.aggregate({
      where: {
        userId: user.userId,
        type: 'withdrawal',
        status: { in: ['COMPLETED', 'PENDING'] },
        createdAt: { gte: today },
      },
      _sum: { amount: true },
    })

    const todayTotal = todayWithdrawals._sum.amount ?? 0
    if (todayTotal + amount > dailyLimit) {
      return NextResponse.json({ error: `Limite diário de R$ ${dailyLimit.toFixed(2)} atingido` }, { status: 400 })
    }

    const externalId = randomUUID()

    // Chama o gateway antes de qualquer persistência — se falhar, nada é gravado
    const gatewayResult = await veopagCreateWithdrawal({
      amount,
      externalId,
      pixKey,
      pixKeyType,
      receiverName: dbUser.name,
    })

    // Persiste o débito e o registro de transação atomicamente apenas após
    // confirmação do gateway, eliminando a necessidade de rollback manual
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.userId },
        data: { balance: { decrement: amount } },
      }),
      prisma.transaction.create({
        data: {
          userId: user.userId,
          type: 'withdrawal',
          amount,
          status: 'PENDING',
          externalId,
          metadata: JSON.stringify(gatewayResult),
        },
      }),
    ])

    return NextResponse.json({ success: true, externalId, message: 'Saque solicitado com sucesso' })
  } catch (err) {
    // Erro genérico para não expor detalhes internos ao cliente
    return NextResponse.json({ error: 'Erro interno ao processar saque' }, { status: 500 })
  }
}