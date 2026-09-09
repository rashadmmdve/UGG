"use client";

import { useActionState, useEffect, useRef } from "react";

import { AField, ASelect, FormMessage, SubmitButton } from "@/components/admin/ui";
import { saveRedirectAction } from "@/server/admin/actions/seo";
import type { ActionState } from "@/server/validation/errors";

/**
 * Добавление редиректа. После успеха форма очищается — редиректы обычно
 * заводят пачкой, при переезде со старых адресов.
 */
export function RedirectForm() {
  const [state, action] = useActionState<ActionState, FormData>(saveRedirectAction, {});
  const formRef = useRef<HTMLFormElement>(null);
  const errors = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-3" noValidate>
      <FormMessage error={state.error} success={state.success} />
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_140px_auto] md:items-end">
        <AField id="from" name="from" label="Старый адрес" placeholder="/category/classic-mini/"
          error={errors.from} />
        <AField id="to" name="to" label="Новый адрес" placeholder="/catalog/zhenskie/classic-mini"
          error={errors.to} />
        <ASelect id="code" name="code" label="Код" defaultValue="301"
          options={[
            { value: "301", label: "301 — переехал" },
            { value: "410", label: "410 — удалён" },
          ]}
          error={errors.code} />
        <SubmitButton>Добавить</SubmitButton>
      </div>
      <p className="text-xs text-muted">
        410 — для снятых с продажи товаров: поисковик уберёт адрес из индекса
        быстрее, чем по 404, и не будет возвращаться к нему.
      </p>
    </form>
  );
}
