"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/Button";
import { useHydrated } from "@/lib/hooks/useHydrated";

/**
 * Подтверждение необратимого действия: отмена заказа, изменение данных
 * профиля. Нативный confirm() не годится — он выглядит чужеродно и не
 * поддаётся стилизации.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Подтвердить",
  cancelLabel = "Отмена",
  pending = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const hydrated = useHydrated();

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!hydrated || !open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-fg/40 sm:items-center sm:p-6"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md rounded-t-2xl border border-line bg-bg p-6 sm:rounded-2xl md:p-8"
      >
        <h2 className="font-display text-2xl">{title}</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">{description}</p>

        <div className="mt-8 flex flex-col gap-2 sm:flex-row-reverse">
          <Button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="sm:flex-1"
          >
            {confirmLabel}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={pending}
            className="sm:flex-1"
          >
            {cancelLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
