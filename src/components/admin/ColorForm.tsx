"use client";

import { useActionState, useState } from "react";

import { AField, FormMessage, SubmitButton } from "@/components/admin/ui";
import { slugify } from "@/lib/utils";
import { saveColorAction } from "@/server/admin/actions/catalog";
import type { ActionState } from "@/server/validation/errors";
import type { Color } from "@/lib/types";

/**
 * Форма цвета.
 *
 * Адрес (slug) образуется от группы, а не от названия оттенка: Black,
 * Onyx и Metallic Black — три оттенка одной группы «Чёрные», и посадочная
 * страница /chernye у них общая.
 */
export function ColorForm({
  color,
  groups,
}: {
  color: Color | null;
  /** Существующие группы — для подсказок, чтобы не плодить «Чёрные» и «Черные». */
  groups: string[];
}) {
  const [state, action] = useActionState<ActionState, FormData>(saveColorAction, {});
  const isNew = color === null;

  const [group, setGroup] = useState(color?.group ?? "");
  const [slug, setSlug] = useState(color?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [hex, setHex] = useState(color?.hex ?? "#a05c33");

  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-6" noValidate>
      {color && <input type="hidden" name="id" value={color.id} />}

      <FormMessage error={state.error} success={state.success} />

      <section className="rounded-lg border border-line bg-bg p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <AField
            id="title"
            name="title"
            label="Название оттенка"
            defaultValue={color?.title ?? ""}
            hint="Как у производителя: Chestnut, Metallic Black"
            error={errors.title}
          />
          <div>
            <AField
              id="group"
              name="group"
              label="Группа для фильтра"
              value={group}
              list="color-groups"
              onChange={(event) => {
                setGroup(event.target.value);
                if (!slugTouched) setSlug(slugify(event.target.value));
              }}
              hint="Коричневые, Чёрные, Бежевые…"
              error={errors.group}
            />
            <datalist id="color-groups">
              {groups.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </div>
          <AField
            id="slug"
            name="slug"
            label="Адрес группы"
            value={slug}
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(event.target.value);
            }}
            hint="Латиницей; попадает в адрес посадочной страницы: /…/chernye"
            error={errors.slug}
          />
          <div>
            <label htmlFor="hex" className="block text-xs font-medium text-muted">
              Цвет образца
            </label>
            <div className="mt-1 flex items-center gap-2">
              <input
                id="hex-picker"
                type="color"
                value={hex}
                onChange={(event) => setHex(event.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-line bg-bg p-0.5"
                aria-label="Выбрать цвет"
              />
              <input
                id="hex"
                name="hex"
                value={hex}
                onChange={(event) => setHex(event.target.value)}
                className="w-full rounded border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
                placeholder="#a05c33"
              />
            </div>
            {errors.hex && <p className="mt-1 text-xs text-danger">{errors.hex}</p>}
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <SubmitButton>{isNew ? "Добавить цвет" : "Сохранить"}</SubmitButton>
      </div>
    </form>
  );
}
