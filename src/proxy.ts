import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { CONSENT_COOKIE, isAllowedWhenDeclined } from "@/lib/consent";

/**
 * В Next.js 16 middleware называется proxy. Файл лежит рядом с app/.
 *
 * Здесь заголовки и одно правило про cookies. Проверка сессии
 * администратора делается в layout админки и внутри каждого серверного
 * действия: proxy не является полноценным слоем авторизации, а серверные
 * действия он и вовсе не перехватывает — они приходят POST-запросом на
 * тот же маршрут.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Отказавшийся от cookies ходит только на главную и в политику.
  // Без ответа (первый визит, поисковый робот) ограничений нет —
  // иначе индексация уперлась бы в стену.
  if (
    request.cookies.get(CONSENT_COOKIE)?.value === "declined" &&
    !isAllowedWhenDeclined(pathname)
  ) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Путь в заголовке: layout панели решает по нему, кого пускать и как
  // себя называть, — серверные компоненты своего адреса не знают.
  const headers = new Headers(request.headers);
  headers.set("x-pathname", pathname);

  // Панель оператора — те же страницы, что у владельца, но под своим
  // адресом: /operator/… показывает /admin/…. Отдельная панель нужна
  // не ради кода, а ради людей: оператор видит «свою» панель с тремя
  // разделами, а не урезанную чужую.
  const response = pathname.startsWith("/operator")
    ? NextResponse.rewrite(
        new URL(pathname.replace(/^\/operator/, "/admin") + request.nextUrl.search, request.url),
        { request: { headers } },
      )
    : NextResponse.next({ request: { headers } });

  const isPrivate =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/operator") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/account") ||
    pathname.startsWith("/cart") ||
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/favorites") ||
    pathname.startsWith("/search");

  if (isPrivate) {
    response.headers.set(
      "X-Robots-Tag",
      "noindex, nofollow, noarchive, nosnippet",
    );
  }

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Frame-Options", "SAMEORIGIN");

  return response;
}

export const config = {
  matcher: [
    /**
     * Всё, кроме статики и служебных файлов.
     *
     * sitemap.xml и robots.txt исключены намеренно: это метафайлы Next,
     * и пропускать их через proxy документация прямо не рекомендует.
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap|robots\\.txt|feed\\.yml|images/|uploads/).*)",
  ],
};
