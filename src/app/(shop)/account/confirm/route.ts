import { NextResponse } from "next/server";

import { SITE_URL } from "@/lib/constants";
import { createSession } from "@/server/auth/session";
import { verifyEmailToken } from "@/server/auth/verification";

/**
 * Переход по ссылке из письма: /account/confirm?token=…
 *
 * Обработчик маршрута, а не страница: вход выставляет куку сессии, а
 * серверный компонент при отрисовке менять куки не может. Успех —
 * сразу в кабинет; неудача — на страницу подтверждения с объяснением
 * и кнопкой «отправить письмо ещё раз».
 */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const result = verifyEmailToken(token);

  if (!result.ok) {
    return NextResponse.redirect(`${SITE_URL}/account/verify?error=${result.reason}`, 303);
  }

  await createSession(result.user.id, "customer", true);
  return NextResponse.redirect(`${SITE_URL}/account?verified=1`, 303);
}
