import "server-only";

import crypto from "node:crypto";

import { SITE_URL } from "@/lib/constants";
import { sendMail } from "@/server/mail/mailer";
import { passwordResetMail } from "@/server/mail/templates";
import {
  getUserByResetToken,
  setResetToken,
} from "@/server/repositories/users";
import type { User } from "@/lib/types";

/**
 * Восстановление пароля по ссылке из письма.
 *
 * Устроено как подтверждение почты: в базе хеш случайного кода, сам код
 * только в письме. Срок короче — час: ссылка даёт сменить пароль, и
 * окно для украденного письма должно быть узким.
 */
const TOKEN_TTL_MS = 60 * 60 * 1000;

const hash = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export function resetUrl(token: string): string {
  return `${SITE_URL}/account/reset?token=${token}`;
}

/** Выдать ссылку и отправить письмо. Предыдущая ссылка перестаёт действовать. */
export async function issuePasswordReset(user: User): Promise<void> {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
  setResetToken(user.id, hash(token), expiresAt);

  await sendMail(passwordResetMail({ to: user.email, name: user.name, url: resetUrl(token) }));
}

export type ResetLookup =
  | { ok: true; user: User }
  | { ok: false; reason: "invalid" | "expired" };

/** Найти аккаунт по коду из ссылки, не тратя код: страница смены пароля показывает форму. */
export function lookupResetToken(token: string): ResetLookup {
  if (!token || token.length > 128) return { ok: false, reason: "invalid" };

  const user = getUserByResetToken(hash(token));
  if (!user) return { ok: false, reason: "invalid" };

  if (!user.resetTokenExpiresAt || new Date(user.resetTokenExpiresAt).getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true, user };
}
