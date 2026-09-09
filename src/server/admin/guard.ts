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
 */
export async function requireAdmin(): Promise<PublicUser> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

/** Вариант для серверных действий: возвращает null вместо редиректа. */
export async function assertAdmin(): Promise<PublicUser | null> {
  return getCurrentAdmin();
}
