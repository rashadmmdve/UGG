"use server";

import { revalidatePath } from "next/cache";

import { assertStaff } from "@/server/admin/guard";
import { saveDispatchSettings } from "@/server/repositories/settings";
import { dispatchToCouriers, type DispatchResult } from "@/server/telegram/dispatch";

/**
 * Разослать курьерам их списки прямо сейчас — не дожидаясь утра.
 * Нужно, когда заказы раздали поздно или что-то поменялось.
 */
export async function dispatchNowAction(): Promise<
  { ok: true; result: DispatchResult } | { ok: false; error: string }
> {
  if (!(await assertStaff())) return { ok: false, error: "Нет доступа" };

  try {
    return { ok: true, result: await dispatchToCouriers() };
  } catch (error) {
    console.error("Рассылка курьерам не удалась:", error);
    return { ok: false, error: "Телеграм не ответил. Попробуйте ещё раз через минуту." };
  }
}

/** Включить или выключить утреннюю рассылку. */
export async function setDailyDispatchAction(enabled: boolean): Promise<{ ok: boolean }> {
  if (!(await assertStaff())) return { ok: false };
  saveDispatchSettings({ daily: enabled });
  revalidatePath("/admin/dispatch");
  return { ok: true };
}
