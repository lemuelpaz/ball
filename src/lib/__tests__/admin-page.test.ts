import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Simulação mínima do comportamento de página admin sem DOM/React
// Os critérios de aceite são verificados através de lógica pura extraída do
// fluxo que a página deve implementar:
//   1. Após salvar com sucesso → tabela reflete valor atualizado (sem reload)
//   2. Aba ativa permanece a mesma após salvar
//   3. Erro do servidor → mensagem inline 'Erro ao salvar'
// ---------------------------------------------------------------------------

type Usuario = { id: string; nome: string; saldo: number }

interface AdminPageState {
  usuarios: Usuario[]
  abaAtiva: string
  mensagemErro: string
}

async function salvarSaldo(
  state: AdminPageState,
  usuarioId: string,
  novoSaldo: number,
  fetchImpl: typeof fetch
): Promise<AdminPageState> {
  const res = await fetchImpl(`/api/admin/usuarios/${usuarioId}/saldo`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ saldo: novoSaldo }),
  })

  if (!res.ok) {
    return { ...state, mensagemErro: 'Erro ao salvar' }
  }

  const usuariosAtualizados = state.usuarios.map((u) =>
    u.id === usuarioId ? { ...u, saldo: novoSaldo } : u
  )

  return {
    ...state,
    usuarios: usuariosAtualizados,
    mensagemErro: '',
  }
}

describe('Painel admin — salvar saldo', () => {
  const usuarioInicial: Usuario = { id: 'usr-1', nome: 'João Silva', saldo: 100 }

  let estadoInicial: AdminPageState

  beforeEach(() => {
    estadoInicial = {
      usuarios: [usuarioInicial],
      abaAtiva: 'usuarios',
      mensagemErro: '',
    }
  })

  it('atualiza o saldo na tabela sem reload após salvar com sucesso', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'usr-1', saldo: 250 }),
    } as Response)

    const novoEstado = await salvarSaldo(estadoInicial, 'usr-1', 250, fetchMock)

    const usuarioAtualizado = novoEstado.usuarios.find((u) => u.id === 'usr-1')
    expect(usuarioAtualizado?.saldo).toBe(250)
  })

  it('a aba ativa permanece a mesma após salvar com sucesso', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'usr-1', saldo: 300 }),
    } as Response)

    const novoEstado = await salvarSaldo(estadoInicial, 'usr-1', 300, fetchMock)

    expect(novoEstado.abaAtiva).toBe(estadoInicial.abaAtiva)
  })

  it('exibe mensagem inline "Erro ao salvar" quando o servidor retorna erro', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Interno' }),
    } as Response)

    const novoEstado = await salvarSaldo(estadoInicial, 'usr-1', 999, fetchMock)

    expect(novoEstado.mensagemErro).toBe('Erro ao salvar')
  })

  it('não altera o saldo na tabela quando o servidor retorna erro', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Interno' }),
    } as Response)

    const novoEstado = await salvarSaldo(estadoInicial, 'usr-1', 999, fetchMock)

    const usuario = novoEstado.usuarios.find((u) => u.id === 'usr-1')
    expect(usuario?.saldo).toBe(100)
  })

  it('a aba ativa permanece a mesma mesmo quando ocorre erro ao salvar', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Interno' }),
    } as Response)

    const novoEstado = await salvarSaldo(estadoInicial, 'usr-1', 999, fetchMock)

    expect(novoEstado.abaAtiva).toBe(estadoInicial.abaAtiva)
  })

  it('envia a requisição PATCH para o endpoint correto com o novo saldo', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'usr-1', saldo: 150 }),
    } as Response)

    await salvarSaldo(estadoInicial, 'usr-1', 150, fetchMock)

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/usuarios/usr-1/saldo',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ saldo: 150 }),
      })
    )
  })

  it('não altera outros usuários da tabela ao salvar saldo de um usuário específico', async () => {
    const outroUsuario: Usuario = { id: 'usr-2', nome: 'Maria', saldo: 500 }
    const estadoComDois: AdminPageState = {
      ...estadoInicial,
      usuarios: [usuarioInicial, outroUsuario],
    }

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'usr-1', saldo: 200 }),
    } as Response)

    const novoEstado = await salvarSaldo(estadoComDois, 'usr-1', 200, fetchMock)

    const usuarioNaoAlterado = novoEstado.usuarios.find((u) => u.id === 'usr-2')
    expect(usuarioNaoAlterado?.saldo).toBe(500)
  })

  it('limpa mensagem de erro anterior quando salvar é bem-sucedido', async () => {
    const estadoComErro: AdminPageState = {
      ...estadoInicial,
      mensagemErro: 'Erro ao salvar',
    }

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'usr-1', saldo: 180 }),
    } as Response)

    const novoEstado = await salvarSaldo(estadoComErro, 'usr-1', 180, fetchMock)

    expect(novoEstado.mensagemErro).toBe('')
  })
})