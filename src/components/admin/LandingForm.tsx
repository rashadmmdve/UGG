"use client";

import { useActionState, useMemo, useState } from "react";

import {
  ACheckbox,
  AField,
  ASelect,
  ATextarea,
  FormMessage,
  SubmitButton,
} from "@/components/admin/ui";
import { SECTIONS } from "@/lib/constants";
import { FACET_TYPE_LABELS, facetSlugFor } from "@/lib/facets";
import { saveLandingAction } from "@/server/admin/actions/seo";
import type { ActionState } from "@/server/validation/errors";
import type { Category, Color, LandingFacetType, SeoLanding } from "@/lib/types";

const MIN_TEXT = 400;

const MATERIALS = [
  { value: "ovchina", label: "овчина" },
  { value: "zamsha", label: "замша" },
  { value: "kozha", label: "кожа" },
  { value: "vyazanyj", label: "вязаные" },
  { value: "tekstil", label: "текстиль" },
];

export function LandingForm({
  landing,
  categories,
  colors,
  productCount,
}: {
  landing: SeoLanding | null;
  categories: Category[];
  colors: Color[];
  /** Сколько товаров в наличии попадает под фасет — считается на сервере. */
  productCount: number | null;
}) {
  const [state, action] = useActionState<ActionState, FormData>(saveLandingAction, {});
  const isNew = landing === null;

  const [sectionSlug, setSectionSlug] = useState(landing?.sectionSlug ?? SECTIONS[0].slug);
  const [categorySlug, setCategorySlug] = useState(landing?.categorySlug ?? "");
  const [facetType, setFacetType] = useState<LandingFacetType>(landing?.facetType ?? "color");
  const [facetValue, setFacetValue] = useState(landing?.facetValue ?? "");
  const [facetSlug, setFacetSlug] = useState(landing?.facetSlug ?? "");
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [seoText, setSeoText] = useState(landing?.seoText ?? "");

  const errors = state.fieldErrors ?? {};

  const sectionCategories = useMemo(
    () => categories.filter((category) => category.sectionSlug === sectionSlug),
    [categories, sectionSlug],
  );

  /** Группы цветов — значение фасета для типа «цвет» это слаг группы. */
  const colorGroups = useMemo(() => {
    const seen = new Map<string, string>();
    for (const color of colors) if (!seen.has(color.slug)) seen.set(color.slug, color.group);
    return [...seen.entries()].map(([value, label]) => ({ value, label }));
  }, [colors]);

  function onFacetValue(value: string) {
    setFacetValue(value);
    if (!slugTouched) setFacetSlug(facetSlugFor(facetType, value));
  }

  function onFacetType(type: LandingFacetType) {
    setFacetType(type);
    setFacetValue("");
    if (!slugTouched) setFacetSlug("");
  }

  const textLength = seoText.trim().length;
  const textOk = textLength >= MIN_TEXT;

  return (
    <form action={action} className="space-y-8" noValidate>
      {landing && <input type="hidden" name="id" value={landing.id} />}

      <FormMessage error={state.error} success={state.success} />

      <section className="rounded-lg border border-line bg-bg p-5">
        <h2 className="font-semibold">Адрес</h2>
        <p className="mt-1 text-xs text-muted">
          /catalog/{sectionSlug}/{categorySlug || "…"}/{facetSlug || "…"}
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <ASelect
            id="sectionSlug"
            name="sectionSlug"
            label="Раздел"
            value={sectionSlug}
            onChange={(e) => {
              setSectionSlug(e.target.value);
              setCategorySlug("");
            }}
            options={SECTIONS.map((s) => ({ value: s.slug, label: s.title }))}
            error={errors.sectionSlug}
          />
          <ASelect
            id="categorySlug"
            name="categorySlug"
            label="Категория"
            value={categorySlug}
            onChange={(e) => setCategorySlug(e.target.value)}
            placeholder="— выберите —"
            options={sectionCategories.map((c) => ({ value: c.slug, label: c.title }))}
            error={errors.categorySlug}
          />
          <ASelect
            id="facetType"
            name="facetType"
            label="Тип фильтра"
            value={facetType}
            onChange={(e) => onFacetType(e.target.value as LandingFacetType)}
            options={(Object.keys(FACET_TYPE_LABELS) as LandingFacetType[]).map((t) => ({
              value: t,
              label: FACET_TYPE_LABELS[t],
            }))}
            error={errors.facetType}
          />

          {facetType === "color" && (
            <ASelect
              id="facetValue"
              name="facetValue"
              label="Группа цвета"
              value={facetValue}
              onChange={(e) => onFacetValue(e.target.value)}
              placeholder="— выберите —"
              options={colorGroups}
              error={errors.facetValue}
            />
          )}
          {facetType === "material" && (
            <ASelect
              id="facetValue"
              name="facetValue"
              label="Материал"
              value={facetValue}
              onChange={(e) => onFacetValue(e.target.value)}
              placeholder="— выберите —"
              options={MATERIALS}
              error={errors.facetValue}
            />
          )}
          {facetType === "size" && (
            <AField
              id="facetValue"
              name="facetValue"
              label="Размер EU"
              type="number"
              step="0.5"
              value={facetValue}
              onChange={(e) => onFacetValue(e.target.value)}
              error={errors.facetValue}
            />
          )}

          <AField
            id="facetSlug"
            name="facetSlug"
            label="Сегмент адреса"
            value={facetSlug}
            onChange={(e) => {
              setSlugTouched(true);
              setFacetSlug(e.target.value);
            }}
            hint="Подставляется автоматически; менять только до индексации"
            error={errors.facetSlug}
          />
          <ATextarea
            id="aliases"
            name="aliases"
            label="Синонимы сегмента"
            defaultValue={landing?.aliases.join("\n") ?? ""}
            rows={2}
            hint="По одному в строке, отдаются редиректом"
            error={errors.aliases}
          />
        </div>

        {productCount !== null && (
          <p className={`mt-4 text-sm ${productCount >= 3 ? "text-success" : "text-danger"}`}>
            Товаров в наличии под этот фильтр: {productCount}
            {productCount < 3 && " — меньше трёх, страница останется закрытой от индексации"}
          </p>
        )}
      </section>

      <section className="rounded-lg border border-line bg-bg p-5">
        <h2 className="font-semibold">Заголовки и метатеги</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <AField id="title" name="title" label="Короткое название"
            defaultValue={landing?.title ?? ""}
            hint="Для ссылок-чипов на странице категории: «Чёрные», «38 размер»"
            error={errors.title} />
          <AField id="h1" name="h1" label="Заголовок H1"
            defaultValue={landing?.h1 ?? ""} error={errors.h1} />
          <AField id="metaTitle" name="metaTitle" label="Заголовок страницы (title)"
            defaultValue={landing?.metaTitle ?? ""} maxLength={120}
            error={errors.metaTitle} className="md:col-span-2" />
          <ATextarea id="metaDescription" name="metaDescription" label="Описание (description)"
            defaultValue={landing?.metaDescription ?? ""} rows={2} maxLength={320}
            error={errors.metaDescription} className="md:col-span-2" />
        </div>
      </section>

      <section className="rounded-lg border border-line bg-bg p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">Собственный текст</h2>
          <span className={`text-xs ${textOk ? "text-success" : "text-muted"}`}>
            {textLength} / {MIN_TEXT} знаков
          </span>
        </div>
        <p className="mt-1 text-xs text-muted">
          Именно этот текст отличает посадочную от дорвея. Пишется вручную под
          конкретный фильтр: чем чёрные мини-угги отличаются от остальных, кому
          подойдут, как ухаживать. Шаблонный текст Яндекс распознаёт.
        </p>
        <ATextarea
          id="seoText"
          name="seoText"
          label=""
          value={seoText}
          onChange={(e) => setSeoText(e.target.value)}
          rows={14}
          error={errors.seoText}
          className="mt-3"
        />
      </section>

      <div className="flex items-center gap-6 rounded-lg border border-line bg-bg p-5">
        <ACheckbox id="isPublished" name="isPublished" label="Опубликована"
          defaultChecked={landing?.isPublished ?? false} />
        <span className="text-xs text-muted">
          Публикация возможна только с заполненными заголовками и текстом от {MIN_TEXT} знаков.
        </span>
        <SubmitButton className="ml-auto">
          {isNew ? "Создать" : "Сохранить"}
        </SubmitButton>
      </div>
    </form>
  );
}
