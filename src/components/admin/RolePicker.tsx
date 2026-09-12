"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

import { cn } from "@/lib/utils";
import { setUserRoleAction } from "@/server/admin/actions/users";
import type { UserRole } from "@/lib/types";

/**
 * Роль пользователя.
 *
 * Пока роль совпадает с сохранённой, менять нечего — список и «ОК»
 * блёклые: так видно, что нажатие уже сделано и висеть на кнопке
 * незачем. Пока изменение сохраняется, они блёклые по другой причине —
 * чтобы не нажали второй раз.
 */
const ROLES: { value: UserRole; label: string }[] = [
  { value: "customer", label: "Покупатель" },
  { value: "operator", label: "Оператор" },
  { value: "admin", label: "Администратор" },
];

function Fields({ saved, email }: { saved: UserRole; email: string }) {
  const { pending } = useFormStatus();
  const [value, setValue] = useState<UserRole>(saved);
  const idle = value === saved || pending;

  return (
    <>
      <select
        name="role"
        value={value}
        disabled={pending}
        onChange={(event) => setValue(event.target.value as UserRole)}
        aria-label={`Роль: ${email}`}
        className={cn(
          "h-8 rounded border border-line bg-bg px-2 text-xs transition-opacity",
          idle && "opacity-50",
        )}
      >
        {ROLES.map((role) => (
          <option key={role.value} value={role.value}>
            {role.label}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={idle}
        className={cn(
          "rounded border border-line px-2 text-xs transition-opacity",
          idle ? "cursor-default opacity-50" : "hover:border-accent",
        )}
      >
        {pending ? "…" : "ОК"}
      </button>
    </>
  );
}

export function RolePicker({ id, role, email }: { id: string; role: UserRole; email: string }) {
  return (
    // key по роли: после сохранения страница приходит с новым значением,
    // и поле должно начать отсчёт заново — иначе «ОК» остался бы живым.
    <form key={role} action={setUserRoleAction} className="flex gap-1">
      <input type="hidden" name="id" value={id} />
      <Fields saved={role} email={email} />
    </form>
  );
}
