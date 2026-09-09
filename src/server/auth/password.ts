import "server-only";

import { hash, verify } from "@node-rs/argon2";

/**
 * Параметры argon2id — рекомендованный OWASP профиль.
 * Соль генерируется библиотекой и хранится внутри самой хеш-строки.
 */
const OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
} as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  try {
    return await verify(passwordHash, password, OPTIONS);
  } catch {
    // Повреждённый или чужой формат хеша — это неуспешный вход, не падение.
    return false;
  }
}
