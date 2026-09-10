import "server-only";

import { redirect } from "next/navigation";

import { getCurrentAdmin } from "@/server/auth/session";
import type { PublicUser } from "@/lib/types";

/**
 * Проверка прав администратора.
 *
 * Вызывается и в layout админки (чтобы страница вообще не отрисовалась),
 * и внутри каждого серверного действия: действия доступны прямым POST-запросом
 * в обход интерфейса, поэтому одной проверки в layout недостаточно.
 *
 * Посторонний уходит на главную, а не на страницу входа: по ответу не
 * видно, что по этому адресу вообще что-то есть. Владелец сначала входит
 * на сайт обычным образом, и только после этого /admin открывается ему.
 */
export async function requireAdmin(): Promise<PublicUser> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/");
  return admin;
}

/** Вариант для серверных действий: возвращает null вместо редиректа. */
export async function assertAdmin(): Promise<PublicUser | null> {
  return getCurrentAdmin();
}
