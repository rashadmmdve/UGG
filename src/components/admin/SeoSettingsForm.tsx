"use client";

import { useActionState } from "react";

import { AField, ATextarea, FormMessage, SubmitButton } from "@/components/admin/ui";
import { saveSeoSettingsAction } from "@/server/admin/actions/seo";
import type { ActionState } from "@/server/validation/errors";
import type { SeoSettings } from "@/lib/types";

const TOKENS = "{site} {category} {facet} {title} {count} {minPrice} {price}";

function TemplateBlock({
  name,
  heading,
  note,
  value,
  errors,
}: {
  name: "category" | "product" | "landing";
  heading: string;
  note: string;
  value: { title: string; description: string };
  errors: Record<string, string>;
}) {
  return (
    <section className="rounded-lg border border-line bg-bg p-5">
      <h2 className="font-semibold">{heading}</h2>
      <p className="mt-1 text-xs text-muted">{note}</p>
      <div className="mt-4 grid gap-4">
        <AField
          id={`${name}Title`}
          name={`${name}Title`}
          label="Заголовок страницы (title)"
          defaultValue={value.title}
          error={errors[`${name}Title`]}
        />
        <ATextarea
          id={`${name}Description`}
          name={`${name}Description`}
          label="Описание (description)"
          defaultValue={value.description}
          rows={2}
          error={errors[`${name}Description`]}
        />
      </div>
    </section>
  );
}

export function SeoSettingsForm({ settings }: { settings: SeoSettings }) {
  const [state, action] = useActionState<ActionState, FormData>(
    saveSeoSettingsAction,
    {},
  );
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-6" noValidate>
      <FormMessage error={state.error} success={state.success} />

      <p className="rounded border border-line bg-elevated px-3 py-2 text-xs text-muted">
        Подстановки: <code>{TOKENS}</code>. Фрагмент «от {"{minPrice}"} ₽» вырезается
        сам, когда товаров нет.
      </p>

      <TemplateBlock
        name="category"
        heading="Категории и разделы"
        note="Применяется, когда у категории не заполнены свои метатеги."
        value={settings.templates.category}
        errors={errors}
      />
      <TemplateBlock
        name="product"
        heading="Карточки товаров"
        note="{title} — название товара, {price} — цена."
        value={settings.templates.product}
        errors={errors}
      />
      <TemplateBlock
        name="landing"
        heading="Посадочные страницы фильтров"
        note="{facet} — название фильтра: «чёрные», «38 размер»."
        value={settings.templates.landing}
        errors={errors}
      />

      <section className="rounded-lg border border-line bg-bg p-5">
        <h2 className="font-semibold">Счётчики и подтверждение прав</h2>
        <p className="mt-1 text-xs text-muted">
          Коды подтверждения из Яндекс Вебмастера и Google Search Console попадают в метатеги всех страниц.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <AField id="yandexMetrikaId" name="yandexMetrikaId" label="Номер счётчика Яндекс Метрики"
            defaultValue={settings.yandexMetrikaId} inputMode="numeric" />
          <AField id="googleAnalyticsId" name="googleAnalyticsId" label="Идентификатор Google Analytics"
            defaultValue={settings.googleAnalyticsId} placeholder="G-XXXXXXXXXX" />
          <AField id="yandexVerification" name="yandexVerification" label="Код подтверждения Яндекс"
            defaultValue={settings.yandexVerification} />
          <AField id="googleVerification" name="googleVerification" label="Код подтверждения Google"
            defaultValue={settings.googleVerification} />
        </div>
      </section>

      <div className="flex justify-end">
        <SubmitButton>Сохранить</SubmitButton>
      </div>
    </form>
  );
}
