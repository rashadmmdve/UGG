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

  // Путь в заголовке: layout админки решает по нему, пускать ли
  // оператора, — серверные компоненты своего адреса не знают.
  const headers = new Headers(request.headers);
  headers.set("x-pathname", pathname);
  const response = NextResponse.next({ request: { headers } });

  const isPrivate =
    pathname.startsWith("/admin") ||
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
