export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmailValido(email: unknown): boolean {
  if (typeof email !== 'string') return false;
  const emailSanitizado = email.trim();
  if (emailSanitizado.length === 0) return false;
  return EMAIL_REGEX.test(emailSanitizado);
}