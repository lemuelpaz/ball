import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.log('VeoPag webhook:', JSON.stringify(body, null, 2))

    const { event, data } = body

    if (event === 'Deposit' && data?.status === 'COMPLETED') {
      const externalId = data.external_id || data.externalId
      if (!externalId) return NextResponse.json({ received: true })

      const transaction = await prisma.transaction.findUnique({
        where: { externalId },
        include: { user: true },
      })

      if (transaction && transaction.status === 'PENDING') {
        await prisma.$transaction([
          prisma.transaction.update({
            where: { externalId },
            data: { status: 'COMPLETED' },
          }),
          prisma.user.update({
            where: { id: transaction.userId },
            data: {
              balance: { increment: transaction.amount },
              totalDeposited: { increment: transaction.amount },
            },
          }),
        ])
        console.log(`Deposit confirmed: ${externalId} R$${transaction.amount} user ${transaction.userId}`)
      }
    }

    if (event === 'Withdrawal' && data?.status === 'COMPLETED') {
      const externalId = data.external_id || data.externalId
      if (externalId) {
        await prisma.transaction.update({
          where: { externalId },
          data: { status: 'COMPLETED' },
        })
      }
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Webhook error:', err)
    return NextResponse.json({ error: 'Webhook error' }, { status: 500 })
  }
}
