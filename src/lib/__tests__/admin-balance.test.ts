import { describe, it, expect, vi, beforeEach } from 'vitest'

// Simulação da lógica de atualização de saldo do painel admin
// conforme a feature da issue #14: atualizar saldo sem reload de página

interface Usuario {
  id: string
  nome: string
  saldo: number
}

interface EstadoAdmin {
  usuarios: Usuario[]
  abaAtiva: string
  mensagemErro: string | null
}

async function salvarSaldo(
  estado: EstadoAdmin,
  usuarioId: string,
  novoSaldo: number,
  fetchImpl: typeof fetch
): Promise<EstadoAdmin> {
  const res = await fetchImpl(`/api/admin/usuarios/${usuarioId}/saldo`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ saldo: novoSaldo }),
  })

  if (!res.ok) {
    return {
      ...estado,
      mensagemErro: 'Erro ao salvar',
    }
  }

  const usuariosAtualizados = estado.usuarios.map((u) =>
    u.id === usuarioId ? { ...u, saldo: novoSaldo } : u
  )

  return {
    ...estado,
    usuarios: usuariosAtualizados,
    mensagemErro: null,
  }
}

describe('admin-balance: salvarSaldo', () => {
  const estadoInicial: EstadoAdmin = {
    usuarios: [
      { id: 'u1', nome: 'Alice', saldo: 100 },
      { id: 'u2', nome: 'Bruno', saldo: 200 },
    ],
    abaAtiva: 'usuarios',
    mensagemErro: null,
  }

  let fetchMock: ReturnType<typeof vi.fn>
  let reloadMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    reloadMock = vi.fn()

    // Garante que window.location.reload nunca seja chamado na implementação
    Object.defineProperty(globalThis, 'location', {
      value: { reload: reloadMock },
      writable: true,
    })
  })

  describe('fluxo principal (happy path)', () => {
    it('atualiza o saldo do usuário correto na lista local', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true } as Response)

      const novoEstado = await salvarSaldo(estadoInicial, 'u1', 350, fetchMock)

      const usuarioAtualizado = novoEstado.usuarios.find((u) => u.id === 'u1')
      expect(usuarioAtualizado?.saldo).toBe(350)
    })

    it('não altera os demais usuários da lista', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true } as Response)

      const novoEstado = await salvarSaldo(estadoInicial, 'u1', 350, fetchMock)

      const usuarioNaoAfetado = novoEstado.usuarios.find((u) => u.id === 'u2')
      expect(usuarioNaoAfetado?.saldo).toBe(200)
    })

    it('não altera a aba ativa após salvar com sucesso', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true } as Response)

      const novoEstado = await salvarSaldo(estadoInicial, 'u1', 350, fetchMock)

      expect(novoEstado.abaAtiva).toBe('usuarios')
    })

    it('limpa mensagem de erro após salvar com sucesso', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true } as Response)

      const estadoComErro: EstadoAdmin = { ...estadoInicial, mensagemErro: 'Erro ao salvar' }
      const novoEstado = await salvarSaldo(estadoComErro, 'u1', 350, fetchMock)

      expect(novoEstado.mensagemErro).toBeNull()
    })

    it('não chama window.location.reload após salvar com sucesso', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true } as Response)

      await salvarSaldo(estadoInicial, 'u1', 350, fetchMock)

      expect(reloadMock).not.toHaveBeenCalled()
    })

    it('envia requisição PATCH para o endpoint correto com o novo saldo', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true } as Response)

      await salvarSaldo(estadoInicial, 'u2', 500, fetchMock)

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/usuarios/u2/saldo',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ saldo: 500 }),
        })
      )
    })
  })

  describe('erro do servidor', () => {
    it('define mensagem de erro inline "Erro ao salvar" quando o servidor retorna falha', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false } as Response)

      const novoEstado = await salvarSaldo(estadoInicial, 'u1', 999, fetchMock)

      expect(novoEstado.mensagemErro).toBe('Erro ao salvar')
    })

    it('não altera a lista de usuários quando o servidor retorna falha', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false } as Response)

      const novoEstado = await salvarSaldo(estadoInicial, 'u1', 999, fetchMock)

      expect(novoEstado.usuarios).toEqual(estadoInicial.usuarios)
    })

    it('não altera a aba ativa quando o servidor retorna falha', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false } as Response)

      const novoEstado = await salvarSaldo(estadoInicial, 'u1', 999, fetchMock)

      expect(novoEstado.abaAtiva).toBe('usuarios')
    })

    it('não chama window.location.reload quando o servidor retorna falha', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false } as Response)

      await salvarSaldo(estadoInicial, 'u1', 999, fetchMock)

      expect(reloadMock).not.toHaveBeenCalled()
    })
  })

  describe('casos de borda', () => {
    it('aceita saldo zero como valor válido', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true } as Response)

      const novoEstado = await salvarSaldo(estadoInicial, 'u1', 0, fetchMock)

      const usuario = novoEstado.usuarios.find((u) => u.id === 'u1')
      expect(usuario?.saldo).toBe(0)
    })

    it('não altera nenhum usuário quando o id informado não existe na lista', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true } as Response)

      const novoEstado = await salvarSaldo(estadoInicial, 'id-inexistente', 300, fetchMock)

      expect(novoEstado.usuarios).toEqual(estadoInicial.usuarios)
    })

    it('mantém os dados dos demais campos do estado intactos após salvar', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true } as Response)

      const estadoExtra = { ...estadoInicial, abaAtiva: 'relatorios' }
      const novoEstado = await salvarSaldo(estadoExtra, 'u2', 800, fetchMock)

      expect(novoEstado.abaAtiva).toBe('relatorios')
    })
  })
})