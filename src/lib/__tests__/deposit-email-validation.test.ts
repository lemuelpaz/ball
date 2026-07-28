import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Helpers para simular o ambiente do Next.js Route Handler nos testes
// ---------------------------------------------------------------------------

function criarRequisicao(body: unknown): Request {
  return new Request('http://localhost/api/deposit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ---------------------------------------------------------------------------
// Importações que dependem dos módulos a serem criados
// ---------------------------------------------------------------------------

// A função utilitária de validação de e-mail
import { validarEmail } from '@/lib/validar-email'

// O handler de depósito (Next.js Route Handler)
import { POST } from '@/app/api/deposit/route'

// ---------------------------------------------------------------------------
// Mocks de dependências externas
// ---------------------------------------------------------------------------

vi.mock('@/lib/prisma', () => ({
  default: {
    deposit: {
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(),
  },
}))

// ---------------------------------------------------------------------------
// Testes da função utilitária validarEmail
// ---------------------------------------------------------------------------

describe('validarEmail', () => {
  describe('casos inválidos', () => {
    it('deve retornar false para string sem arroba', () => {
      expect(validarEmail('abc')).toBe(false)
    })

    it('deve retornar false para string vazia', () => {
      expect(validarEmail('')).toBe(false)
    })

    it('deve retornar false para e-mail sem domínio', () => {
      expect(validarEmail('user@')).toBe(false)
    })

    it('deve retornar false para e-mail sem extensão de domínio', () => {
      expect(validarEmail('user@domain')).toBe(false)
    })

    it('deve retornar false para e-mail com espaço', () => {
      expect(validarEmail('user @domain.com')).toBe(false)
    })

    it('deve retornar false para e-mail sem parte local', () => {
      expect(validarEmail('@domain.com')).toBe(false)
    })

    it('deve retornar false para apenas arroba e ponto', () => {
      expect(validarEmail('@.')).toBe(false)
    })
  })

  describe('casos válidos', () => {
    it('deve retornar true para e-mail simples válido', () => {
      expect(validarEmail('user@domain.com')).toBe(true)
    })

    it('deve retornar true para e-mail com subdomínio', () => {
      expect(validarEmail('user@mail.domain.com.br')).toBe(true)
    })

    it('deve retornar true para e-mail com ponto na parte local', () => {
      expect(validarEmail('nome.sobrenome@domain.com')).toBe(true)
    })

    it('deve retornar true para e-mail com sinal de mais na parte local', () => {
      expect(validarEmail('user+tag@domain.org')).toBe(true)
    })
  })
})

// ---------------------------------------------------------------------------
// Testes do handler POST /api/deposit
// ---------------------------------------------------------------------------

describe('POST /api/deposit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('validação de e-mail', () => {
    it('deve retornar 400 quando o e-mail for inválido', async () => {
      const req = criarRequisicao({ email: 'abc', valor: 100 })
      const res = await POST(req)

      expect(res.status).toBe(400)

      const corpo = await res.json()
      expect(corpo).toHaveProperty('error')
      expect(typeof corpo.error).toBe('string')
      expect(corpo.error.length).toBeGreaterThan(0)
    })

    it('deve retornar 400 com mensagem descritiva quando e-mail estiver ausente', async () => {
      const req = criarRequisicao({ valor: 100 })
      const res = await POST(req)

      expect(res.status).toBe(400)

      const corpo = await res.json()
      expect(corpo.error).toMatch(/e-mail/i)
    })

    it('deve retornar 400 com mensagem descritiva quando e-mail for string vazia', async () => {
      const req = criarRequisicao({ email: '', valor: 100 })
      const res = await POST(req)

      expect(res.status).toBe(400)

      const corpo = await res.json()
      expect(corpo.error).toMatch(/e-mail/i)
    })
  })

  describe('segurança — entradas inválidas', () => {
    it('deve retornar 400 para payload com e-mail contendo script malicioso', async () => {
      const req = criarRequisicao({ email: '<script>alert(1)</script>@evil.com', valor: 100 })
      const res = await POST(req)

      expect(res.status).toBe(400)
    })

    it('deve retornar 400 para e-mail com injeção de cabeçalho (newline)', async () => {
      const req = criarRequisicao({ email: 'user@domain.com\nBcc: outro@evil.com', valor: 100 })
      const res = await POST(req)

      expect(res.status).toBe(400)
    })

    it('deve retornar 400 quando o valor do depósito for negativo', async () => {
      const req = criarRequisicao({ email: 'user@domain.com', valor: -50 })
      const res = await POST(req)

      expect(res.status).toBe(400)
    })

    it('deve retornar 400 quando o valor do depósito for zero', async () => {
      const req = criarRequisicao({ email: 'user@domain.com', valor: 0 })
      const res = await POST(req)

      expect(res.status).toBe(400)
    })
  })

  describe('segurança — dados sensíveis não expostos', () => {
    it('não deve expor stack trace na resposta de erro', async () => {
      const req = criarRequisicao({ email: 'invalido', valor: 100 })
      const res = await POST(req)
      const corpo = await res.json()

      expect(corpo).not.toHaveProperty('stack')
      expect(corpo).not.toHaveProperty('trace')
    })

    it('não deve expor detalhes internos do banco na resposta de erro', async () => {
      const req = criarRequisicao({ email: 'invalido', valor: 100 })
      const res = await POST(req)
      const corpo = await res.json()

      const respostaSerializada = JSON.stringify(corpo).toLowerCase()
      expect(respostaSerializada).not.toContain('prisma')
      expect(respostaSerializada).not.toContain('sql')
      expect(respostaSerializada).not.toContain('database')
    })

    it('não deve incluir o valor do e-mail inválido na mensagem de erro', async () => {
      const emailMalicioso = 'payload_secreto_xss@evil.com'
      const req = criarRequisicao({ email: emailMalicioso, valor: 100 })
      const res = await POST(req)
      const corpo = await res.json()

      // A mensagem de erro não deve ecoar o valor enviado pelo usuário
      expect(JSON.stringify(corpo)).not.toContain('payload_secreto_xss')
    })
  })

  describe('segurança — acesso negado', () => {
    it('deve retornar 401 quando o token de autenticação estiver ausente', async () => {
      const req = new Request('http://localhost/api/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // sem Authorization header
        body: JSON.stringify({ email: 'user@domain.com', valor: 100 }),
      })
      const res = await POST(req)

      expect([400, 401, 403]).toContain(res.status)
    })
  })
})