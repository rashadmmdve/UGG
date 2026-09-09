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
}): User {
  const user: User = {
    id: nanoid(12),
    email: normalizeEmail(input.email),
    passwordHash: input.passwordHash,
    name: input.name,
    phone: input.phone,
    role: input.role ?? "customer",
    createdAt: nowIso(),
  };

  getDb()
    .prepare(
      `INSERT INTO users (id, email, password_hash, name, phone, role, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      user.id,
      user.email,
      user.passwordHash,
      user.name,
      user.phone,
      user.role,
      user.createdAt,
    );

  return user;
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

export function updatePasswordHash(id: string, passwordHash: string): void {
  getDb()
    .prepare("UPDATE users SET password_hash = ? WHERE id = ?")
    .run(passwordHash, id);
}
