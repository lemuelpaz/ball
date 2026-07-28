export function formatarTempo(segundos: number): string {
  const totalSegundos = Math.max(0, Math.floor(segundos));
  const minutos = Math.floor(totalSegundos / 60);
  const segsRestantes = totalSegundos % 60;

  const minutosFormatado = String(minutos).padStart(2, "0");
  const segundosFormatado = String(segsRestantes).padStart(2, "0");

  return `${minutosFormatado}:${segundosFormatado}`;
}