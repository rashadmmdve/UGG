"use server";

import { nanoid } from "nanoid";
import { redirect } from "next/navigation";

import { assertAdmin } from "@/server/admin/guard";
import {
  deletePromocode,
  getPromocodeByCode,
  savePromocode,
} from "@/server/repositories/promocodes";
import {
  DENIED,
  fieldErrorsFrom,
  numberOrNull,
  stringOrNull,
  type ActionState,
} from "@/server/validation/errors";
import { promocodeSchema } from "@/server/validation/schemas";

export async function savePromocodeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await assertAdmin())) return DENIED;

  const existingId = stringOrNull(formData.get("id"));

  // Дата из поля date приходит как YYYY-MM-DD; код должен работать до
  // конца указанного дня, а не до его начала.
  const expiresDate = stringOrNull(formData.get("expiresAt"));

  const parsed = promocodeSchema.safeParse({
    id: existingId ?? nanoid(12),
    code: formData.get("code"),
    type: formData.get("type"),
    value: formData.get("value"),
    minOrderTotal: formData.get("minOrderTotal") || 0,
    expiresAt: expiresDate ? `${expiresDate}T23:59:59` : null,
    usageLimit: numberOrNull(formData.get("usageLimit")),
    isActive: formData.get("isActive") === "on",
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const clash = getPromocodeByCode(parsed.data.code);
  if (clash && clash.id !== parsed.data.id) {
    return { fieldErrors: { code: "Такой промокод уже есть" } };
  }

  const saved = savePromocode({ ...parsed.data, id: existingId ?? undefined });

  if (!existingId) redirect(`/admin/promocodes/${saved.id}?created=1`);
  return { success: "Сохранено" };
}

export async function deletePromocodeAction(formData: FormData): Promise<void> {
  if (!(await assertAdmin())) return;
  deletePromocode(String(formData.get("id") ?? ""));
  redirect("/admin/promocodes");
}
