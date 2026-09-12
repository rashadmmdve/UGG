"use server";

import { revalidatePath } from "next/cache";

import { assertAdmin } from "@/server/admin/guard";
import { getUserById, setUserRole } from "@/server/repositories/users";
import type { UserRole } from "@/lib/types";

const ROLES: UserRole[] = ["customer", "operator", "admin"];

/**
 * Выдать или снять роль сотрудника.
 *
 * Только владелец: оператор, назначающий операторов, — это уже второй
 * владелец. Себя понизить нельзя, иначе админка останется без хозяина.
 */
export async function setUserRoleAction(formData: FormData): Promise<void> {
  const admin = await assertAdmin();
  if (!admin) return;

  const id = String(formData.get("id") ?? "");
  const role = String(formData.get("role") ?? "") as UserRole;
  if (!id || !ROLES.includes(role)) return;
  if (id === admin.id) return;

  const user = getUserById(id);
  if (!user) return;

  setUserRole(id, role);
  revalidatePath("/admin/customers");
}
