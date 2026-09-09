import "server-only";

/**
 * Ограничение попыток входа — в памяти процесса.
 *
 * Этого достаточно для одного инстанса на сервере. При запуске нескольких
 * инстансов счётчик нужно вынести в общее хранилище: тогда меняется только
 * реализация этого файла, вызывающий код остаётся прежним.
 */

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

type Entry = { count: number; resetAt: number };

const attempts = new Map<string, Entry>();

export type RateLimitResult =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterMinutes: number };

export function checkRateLimit(key: string): RateLimitResult {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || entry.resetAt < now) {
    return { allowed: true, remaining: MAX_ATTEMPTS - 1 };
  }

  if (entry.count >= MAX_ATTEMPTS) {
    return {
      allowed: false,
      retryAfterMinutes: Math.ceil((entry.resetAt - now) / 60000),
    };
  }

  return { allowed: true, remaining: MAX_ATTEMPTS - entry.count - 1 };
}

export function registerFailedAttempt(key: string): void {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }

  entry.count += 1;
}

export function resetAttempts(key: string): void {
  attempts.delete(key);
}

/** Периодическая чистка, чтобы карта не росла бесконечно. */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of attempts) {
    if (entry.resetAt < now) attempts.delete(key);
  }
}, WINDOW_MS).unref?.();
