import "server-only";

import crypto from "node:crypto";

import { SITE_URL } from "@/lib/constants";
import { isMailEnabled, sendMail } from "@/server/mail/mailer";
import { verificationMail } from "@/server/mail/templates";
import {
  getUserByVerificationToken,
  markEmailVerified,
  setVerificationToken,
} from "@/server/repositories/users";
import type { User } from "@/lib/types";

/**
 * Подтверждение почты по ссылке из письма.
 *
 * В базе хранится не сам код, а его хеш: утечка базы не даст войти в
 * чужой аккаунт по ещё живой ссылке. Код случайный, 256 бит — перебрать
 * его нельзя, а срок жизни сутки ограничивает окно и для украденного
 * письма.
 */
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

const hash = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export function verificationUrl(token: string): string {
  return `${SITE_URL}/account/confirm?token=${token}`;
}

/**
 * Выдать новую ссылку и отправить письмо. Предыдущая ссылка при этом
 * перестаёт действовать — живой всегда только последняя.
 */
export async function issueVerification(user: User): Promise<void> {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
  setVerificationToken(user.id, hash(token), expiresAt);

  await sendMail(verificationMail({ to: user.email, name: user.name, url: verificationUrl(token) }));
}

export type VerifyResult =
  | { ok: true; user: User }
  | { ok: false; reason: "invalid" | "expired" };

/** Проверить код из ссылки и активировать аккаунт. Код одноразовый. */
export function verifyEmailToken(token: string): VerifyResult {
  if (!token || token.length > 128) return { ok: false, reason: "invalid" };

  const user = getUserByVerificationToken(hash(token));
  if (!user) return { ok: false, reason: "invalid" };

  if (!user.verifyTokenExpiresAt || new Date(user.verifyTokenExpiresAt).getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }

  markEmailVerified(user.id);
  return { ok: true, user: { ...user, emailVerifiedAt: new Date().toISOString() } };
}

/**
 * Нужно ли подтверждать почту вообще. Без настроенного SMTP письмо не
 * уйдёт, и требовать подтверждения значило бы запереть регистрацию.
 */
export function isVerificationRequired(): boolean {
  return isMailEnabled();
}
