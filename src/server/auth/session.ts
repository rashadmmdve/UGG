import "server-only";

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

import { getUserById, toPublicUser } from "@/server/repositories/users";
import type { PublicUser, UserRole } from "@/lib/types";

/**
 * Сессии на подписанном JWT в httpOnly-cookie.
 *
 * Витрина и админка используют РАЗНЫЕ cookie: даже если клиентская сессия
 * утечёт, доступа к /admin она не даст.
 */

const CUSTOMER_COOKIE = "ugg_session";
const ADMIN_COOKIE = "ugg_admin";

// «Запомнить меня» — кука на 30 дней, переживает закрытие браузера.
// Без галочки — обычная сессионная кука, а сам токен живёт сутки: если
// браузер куку всё же не стёр (бывает при восстановлении вкладок),
// доступ закроется сам.
const REMEMBER_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24;

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET;

  if (!value || value.length < 32) {
    throw new Error(
      "AUTH_SECRET не задан или короче 32 символов. Добавьте его в .env.local.",
    );
  }

  return new TextEncoder().encode(value);
}

function cookieName(role: UserRole): string {
  return role === "admin" ? ADMIN_COOKIE : CUSTOMER_COOKIE;
}

type SessionPayload = {
  userId: string;
  role: UserRole;
};

async function signSession(
  payload: SessionPayload,
  maxAgeSeconds: number,
): Promise<string> {
  return new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSeconds}s`)
    .sign(secret());
}

async function readSession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), {
      algorithms: ["HS256"],
    });

    const userId = payload.sub;
    const role = payload.role;

    if (typeof userId !== "string") return null;
    if (role !== "customer" && role !== "admin") return null;

    return { userId, role };
  } catch {
    // Просроченный или подделанный токен — просто «нет сессии».
    return null;
  }
}

/**
 * @param remember «Запомнить меня». true — кука на 30 дней. false —
 * сессионная кука без maxAge плюс короткоживущий токен.
 */
export async function createSession(
  userId: string,
  role: UserRole,
  remember: boolean,
): Promise<void> {
  const maxAge = remember ? REMEMBER_MAX_AGE_SECONDS : SESSION_MAX_AGE_SECONDS;
  const token = await signSession({ userId, role }, maxAge);
  const store = await cookies();

  store.set(cookieName(role), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(remember ? { maxAge } : {}),
  });
}

export async function destroySession(role: UserRole): Promise<void> {
  const store = await cookies();
  store.delete(cookieName(role));
}

/**
 * Текущий пользователь для запрошенной роли.
 *
 * Роль из токена сверяется с ролью в базе: если администратора понизили,
 * выданный ранее токен перестаёт работать сразу, без ожидания истечения.
 */
export async function getCurrentUser(
  role: UserRole = "customer",
): Promise<PublicUser | null> {
  const store = await cookies();
  const token = store.get(cookieName(role))?.value;

  if (!token) return null;

  const session = await readSession(token);
  if (!session || session.role !== role) return null;

  const user = getUserById(session.userId);
  if (!user || user.role !== role) return null;

  return toPublicUser(user);
}

export async function getCurrentCustomer(): Promise<PublicUser | null> {
  return getCurrentUser("customer");
}

export async function getCurrentAdmin(): Promise<PublicUser | null> {
  return getCurrentUser("admin");
}
