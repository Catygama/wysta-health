// Tiny helper for the post-signIn race in @convex-dev/auth: signIn() resolves
// when tokens are stored, but the Convex client used by useMutation may need
// one render cycle to pick up the new auth header. Calling a mutation that
// requires auth on the very next line can throw "Not authenticated".
//
// We retry with linear backoff for ~1.5s, only on "Not authenticated"
// errors, so genuine auth failures still surface fast.

export async function withAuthRetry<T>(
  fn: () => Promise<T>,
  attempts = 6
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      const message = (e as { message?: string })?.message ?? '';
      if (!/not authenticated/i.test(message)) throw e;
      await new Promise((resolve) => setTimeout(resolve, 100 + i * 100));
    }
  }
  throw lastError;
}
