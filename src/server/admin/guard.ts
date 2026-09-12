import "server-only";

import { redirect } from "next/navigation";

import { getCurrentAdmin, getCurrentStaff } from "@/server/auth/session";
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

/**
 * То же для работы с заказами: её ведёт и оператор.
 *
 * Всё остальное — товары, цены, тексты, деньги — остаётся за
 * администратором: там по-прежнему assertAdmin.
 */
export async function requireStaff(): Promise<PublicUser> {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/");
  return staff;
}

export async function assertStaff(): Promise<PublicUser | null> {
  return getCurrentStaff();
}

/**
 * Что открыто оператору. Остальное в админке — только владельцу, и
 * проверяется это в одном месте, в layout: страниц много, а забыть
 * проверку на одной из них — вопрос времени.
 */
export function isOperatorPath(pathname: string): boolean {
  const rest = pathname.replace(/^\/(admin|operator)/, "");
  return (
    rest === "/dispatch" ||
    rest === "/orders" ||
    rest.startsWith("/orders/") ||
    rest === "/couriers" ||
    rest.startsWith("/couriers/")
  );
}

/**
 * Какая панель открыта. Одна и та же страница живёт под /admin и под
 * /operator — proxy подменяет адрес, а здесь по исходному пути решается,
 * как панель себя называет и куда вести ссылки.
 */
export type Panel = "admin" | "operator";

export function panelOf(pathname: string): Panel {
  return pathname.startsWith("/operator") ? "operator" : "admin";
}
