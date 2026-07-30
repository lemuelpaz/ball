export const PIX_DURACAO_SEGUNDOS = 1800;

export function calcularTempoRestante(criadoEm: number): number {
  if (!Number.isFinite(criadoEm) || criadoEm <= 0) {
    return 0;
  }

  const agora = Math.floor(Date.now() / 1000);
  const expiracaoEm = criadoEm + PIX_DURACAO_SEGUNDOS;
  const restante = expiracaoEm - agora;

  return restante > 0 ? restante : 0;
}

export function pixExpirado(criadoEm: number): boolean {
  if (!Number.isFinite(criadoEm) || criadoEm <= 0) {
    return true;
  }

  return calcularTempoRestante(criadoEm) === 0;
}