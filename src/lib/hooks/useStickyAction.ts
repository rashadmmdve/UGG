"use client";

import { useActionState, useState } from "react";

/**
 * useActionState, после которого поля не пустеют.
 *
 * Форму с action={…} React очищает после каждой отправки — и при ошибке
 * «укажите телефон» покупатель заново вводил имя и почту. Здесь
 * введённое запоминается до вызова действия и отдаётся формам как
 * defaultValue: после очистки поле берёт новое значение по умолчанию.
 * Пароли не запоминаются — их всегда вводят заново.
 */
export function useStickyAction<S extends object>(
  action: (prev: Awaited<S>, formData: FormData) => Promise<S>,
  initial: Awaited<S>,
) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [state, formAction, pending] = useActionState(async (prev: Awaited<S>, formData: FormData) => {
    const kept: Record<string, string> = {};
    for (const [name, value] of formData.entries()) {
      if (typeof value === "string" && !/password|confirm/i.test(name)) kept[name] = value;
    }
    setValues(kept);
    return action(prev, formData);
  }, initial);

  return { state, action: formAction, pending, values };
}
