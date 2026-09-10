"use client";

import { useActionState, useState } from "react";

import {
  ACheckbox,
  AField,
  ASelect,
  ATextarea,
  FormMessage,
  SubmitButton,
} from "@/components/admin/ui";
import { slugify } from "@/lib/utils";
import { saveModelLineAction } from "@/server/admin/actions/catalog";
import type { ActionState } from "@/server/validation/errors";
import type { Gender, ModelLine, SizeChart } from "@/lib/types";

const GENDERS: { value: Gender; label: string }[] = [
  { value: "women", label: "Женские" },
  { value: "men", label: "Мужские" },
  { value: "kids", label: "Детские" },
  { value: "unisex", label: "Унисекс" },
];

export function ModelLineForm({
  line,
  sizeCharts,
}: {
  line: ModelLine | null;
  sizeCharts: SizeChart[];
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    saveModelLineAction,
    {},
  );
  const isNew = line === null;

  const [title, setTitle] = useState(line?.title ?? "");
  const [slug, setSlug] = useState(line?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!isNew);

  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-6" noValidate>
      {line && <input type="hidden" name="id" value={line.id} />}

      <FormMessage error={state.error} success={state.success} />

      <section className="rounded-lg border border-line bg-bg p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <AField
            id="title"
            name="title"
            label="Название линии"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              if (!slugTouched) setSlug(slugify(event.target.value));
            }}
            error={errors.title}
          />
          <AField
            id="slug"
            name="slug"
            label="Код"
            value={slug}
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(event.target.value);
            }}
            hint="Латиницей, используется в фильтрах"
            error={errors.slug}
          />
          <ASelect
            id="sizeChartId"
            name="sizeChartId"
            label="Размерная сетка"
            defaultValue={line?.sizeChartId ?? ""}
            placeholder="— не задана —"
            options={sizeCharts.map((chart) => ({ value: chart.id, label: chart.title }))}
            hint="По ней заполняются размеры в карточке товара одной кнопкой"
            error={errors.sizeChartId}
          />
          <AField
            id="order"
            name="order"
            label="Порядок"
            type="number"
            min={0}
            defaultValue={line?.order ?? 0}
            error={errors.order}
          />
          <fieldset className="md:col-span-2">
            <legend className="text-xs font-medium text-muted">Для кого выпускается</legend>
            {errors.genders && <p className="mt-1 text-xs text-danger">{errors.genders}</p>}
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
              {GENDERS.map((gender) => (
                <ACheckbox
                  key={gender.value}
                  id={`gender-${gender.value}`}
                  name="genders"
                  value={gender.value}
                  label={gender.label}
                  defaultChecked={line?.genders.includes(gender.value) ?? false}
                />
              ))}
            </div>
          </fieldset>
          <ATextarea
            id="description"
            name="description"
            label="Описание линии"
            defaultValue={line?.description ?? ""}
            rows={4}
            hint="Чем модель отличается от остальных: высота, посадка, назначение"
            error={errors.description}
            className="md:col-span-2"
          />
        </div>
      </section>

      <div className="flex justify-end">
        <SubmitButton>{isNew ? "Создать линию" : "Сохранить"}</SubmitButton>
      </div>
    </form>
  );
}
