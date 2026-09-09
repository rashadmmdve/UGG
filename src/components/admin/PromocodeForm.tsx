"use client";

import { useActionState, useState } from "react";

import { ACheckbox, AField, ASelect, FormMessage, SubmitButton } from "@/components/admin/ui";
import { savePromocodeAction } from "@/server/admin/actions/promocodes";
import type { ActionState } from "@/server/validation/errors";
import type { Promocode } from "@/lib/types";

export function PromocodeForm({ promocode }: { promocode: Promocode | null }) {
  const [state, action] = useActionState<ActionState, FormData>(savePromocodeAction, {});
  const [type, setType] = useState<Promocode["type"]>(promocode?.type ?? "percent");
  const errors = state.fieldErrors ?? {};
  const isNew = promocode === null;

  return (
    <form action={action} className="space-y-6" noValidate>
      {promocode && <input type="hidden" name="id" value={promocode.id} />}
      <FormMessage error={state.error} success={state.success} />

      <section className="rounded-lg border border-line bg-bg p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <AField
            id="code"
            name="code"
            label="Код"
            defaultValue={promocode?.code ?? ""}
            style={{ textTransform: "uppercase" }}
            hint="Латиница, цифры и дефис; регистр не важен"
            error={errors.code}
          />
          <ASelect
            id="type"
            name="type"
            label="Тип скидки"
            value={type}
            onChange={(e) => setType(e.target.value as Promocode["type"])}
            options={[
              { value: "percent", label: "Процент от суммы товаров" },
              { value: "fixed", label: "Фиксированная сумма, ₽" },
            ]}
            error={errors.type}
          />
          <AField
            id="value"
            name="value"
            label={type === "percent" ? "Скидка, %" : "Скидка, ₽"}
            type="number"
            min={1}
            max={type === "percent" ? 100 : undefined}
            defaultValue={promocode?.value ?? ""}
            error={errors.value}
          />
          <AField
            id="minOrderTotal"
            name="minOrderTotal"
            label="Минимальная сумма заказа, ₽"
            type="number"
            min={0}
            defaultValue={promocode?.minOrderTotal ?? 0}
            hint="Скидка считается только от товаров, доставка не учитывается"
            error={errors.minOrderTotal}
          />
          <AField
            id="expiresAt"
            name="expiresAt"
            label="Действует до"
            type="date"
            defaultValue={promocode?.expiresAt?.slice(0, 10) ?? ""}
            hint="Пусто — бессрочно. Работает до конца указанного дня"
            error={errors.expiresAt}
          />
          <AField
            id="usageLimit"
            name="usageLimit"
            label="Лимит использований"
            type="number"
            min={1}
            defaultValue={promocode?.usageLimit ?? ""}
            hint={
              promocode
                ? `Использован ${promocode.usedCount} раз. Пусто — без ограничения`
                : "Пусто — без ограничения"
            }
            error={errors.usageLimit}
          />
        </div>
      </section>

      <div className="flex items-center gap-6 rounded-lg border border-line bg-bg p-5">
        <ACheckbox id="isActive" name="isActive" label="Активен"
          defaultChecked={promocode?.isActive ?? true} />
        <SubmitButton className="ml-auto">{isNew ? "Создать промокод" : "Сохранить"}</SubmitButton>
      </div>
    </form>
  );
}
