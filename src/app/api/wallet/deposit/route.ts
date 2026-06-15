import { NextRequest, NextResponse } from 'next/server'
import { prisma, getConfig } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { veopagCreateDeposit } from '@/lib/veopag'
import { randomUUID } from 'crypto'

/* GET — check status of a pending deposit */
export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const externalId = searchParams.get('externalId')
  if (!externalId) return NextResponse.json({ error: 'externalId obrigatório' }, { status: 400 })

  const tx = await prisma.transaction.findUnique({
    where: { externalId },
    select: { userId: true, status: true, amount: true },
  })

  if (!tx || tx.userId !== user.userId) {
    return NextResponse.json({ error: 'Transação não encontrada' }, { status: 404 })
  }

  return NextResponse.json({ status: tx.status, amount: tx.amount })
}

/* POST — create a new PIX deposit */
export async function POST(req: NextRequest) {
  try {
    const user = getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { amount, cpf, email } = await req.json()

    const minDeposit = parseFloat(await getConfig('finance_min_deposit', '10.00'))
    if (!amount || Number(amount) < minDeposit) {
      return NextResponse.json(
        { error: `Depósito mínimo: R$ ${minDeposit.toFixed(2)}` },
        { status: 400 },
      )
    }

    const cleanCpf = String(cpf ?? '').replace(/\D/g, '')
    if (cleanCpf.length !== 11) {
      return NextResponse.json({ error: 'CPF inválido (11 dígitos)' }, { status: 400 })
    }

    const dbUser = await prisma.user.findUnique({ where: { id: user.userId } })
    if (!dbUser) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    const externalId  = randomUUID()
    const appUrl      = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const callbackUrl = `${appUrl}/api/webhooks/veopag`

    const depositResult = await veopagCreateDeposit({
      amount: Number(amount),
      externalId,
      payer: {
        name:     dbUser.name,
        email:    email || `${cleanCpf}@baloonbet.com`,
        document: cleanCpf,
        phone:    dbUser.phone,
      },
      callbackUrl,
    })

    await Promise.all([
      prisma.transaction.create({
        data: {
          userId:     user.userId,
          type:       'deposit',
          amount:     Number(amount),
          status:     'PENDING',
          externalId,
          metadata:   JSON.stringify({ qrcode: depositResult.qrCodeResponse?.qrcode }),
        },
      }),
      prisma.user.update({
        where: { id: user.userId },
        data:  { cpf: cleanCpf, email: email || dbUser.email || undefined },
      }),
    ])

    return NextResponse.json({
      externalId,
      qrcode:        depositResult.qrCodeResponse?.qrcode ?? '',
      transactionId: depositResult.qrCodeResponse?.transactionId ?? '',
      amount:        Number(amount),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao criar depósito'
    console.error('Deposit error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
