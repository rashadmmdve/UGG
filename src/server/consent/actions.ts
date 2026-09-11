"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { CONSENT_COOKIE, CONSENT_MAX_AGE, type Consent } from "@/lib/consent";

/**
 * Ответ на вопрос о cookies.
 *
 * Отказ уводит на главную сразу: с этого момента proxy.ts пускает
 * только туда, и оставлять посетителя на странице, которую он больше
 * не может обновить, нечестно. Согласие ничего не перезагружает —
 * баннер просто исчезает.
 */
async function remember(choice: Consent): Promise<void> {
  const store = await cookies();
  store.set(CONSENT_COOKIE, choice, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CONSENT_MAX_AGE[choice],
  });
}

export async function acceptCookiesAction(): Promise<void> {
  await remember("accepted");
}

export async function declineCookiesAction(): Promise<void> {
  await remember("declined");
  redirect("/");
}
