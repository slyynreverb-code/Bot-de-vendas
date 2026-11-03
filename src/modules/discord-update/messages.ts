import { UpdateError } from '../server-setup/storage.js';

export function safeErrorCode(error: unknown): string | number | null {
  if (error instanceof UpdateError) return error.code;
  if (error && typeof error === 'object' && 'code' in error) {
    const code = String(error.code);
    if (/^\d{3,6}$/.test(code)) return Number(code);
  }
  return null;
}

export function safeErrorMessage(error: unknown): string {
  if (error instanceof UpdateError) return error.publicMessage;
  const code = safeErrorCode(error);
  if (code !== null)
    return `O Discord recusou a operação (código ${code}). Confira as permissões do bot e gere uma nova prévia.`;
  return 'Não foi possível concluir a atualização. Gere uma nova prévia e tente novamente.';
}
