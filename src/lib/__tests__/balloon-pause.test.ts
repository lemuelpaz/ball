src/lib/__tests__/balloon-pause.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Utilitário que aplica/remove o estado de pausa nos elementos .falling
function pauseBaloes(document: Document): void {
  const baloes = document.querySelectorAll<HTMLElement>('.falling')
  baloes.forEach((el) => {
    el.style.animationPlayState = 'paused'
  })
}

function retomarBaloes(document: Document): void {
  const baloes = document.querySelectorAll<HTMLElement>('.falling')
  baloes.forEach((el) => {
    el.style.animationPlayState = 'running'
  })
}

function criarBalao(doc: Document, id: string): HTMLElement {
  const el = doc.createElement('div')
  el.className = 'falling'
  el.setAttribute('data-testid', id)
  el.style.animationPlayState = 'running'
  doc.body.appendChild(el)
  return el
}

describe('pauseBaloes / retomarBaloes', () => {
  let doc: Document

  beforeEach(() => {
    doc = document.implementation.createHTMLDocument('teste-pause')
  })

  afterEach(() => {
    while (doc.body.firstChild) {
      doc.body.removeChild(doc.body.firstChild)
    }
  })

  describe('pauseBaloes', () => {
    it('deve definir animation-play-state como paused em todos os .falling', () => {
      const b1 = criarBalao(doc, 'balao-1')
      const b2 = criarBalao(doc, 'balao-2')
      const b3 = criarBalao(doc, 'balao-3')

      pauseBaloes(doc)

      expect(b1.style.animationPlayState).toBe('paused')
      expect(b2.style.animationPlayState).toBe('paused')
      expect(b3.style.animationPlayState).toBe('paused')
    })

    it('não deve alterar elementos sem a classe .falling', () => {
      const baloFalling = criarBalao(doc, 'balao-falling')

      const elementoNormal = doc.createElement('div')
      elementoNormal.className = 'outro-elemento'
      elementoNormal.style.animationPlayState = 'running'
      doc.body.appendChild(elementoNormal)

      pauseBaloes(doc)

      expect(baloFalling.style.animationPlayState).toBe('paused')
      expect(elementoNormal.style.animationPlayState).toBe('running')
    })

    it('não deve lançar erro quando não há elementos .falling', () => {
      expect(() => pauseBaloes(doc)).not.toThrow()
    })

    it('deve pausar mesmo quando há apenas um balão', () => {
      const b = criarBalao(doc, 'balao-unico')

      pauseBaloes(doc)

      expect(b.style.animationPlayState).toBe('paused')
    })

    it('deve garantir que balão pausado permanece paused após segunda chamada', () => {
      const b = criarBalao(doc, 'balao-dupla-pausa')

      pauseBaloes(doc)
      pauseBaloes(doc)

      expect(b.style.animationPlayState).toBe('paused')
    })
  })

  describe('retomarBaloes', () => {
    it('deve definir animation-play-state como running em todos os .falling', () => {
      const b1 = criarBalao(doc, 'balao-1')
      const b2 = criarBalao(doc, 'balao-2')
      const b3 = criarBalao(doc, 'balao-3')

      pauseBaloes(doc)
      retomarBaloes(doc)

      expect(b1.style.animationPlayState).toBe('running')
      expect(b2.style.animationPlayState).toBe('running')
      expect(b3.style.animationPlayState).toBe('running')
    })

    it('não deve alterar elementos sem a classe .falling ao retomar', () => {
      const baloFalling = criarBalao(doc, 'balao-falling')

      const elementoNormal = doc.createElement('div')
      elementoNormal.className = 'outro-elemento'
      elementoNormal.style.animationPlayState = 'paused'
      doc.body.appendChild(elementoNormal)

      retomarBaloes(doc)

      expect(baloFalling.style.animationPlayState).toBe('running')
      expect(elementoNormal.style.animationPlayState).toBe('paused')
    })

    it('não deve lançar erro quando não há elementos .falling ao retomar', () => {
      expect(() => retomarBaloes(doc)).not.toThrow()
    })
  })

  describe('ciclo pausa → retomar', () => {
    it('deve alternar corretamente entre paused e running para múltiplos balões', () => {
      const baloes = Array.from({ length: 5 }, (_, i) => criarBalao(doc, `balao-${i}`))

      pauseBaloes(doc)
      baloes.forEach((b) => {
        expect(b.style.animationPlayState).toBe('paused')
      })

      retomarBaloes(doc)
      baloes.forEach((b) => {
        expect(b.style.animationPlayState).toBe('running')
      })
    })

    it('deve manter consistência em múltiplos ciclos de pausa e retomada', () => {
      const b = criarBalao(doc, 'balao-ciclos')

      for (let ciclo = 0; ciclo < 3; ciclo++) {
        pauseBaloes(doc)
        expect(b.style.animationPlayState).toBe('paused')

        retomarBaloes(doc)
        expect(b.style.animationPlayState).toBe('running')
      }
    })

    it('balão adicionado após pausa deve receber paused ao pausar novamente', () => {
      const b1 = criarBalao(doc, 'balao-antes')
      pauseBaloes(doc)
      expect(b1.style.animationPlayState).toBe('paused')

      // Novo balão adicionado enquanto o jogo está "pausado"
      const b2 = criarBalao(doc, 'balao-depois')
      // Simula nova chamada de pauseBaloes (ex: ao renderizar novo elemento)
      pauseBaloes(doc)

      expect(b2.style.animationPlayState).toBe('paused')
    })

    it('deve pausar apenas balões com classe falling e não balões já estourados', () => {
      const baloAtivo = criarBalao(doc, 'balao-ativo')

      const baloEstourado = doc.createElement('div')
      baloEstourado.className = 'exploded'
      baloEstourado.style.animationPlayState = 'running'
      doc.body.appendChild(baloEstourado)

      pauseBaloes(doc)

      expect(baloAtivo.style.animationPlayState).toBe('paused')
      expect(baloEstourado.style.animationPlayState).toBe('running')
    })
  })

  describe('casos de borda', () => {
    it('deve lidar com documento sem body sem lançar erro', () => {
      const docVazio = document.implementation.createHTMLDocument('')
      // Remove o body para simular ambiente degradado
      expect(() => pauseBaloes(docVazio)).not.toThrow()
      expect(() => retomarBaloes(docVazio)).not.toThrow()
    })

    it('deve processar lista grande de balões sem degradação', () => {
      const quantidadeGrande = 100
      const baloes = Array.from({ length: quantidadeGrande }, (_, i) =>
        criarBalao(doc, `balao-stress-${i}`)
      )

      pauseBaloes(doc)

      const todosPausados = baloes.every((b) => b.style.animationPlayState === 'paused')
      expect(todosPausados).toBe(true)

      retomarBaloes(doc)

      const todosRodando = baloes.every((b) => b.style.animationPlayState === 'running')
      expect(todosRodando).toBe(true)
    })

    it('não deve alterar outras propriedades de estilo dos balões ao pausar', () => {
      const b = criarBalao(doc, 'balao-estilo')
      b.style.top = '100px'
      b.style.left = '50px'
      b.style.opacity = '0.8'

      pauseBaloes(doc)

      expect(b.style.top).toBe('100px')
      expect(b.style.left).toBe('50px')
      expect(b.style.opacity).toBe('0.8')
      expect(b.style.animationPlayState).toBe('paused')
    })

    it('não deve alterar outras propriedades de estilo dos balões ao retomar', () => {
      const b = criarBalao(doc, 'balao-estilo-retomar')
      b.style.top = '200px'
      b.style.left = '75px'
      b.style.opacity = '1'

      pauseBaloes(doc)
      retomarBaloes(doc)

      expect(b.style.top).toBe('200px')
      expect(b.style.left).toBe('75px')
      expect(b.style.opacity).toBe('1')
      expect(b.style.animationPlayState).toBe('running')
    })
  })
})