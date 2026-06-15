# Resolver Issue GitHub Utilizando TDD Estrito
# Input único: $ARGUMENTS

---

# ETAPA 0 — Validação e Preparação

## Validar entrada

Se `$ARGUMENTS` não foi informado, exiba:
  ❌ Número de issue obrigatório. Uso: /tdd-issue 123
  Interrompa imediatamente.

## Validar repositório

Execute:
  git rev-parse --show-toplevel

Se falhar:
  ❌ Não está dentro de um repositório Git. Interrompa.

## Detectar contexto automaticamente (NÃO peça ao usuário)

Detectar owner e repo:
  git remote get-url origin
  → Extrair owner e repo da URL (https ou ssh)

Detectar linguagem e ferramentas (verificar na ordem):
  - Existe package.json?     → Node.js
    - Contém "jest"?         → runner: jest     | comando: npx jest
    - Contém "vitest"?       → runner: vitest   | comando: npx vitest
    - Contém "mocha"?        → runner: mocha    | comando: npx mocha
    - fallback               → runner: genérico | comando: npm test
    - Contém "eslint"?       → lint: npx eslint .
    - Contém "prettier"?     → format: npx prettier --write .
  - Existe pyproject.toml ou requirements.txt? → Python
    - Contém "pytest"?       → runner: pytest   | comando: python -m pytest
    - Contém "unittest"?     → runner: unittest | comando: python -m unittest
    - Contém "ruff"?         → lint: ruff check .
    - Contém "black"?        → format: black .
  - Existe go.mod?           → Go
    → runner: go test        | comando: go test ./...
    → lint: go vet ./...
  - Nenhum detectado:
    ❌ Não foi possível detectar a linguagem. Interrompa e informe o usuário.

Registre internamente (não exiba ao usuário):
  - OWNER, REPO, RUNNER, CMD_TEST, CMD_LINT, CMD_FORMAT

## Criar branch

  git checkout -b fix/issue-$ARGUMENTS

---

# ETAPA 1 — Leitura da Issue

Tente:
  gh issue view $ARGUMENTS --comments --repo $OWNER/$REPO

Se o comando `gh` falhar (não instalado ou sem autenticação):
  → Informe o usuário para acessar manualmente:
    https://github.com/$OWNER/$REPO/issues/$ARGUMENTS
  → Aguarde o usuário colar o conteúdo da issue.

Analise:
  - Descrição e contexto
  - Critérios de aceite explícitos
  - Comentários e discussões
  - Issues ou PRs relacionadas

---

# ETAPA 2 — Compreensão e Pesquisa

Documente (internamente, sem código):

  PROBLEMA ATUAL:
  [Descrição objetiva do comportamento quebrado]

  COMPORTAMENTO ESPERADO:
  [Entradas → saídas esperadas]

  CASOS DE BORDA IDENTIFICADOS:
  - [ ] Caso 1
  - [ ] Caso 2

  RESTRIÇÕES:
  - [ ] Restrição 1

Se houver ambiguidade não resolvível:
  ⚠️ Ambiguidade: [descrição]
  Pergunte ao usuário antes de prosseguir. Não assuma comportamento.

Pesquise na base de código:
  - Implementações similares existentes
  - Serviços e componentes reutilizáveis
  - Testes relacionados já escritos

Responda:
  - O problema já foi parcialmente resolvido?
  - Há risco de duplicação?

---

# ETAPA 3 — Plano de Implementação

Produza:

  ARQUIVOS IMPACTADOS:
  - src/arquivo1   → O quê e por quê
  - src/arquivo2   → O quê e por quê

  ARQUIVOS DE TESTE:
  - test/arquivo1  → Novo ou modificado?
  - test/arquivo2  → Novo ou modificado?

  ESTRATÉGIA:
  1. O que será alterado
  2. Por que (vinculado aos requisitos)
  3. Como cada critério de aceite será coberto

Não escreva código nesta etapa.

---

# ETAPA 4 — TDD RED (Testes Falhando)

Escreva testes cobrindo:
  ✅ Fluxo principal (happy path)
  ✅ Casos de erro (exceções, validações)
  ✅ Casos de borda (limites, nulos, vazios)
  ✅ Regressões conhecidas (se houver)

Regras de mock:
  ✅ Permitido: APIs externas, banco de dados, sistema de arquivos, serviços terceiros
  ❌ Proibido: a funcionalidade sendo testada, lógica de negócio central

Execute os testes:
  $CMD_TEST

Resultado esperado: TODOS os testes falham (funcionalidade não existe ainda).
Documente: total de testes criados e motivo das falhas.

Se algum teste passar inesperadamente:
  ⚠️ Teste passou sem implementação. Revise — pode estar testando algo errado ou já implementado.

---

# ETAPA 5 — Commit RED

Commit apenas dos testes:
  git add <arquivos de teste apenas>
  git commit -m "test(issue-$ARGUMENTS): add failing tests"

Verifique:
  git diff HEAD~1 --name-only
  → Deve listar APENAS arquivos de teste. Se listar código de produção, desfaça o commit.

---

# ETAPA 6 — TDD GREEN (Implementação Mínima)

Escreva apenas o código necessário para os testes passarem.

Definição de "mínimo":
  - Sem funcionalidades extras
  - Sem otimizações prematuras
  - Sem tratamento de casos não testados
  - Sem refatoração ainda

Ciclo (máximo 5 iterações):
  Iteração 1: Implementar → $CMD_TEST → Passou? Avance. Falhou? Continue.
  Iteração 2: Ajustar    → $CMD_TEST → Passou? Avance. Falhou? Continue.
  Iteração 3: ...
  Iteração 4: ...
  Iteração 5: ...

Se ultrapassar 5 iterações sem todos os testes passarem:
  ⚠️ Bloqueio encontrado:
  - O que não funciona: [descrição]
  - Causa provável: [análise]
  - Opções disponíveis: [A, B, C]
  Interrompa. Revise o plano com o usuário.

---

# ETAPA 7 — Validação Completa

Execute nesta ordem. Se qualquer etapa falhar, volte à Etapa 6.

  1. $CMD_TEST          → testes da feature
  2. $CMD_TEST          → suite completa (sem filtro)
  3. $CMD_LINT          → lint
  4. $CMD_FORMAT        → formatação
  5. <comando de build> → se existir (npm run build / go build / etc.)

---

# ETAPA 8 — Rastreabilidade Requisito → Teste → Código

Para cada requisito da issue:

  | Requisito | Teste | Arquivo | Status |
  |-----------|-------|---------|--------|
  | R1: ...   | nome_do_teste | src/arquivo.ext | ✅ |
  | R2: ...   | nome_do_teste | src/arquivo.ext | ✅ |

Cada requisito deve ter ≥1 teste e ≥1 arquivo de implementação associado.

---

# ETAPA 9 — Refatoração Segura

Somente se todos os testes passarem.

Permitido:
  ✅ Melhorar legibilidade
  ✅ Remover duplicação
  ✅ Melhorar nomes de variáveis e funções
  ✅ Extrair funções auxiliares

Proibido:
  ❌ Alterar comportamento externo
  ❌ Adicionar funcionalidades não testadas

Após cada mudança de refatoração, execute:
  $CMD_TEST

---

# ETAPA 10 — Commit Final

  git add <arquivos de implementação apenas>
  git commit -m "feat(issue-$ARGUMENTS): implement solution"

Verifique o histórico:
  git log --oneline -2
  Esperado:
    feat(issue-$ARGUMENTS): implement solution
    test(issue-$ARGUMENTS): add failing tests

---

# ETAPA 11 — Pull Request

Tente:
  gh pr create \
    --repo $OWNER/$REPO \
    --title "fix(issue-$ARGUMENTS): <descrição breve>" \
    --body "## Resumo
  Solução para #$ARGUMENTS implementada com TDD.

  ## Testes Adicionados
  - <teste 1>
  - <teste 2>

  ## Validação
  - [x] Todos os testes passam
  - [x] Lint passou
  - [x] Build passou

  Closes #$ARGUMENTS"

Se `gh` falhar:
  → Acesse: https://github.com/$OWNER/$REPO/compare/fix/issue-$ARGUMENTS
  → Crie a PR manualmente com o conteúdo acima.

---

# CHECKLIST DE ENCERRAMENTO

CRÍTICO (bloqueadores — não feche sem estes):
  [ ] Issue lida e compreendida completamente
  [ ] Testes escritos ANTES da implementação
  [ ] Fase RED validada (todos os testes falhando antes do código)
  [ ] Todos os testes passando na suite completa
  [ ] Lint e formatação sem erros
  [ ] Build bem-sucedida (se aplicável)
  [ ] PR criada com Closes #$ARGUMENTS

IMPORTANTE:
  [ ] Plano documentado antes de escrever código
  [ ] Rastreabilidade requisito → teste → código criada
  [ ] Commits seguem convenção: test → feat
  [ ] Nenhuma alteração fora do escopo da issue
  [ ] Descrição da PR clara e completa
