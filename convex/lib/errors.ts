// Errors meant for the person using the app. Convex hides the message of a
// plain Error in production ("Server Error"); a ConvexError's data reaches the
// client, so user-facing messages (in European Portuguese) go through here.
import { ConvexError } from 'convex/values';

export function userError(message: string): ConvexError<string> {
  return new ConvexError(message);
}

export const NOT_AUTHENTICATED = 'A tua sessão terminou. Entra novamente.';
export const NOT_ALLOWED = 'Não tens acesso a esta conversa.';
export const ADMIN_ONLY = 'Só a administração pode fazer isto.';
