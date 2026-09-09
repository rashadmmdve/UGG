"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

/**
 * Форма для необратимого действия: удаление товара, категории, отзыва.
 *
 * Действие уходит на сервер только после подтверждения в диалоге.
 * Скрытые поля передаются как есть — обычно это один идентификатор.
 *
 * `redirectTo` — куда уйти после успеха, если само действие не делает
 * редирект. Без этого страница осталась бы на уже удалённой записи.
 */
export function ConfirmForm({
  action,
  fields,
  title,
  description,
  confirmLabel = "Удалить",
  buttonLabel = "Удалить",
  redirectTo,
  className,
}: {
  action: (formData: FormData) => Promise<void>;
  fields: Record<string, string>;
  title: string;
  description: string;
  confirmLabel?: string;
  buttonLabel?: string;
  redirectTo?: string;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    const formData = new FormData();
    for (const [key, value] of Object.entries(fields)) formData.set(key, value);
    startTransition(async () => {
      await action(formData);
      setOpen(false);
      if (redirectTo) router.push(redirectTo);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "inline-flex h-9 items-center rounded border border-danger/40 px-4 text-sm text-danger transition hover:bg-danger/5"
        }
      >
        {buttonLabel}
      </button>

      <ConfirmDialog
        open={open}
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        pending={pending}
        onConfirm={confirm}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
