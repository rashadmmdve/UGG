import "server-only";

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

import { getUserById, toPublicUser } from "@/server/repositories/users";
import type { PublicUser } from "@/lib/types";

/**
 * Сессия на подписанном JWT в httpOnly-cookie.
 *
 * Вход на сайт один для всех: и покупатель, и владелец входят через
 * /account/login. Отдельной страницы входа в панель управления нет —
 * права даёт роль в базе, а не особая сессия. Роль читается из базы при
 * каждом запросе, поэтому снятая роль закрывает доступ сразу, не
 * дожидаясь, пока истечёт выданный токен.
 */

const SESSION_COOKIE = "ugg_session";

/** Кука прежней, отдельной сессии админки — осталась, чтобы её стереть. */
const LEGACY_ADMIN_COOKIE = "ugg_admin";

/**
 * Метка «этот посетитель — администратор», видимая из браузера.
 *
 * Сама сессия лежит в httpOnly-куке, до которой скриптам не добраться, —
 * и это правильно. Но витрина отдаётся из кэша одинаковой всем, и если
 * читать сессию при её сборке, восемьсот страниц каталога перестанут
 * кэшироваться ради одной кнопки в шапке. Поэтому кнопку показывает
 * браузер по этой метке.
 *
 * Правами она не управляет: подделавший её увидит кнопку, но админка
 * всё равно проверит настоящую сессию и отправит его на главную.
 */
const ROLE_COOKIE = "ugg_role";

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

async function signSession(userId: string, maxAgeSeconds: number): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSeconds}s`)
    .sign(secret());
}

async function readSession(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), {
      algorithms: ["HS256"],
    });

    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    // Просроченный или подделанный токен — просто «нет сессии».
    return null;
  }
}

/**
 * @param remember «Запомнить меня». true — кука на 30 дней. false —
 * сессионная кука без maxAge плюс короткоживущий токен.
 */
export async function createSession(userId: string, remember: boolean): Promise<void> {
  const maxAge = remember ? REMEMBER_MAX_AGE_SECONDS : SESSION_MAX_AGE_SECONDS;
  const token = await signSession(userId, maxAge);
  const store = await cookies();

  const options = {
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(remember ? { maxAge } : {}),
  };

  store.set(SESSION_COOKIE, token, { httpOnly: true, ...options });

  const user = getUserById(userId);
  if (user?.role === "admin") store.set(ROLE_COOKIE, "admin", options);
  else store.delete(ROLE_COOKIE);
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  store.delete(LEGACY_ADMIN_COOKIE);
  store.delete(ROLE_COOKIE);
}

/** Кто вошёл на сайт; null — никто. */
export async function getCurrentUser(): Promise<PublicUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (!token) return null;

  const userId = await readSession(token);
  if (!userId) return null;

  const user = getUserById(userId);
  if (!user) return null;

  return toPublicUser(user);
}

export async function getCurrentCustomer(): Promise<PublicUser | null> {
  return getCurrentUser();
}

/**
 * Тот же вошедший пользователь, но только если в базе у него роль
 * администратора. Для всех остальных — null, и панель отвечает так же,
 * как незнакомцу.
 */
export async function getCurrentAdmin(): Promise<PublicUser | null> {
  const user = await getCurrentUser();
  return user && user.role === "admin" ? user : null;
}
