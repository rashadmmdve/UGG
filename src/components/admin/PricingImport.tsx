"use client";

import { useActionState } from "react";

import { FormMessage, SubmitButton } from "@/components/admin/ui";
import { importPricingAction } from "@/server/admin/actions/pricing";
import type { ActionState } from "@/server/validation/errors";

/** Загрузка CSV с ценами. Итог — сколько изменено, сколько не найдено. */
export function PricingImport() {
  const [state, action] = useActionState<ActionState, FormData>(importPricingAction, {});

  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input
        type="file"
        name="file"
        accept=".csv,text/csv"
        required
        aria-label="Файл CSV с ценами"
        className="text-sm file:mr-3 file:rounded file:border file:border-line file:bg-bg file:px-3 file:py-1.5 file:text-sm file:hover:border-accent"
      />
      <SubmitButton variant="outline">Загрузить</SubmitButton>
      <div className="basis-full">
        <FormMessage error={state.error} success={state.success} />
      </div>
    </form>
  );
}
