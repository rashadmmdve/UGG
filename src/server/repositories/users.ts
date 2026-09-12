import "server-only";

import { nanoid } from "nanoid";

import { getDb } from "@/server/db/connection";
import { mapUser, nowIso, type UserRow } from "@/server/db/mappers";
import type { PublicUser, User, UserRole } from "@/lib/types";

/** Почта хранится и сравнивается в нижнем регистре. */
const normalizeEmail = (email: string): string => email.trim().toLowerCase();

/**
 * Пользователь без секретов.
 *
 * Поля перечислены явным списком, а не через удаление `passwordHash`:
 * если в модель когда-нибудь добавят токен сброса пароля, он не утечёт
 * в браузер сам собой.
 */
export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: user.role,
    createdAt: user.createdAt,
    emailVerifiedAt: user.emailVerifiedAt,
  };
}

export function getUserByEmail(email: string): User | null {
  const row = getDb()
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(normalizeEmail(email)) as UserRow | undefined;
  return row ? mapUser(row) : null;
}

export function getUserById(id: string): User | null {
  const row = getDb()
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(id) as UserRow | undefined;
  return row ? mapUser(row) : null;
}

export function getUsers(): User[] {
  const rows = getDb()
    .prepare("SELECT * FROM users ORDER BY created_at DESC")
    .all() as UserRow[];
  return rows.map(mapUser);
}

export function createUser(input: {
  email: string;
  passwordHash: string;
  name: string;
  phone: string;
  role?: UserRole;
  /** Сразу подтверждённый — для администраторов и режима без почты. */
  emailVerified?: boolean;
}): User {
  const now = nowIso();
  const user: User = {
    id: nanoid(12),
    email: normalizeEmail(input.email),
    passwordHash: input.passwordHash,
    name: input.name,
    phone: input.phone,
    role: input.role ?? "customer",
    createdAt: now,
    emailVerifiedAt: input.emailVerified ? now : null,
    verifyTokenHash: null,
    verifyTokenExpiresAt: null,
    resetTokenHash: null,
    resetTokenExpiresAt: null,
  };

  getDb()
    .prepare(
      `INSERT INTO users (id, email, password_hash, name, phone, role, created_at, email_verified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      user.id,
      user.email,
      user.passwordHash,
      user.name,
      user.phone,
      user.role,
      user.createdAt,
      user.emailVerifiedAt,
    );

  return user;
}

// ── Подтверждение почты ──

export function setVerificationToken(id: string, tokenHash: string, expiresAt: string): void {
  getDb()
    .prepare("UPDATE users SET verify_token_hash = ?, verify_token_expires_at = ? WHERE id = ?")
    .run(tokenHash, expiresAt, id);
}

export function getUserByVerificationToken(tokenHash: string): User | null {
  const row = getDb()
    .prepare("SELECT * FROM users WHERE verify_token_hash = ?")
    .get(tokenHash) as UserRow | undefined;
  return row ? mapUser(row) : null;
}

/** Почта подтверждена; ссылка сгорает, чтобы не сработать второй раз. */
export function markEmailVerified(id: string): void {
  getDb()
    .prepare(
      `UPDATE users
       SET email_verified_at = COALESCE(email_verified_at, ?),
           verify_token_hash = NULL, verify_token_expires_at = NULL
       WHERE id = ?`,
    )
    .run(nowIso(), id);
}

/** Правка профиля. Роль и хеш пароля через этот путь не меняются. */
export function updateUser(
  id: string,
  patch: { name?: string; phone?: string; email?: string },
): User | null {
  const existing = getUserById(id);
  if (!existing) return null;

  const next = {
    name: patch.name ?? existing.name,
    phone: patch.phone ?? existing.phone,
    email: patch.email ? normalizeEmail(patch.email) : existing.email,
  };

  getDb()
    .prepare("UPDATE users SET name = ?, phone = ?, email = ? WHERE id = ?")
    .run(next.name, next.phone, next.email, id);

  return { ...existing, ...next };
}

/**
 * Роль пользователя. Отдельно от updateUser: там правка своих данных
 * покупателем, а здесь — выдача прав сотруднику, и путать их не стоит.
 */
export function setUserRole(id: string, role: User["role"]): void {
  getDb().prepare("UPDATE users SET role = ? WHERE id = ?").run(role, id);
}

export function updatePasswordHash(id: string, passwordHash: string): void {
  getDb()
    .prepare("UPDATE users SET password_hash = ? WHERE id = ?")
    .run(passwordHash, id);
}

// ── Восстановление пароля ──

export function setResetToken(id: string, tokenHash: string, expiresAt: string): void {
  getDb()
    .prepare("UPDATE users SET reset_token_hash = ?, reset_token_expires_at = ? WHERE id = ?")
    .run(tokenHash, expiresAt, id);
}

export function getUserByResetToken(tokenHash: string): User | null {
  const row = getDb()
    .prepare("SELECT * FROM users WHERE reset_token_hash = ?")
    .get(tokenHash) as UserRow | undefined;
  return row ? mapUser(row) : null;
}

/**
 * Новый пароль по ссылке. Ссылка сгорает, а почта считается
 * подтверждённой: раз письмо дошло и по нему перешли — адрес рабочий.
 */
export function resetPassword(id: string, passwordHash: string): void {
  getDb()
    .prepare(
      `UPDATE users
       SET password_hash = ?,
           reset_token_hash = NULL, reset_token_expires_at = NULL,
           email_verified_at = COALESCE(email_verified_at, ?)
       WHERE id = ?`,
    )
    .run(passwordHash, nowIso(), id);
}
