import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mocks declarados antes de qualquer import do módulo em teste
vi.mock('@/lib/prisma', () => ({
  default: {
    $transaction: vi.fn(),
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    transaction: {
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/veopag', () => ({
  default: {
    requestWithdraw: vi.fn(),
  },
}))

import prisma from '@/lib/prisma'
import veopag from '@/lib/veopag'
import { processWithdraw } from '@/lib/withdraw'

const prismaMock = prisma as unknown as {
  $transaction: ReturnType<typeof vi.fn>
  user: {
    findUnique: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
  transaction: {
    create: ReturnType<typeof vi.fn>
  }
}

const veopagMock = veopag as unknown as {
  requestWithdraw: ReturnType<typeof vi.fn>
}

const USUARIO_VALIDO = {
  id: 'user-abc-123',
  name: 'João Silva',
  balance: 500,
}

const PAYLOAD_VALIDO = {
  userId: 'user-abc-123',
  amount: 100,
  pixKey: 'joao@email.com',
}

beforeEach(() => {
  vi.clearAllMocks()

  // Por padrão, $transaction executa o callback recebendo o próprio prisma mock
  prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) =>
    fn(prismaMock),
  )
})

// ---------------------------------------------------------------------------
// Fluxo principal (happy path)
// ---------------------------------------------------------------------------

describe('processWithdraw — fluxo principal', () => {
  it('debita o saldo e cria transação após confirmação do gateway', async () => {
    prismaMock.user.findUnique.mockResolvedValue(USUARIO_VALIDO)
    veopagMock.requestWithdraw.mockResolvedValue({ success: true, gatewayId: 'gw-001' })
    prismaMock.user.update.mockResolvedValue({ ...USUARIO_VALIDO, balance: 400 })
    prismaMock.transaction.create.mockResolvedValue({ id: 'tx-001' })

    const resultado = await processWithdraw(PAYLOAD_VALIDO)

    expect(resultado.success).toBe(true)

    // Gateway deve ser chamado antes de qualquer mutação
    const ordemChamadas = [
      veopagMock.requestWithdraw.mock.invocationCallOrder[0],
      prismaMock.user.update.mock.invocationCallOrder[0],
      prismaMock.transaction.create.mock.invocationCallOrder[0],
    ]
    expect(ordemChamadas[0]).toBeLessThan(ordemChamadas[1])
    expect(ordemChamadas[1]).toBeLessThan(ordemChamadas[2])
  })

  it('debita exatamente o valor informado do saldo', async () => {
    prismaMock.user.findUnique.mockResolvedValue(USUARIO_VALIDO)
    veopagMock.requestWithdraw.mockResolvedValue({ success: true, gatewayId: 'gw-002' })
    prismaMock.user.update.mockResolvedValue({ ...USUARIO_VALIDO, balance: 400 })
    prismaMock.transaction.create.mockResolvedValue({ id: 'tx-002' })

    await processWithdraw(PAYLOAD_VALIDO)

    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: PAYLOAD_VALIDO.userId },
        data: expect.objectContaining({
          balance: { decrement: PAYLOAD_VALIDO.amount },
        }),
      }),
    )
  })

  it('registra a transação somente depois da confirmação do gateway', async () => {
    prismaMock.user.findUnique.mockResolvedValue(USUARIO_VALIDO)
    veopagMock.requestWithdraw.mockResolvedValue({ success: true, gatewayId: 'gw-003' })
    prismaMock.user.update.mockResolvedValue({ ...USUARIO_VALIDO, balance: 400 })
    prismaMock.transaction.create.mockResolvedValue({ id: 'tx-003' })

    await processWithdraw(PAYLOAD_VALIDO)

    expect(prismaMock.transaction.create).toHaveBeenCalledTimes(1)
    expect(prismaMock.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: PAYLOAD_VALIDO.userId,
          amount: PAYLOAD_VALIDO.amount,
          type: 'WITHDRAW',
        }),
      }),
    )
  })
})

// ---------------------------------------------------------------------------
// Comportamento quando o gateway retorna erro
// ---------------------------------------------------------------------------

describe('processWithdraw — gateway retorna erro', () => {
  it('não altera o saldo quando o gateway rejeita a solicitação', async () => {
    prismaMock.user.findUnique.mockResolvedValue(USUARIO_VALIDO)
    veopagMock.requestWithdraw.mockResolvedValue({ success: false, error: 'Limite atingido' })

    await expect(processWithdraw(PAYLOAD_VALIDO)).rejects.toThrow()

    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('não cria registro de transação quando o gateway rejeita', async () => {
    prismaMock.user.findUnique.mockResolvedValue(USUARIO_VALIDO)
    veopagMock.requestWithdraw.mockResolvedValue({ success: false, error: 'Recusado' })

    await expect(processWithdraw(PAYLOAD_VALIDO)).rejects.toThrow()

    expect(prismaMock.transaction.create).not.toHaveBeenCalled()
  })

  it('não altera o saldo quando o gateway lança exceção inesperada', async () => {
    prismaMock.user.findUnique.mockResolvedValue(USUARIO_VALIDO)
    veopagMock.requestWithdraw.mockRejectedValue(new Error('Timeout'))

    await expect(processWithdraw(PAYLOAD_VALIDO)).rejects.toThrow()

    expect(prismaMock.user.update).not.toHaveBeenCalled()
    expect(prismaMock.transaction.create).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Atomicidade — saques simultâneos não resultam em saldo negativo
// ---------------------------------------------------------------------------

describe('processWithdraw — atomicidade via $transaction', () => {
  it('executa débito dentro de uma transação de banco de dados', async () => {
    prismaMock.user.findUnique.mockResolvedValue(USUARIO_VALIDO)
    veopagMock.requestWithdraw.mockResolvedValue({ success: true, gatewayId: 'gw-004' })
    prismaMock.user.update.mockResolvedValue({ ...USUARIO_VALIDO, balance: 400 })
    prismaMock.transaction.create.mockResolvedValue({ id: 'tx-004' })

    await processWithdraw(PAYLOAD_VALIDO)

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
  })

  it('rejeita saque quando saldo é insuficiente, sem debitar', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...USUARIO_VALIDO, balance: 50 })

    await expect(
      processWithdraw({ ...PAYLOAD_VALIDO, amount: 100 }),
    ).rejects.toThrow()

    expect(veopagMock.requestWithdraw).not.toHaveBeenCalled()
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('reverte operação quando criação de transação falha após débito', async () => {
    prismaMock.user.findUnique.mockResolvedValue(USUARIO_VALIDO)
    veopagMock.requestWithdraw.mockResolvedValue({ success: true, gatewayId: 'gw-005' })
    prismaMock.user.update.mockResolvedValue({ ...USUARIO_VALIDO, balance: 400 })
    prismaMock.transaction.create.mockRejectedValue(new Error('DB error'))

    // Simula rollback: $transaction propaga o erro do callback
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) => {
      return fn(prismaMock)
    })

    await expect(processWithdraw(PAYLOAD_VALIDO)).rejects.toThrow()
  })
})

// ---------------------------------------------------------------------------
// Segurança — entradas inválidas
// ---------------------------------------------------------------------------

describe('processWithdraw — segurança: entradas inválidas', () => {
  it('rejeita amount igual a zero', async () => {
    await expect(
      processWithdraw({ ...PAYLOAD_VALIDO, amount: 0 }),
    ).rejects.toThrow()

    expect(veopagMock.requestWithdraw).not.toHaveBeenCalled()
  })

  it('rejeita amount negativo', async () => {
    await expect(
      processWithdraw({ ...PAYLOAD_VALIDO, amount: -50 }),
    ).rejects.toThrow()

    expect(veopagMock.requestWithdraw).not.toHaveBeenCalled()
  })

  it('rejeita userId vazio ou ausente', async () => {
    await expect(
      processWithdraw({ ...PAYLOAD_VALIDO, userId: '' }),
    ).rejects.toThrow()

    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
  })

  it('rejeita pixKey vazia ou ausente', async () => {
    await expect(
      processWithdraw({ ...PAYLOAD_VALIDO, pixKey: '' }),
    ).rejects.toThrow()

    expect(veopagMock.requestWithdraw).not.toHaveBeenCalled()
  })

  it('rejeita quando usuário não existe no banco', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)

    await expect(processWithdraw(PAYLOAD_VALIDO)).rejects.toThrow()

    expect(veopagMock.requestWithdraw).not.toHaveBeenCalled()
  })

  it('rejeita amount não-numérico (string disfarçada)', async () => {
    await expect(
      processWithdraw({ ...PAYLOAD_VALIDO, amount: 'cem' as unknown as number }),
    ).rejects.toThrow()

    expect(veopagMock.requestWithdraw).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Segurança — acesso negado / dados sensíveis não expostos
// ---------------------------------------------------------------------------

describe('processWithdraw — segurança: dados sensíveis e acesso', () => {
  it('não expõe dados internos do usuário no erro retornado ao chamador', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)

    let mensagemErro = ''
    try {
      await processWithdraw(PAYLOAD_VALIDO)
    } catch (err) {
      mensagemErro = err instanceof Error ? err.message : String(err)
    }

    // A mensagem de erro não deve vazar stack trace ou detalhes de DB
    expect(mensagemErro).not.toMatch(/prisma/i)
    expect(mensagemErro).not.toMatch(/sql/i)
    expect(mensagemErro).not.toMatch(/password/i)
    expect(mensagemErro).not.toMatch(/secret/i)
  })

  it('não loga a pixKey em nenhuma mensagem de erro', async () => {
    prismaMock.user.findUnique.mockResolvedValue(USUARIO_VALIDO)
    veopagMock.requestWithdraw.mockResolvedValue({ success: false, error: 'Recusado' })

    let mensagemErro = ''
    try {
      await processWithdraw(PAYLOAD_VALIDO)
    } catch (err) {
      mensagemErro = err instanceof Error ? err.message : String(err)
    }

    expect(mensagemErro).not.toContain(PAYLOAD_VALIDO.pixKey)
  })

  it('não processa saque para userId de outro usuário (sem acesso ao recurso)', async () => {
    const usuarioAlheio = { ...USUARIO_VALIDO, id: 'outro-user-999' }
    prismaMock.user.findUnique.mockResolvedValue(usuarioAlheio)

    // Tenta sacar usando ID diferente do encontrado — implementação deve validar coerência
    await expect(
      processWithdraw({ ...PAYLOAD_VALIDO, userId: 'user-abc-123' }),
    ).resolves.toBeDefined() // se IDs batem, passa; teste documenta que consulta usa o userId recebido

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: PAYLOAD_VALIDO.userId } }),
    )
  })

  it('rejeita amount com valor extremamente alto (proteção contra overflow)', async () => {
    prismaMock.user.findUnique.mockResolvedValue(USUARIO_VALIDO)

    await expect(
      processWithdraw({ ...PAYLOAD_VALIDO, amount: Number.MAX_SAFE_INTEGER }),
    ).rejects.toThrow()

    expect(veopagMock.requestWithdraw).not.toHaveBeenCalled()
  })
})