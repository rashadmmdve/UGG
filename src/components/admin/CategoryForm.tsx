"use client";

import { useActionState, useState } from "react";

import { ImageUploader } from "@/components/admin/ImageUploader";
import {
  ACheckbox,
  AField,
  ASelect,
  ATextarea,
  FormMessage,
  SubmitButton,
} from "@/components/admin/ui";
import { SECTIONS } from "@/lib/constants";
import { slugify } from "@/lib/utils";
import { saveCategoryAction } from "@/server/admin/actions/catalog";
import type { ActionState } from "@/server/validation/errors";
import type { Category } from "@/lib/types";

export function CategoryForm({ category }: { category: Category | null }) {
  const [state, action] = useActionState<ActionState, FormData>(
    saveCategoryAction,
    {},
  );
  const isNew = category === null;

  const [title, setTitle] = useState(category?.title ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [sectionSlug, setSectionSlug] = useState(
    category?.sectionSlug ?? SECTIONS[0].slug,
  );
  const [image, setImage] = useState<string[]>(category?.image ? [category.image] : []);

  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-8" noValidate>
      {category && <input type="hidden" name="id" value={category.id} />}
      <input type="hidden" name="image" value={image[0] ?? ""} />

      <FormMessage error={state.error} success={state.success} />

      <section className="rounded-lg border border-line bg-bg p-5">
        <h2 className="font-semibold">Основное</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <ASelect
            id="sectionSlug"
            name="sectionSlug"
            label="Раздел"
            value={sectionSlug}
            onChange={(event) => setSectionSlug(event.target.value)}
            options={SECTIONS.map((section) => ({
              value: section.slug,
              label: section.title,
            }))}
            error={errors.sectionSlug}
          />
          <AField
            id="order"
            name="order"
            label="Порядок в меню"
            type="number"
            min={0}
            defaultValue={category?.order ?? 0}
            error={errors.order}
          />
          <AField
            id="title"
            name="title"
            label="Название"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              if (!slugTouched) setSlug(slugify(event.target.value));
            }}
            error={errors.title}
          />
          <AField
            id="shortTitle"
            name="shortTitle"
            label="Короткое название для меню"
            defaultValue={category?.shortTitle ?? ""}
            hint="Если полное слишком длинное"
            error={errors.shortTitle}
          />
          <AField
            id="slug"
            name="slug"
            label="Адрес страницы"
            value={slug}
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(event.target.value);
            }}
            hint={`/catalog/${sectionSlug}/${slug || "…"} — после индексации менять дорого`}
            error={errors.slug}
            className="md:col-span-2"
          />
          <ATextarea
            id="description"
            name="description"
            label="Описание"
            defaultValue={category?.description ?? ""}
            rows={3}
            error={errors.description}
            className="md:col-span-2"
          />
          <ATextarea
            id="aliases"
            name="aliases"
            label="Синонимы адреса"
            defaultValue={category?.aliases.join("\n") ?? ""}
            rows={3}
            hint="По одному в строке. Отдаются постоянным редиректом на эту категорию — отдельной страницы у синонима нет"
            error={errors.aliases}
            className="md:col-span-2"
          />
        </div>
      </section>

      <section className="rounded-lg border border-line bg-bg p-5">
        <h2 className="font-semibold">Изображение</h2>
        <p className="mt-1 text-xs text-muted">Для меню и карточки раздела. Одно фото.</p>
        <div className="mt-4">
          <ImageUploader value={image} onChange={(urls) => setImage(urls.slice(-1))} />
        </div>
      </section>

      <section className="rounded-lg border border-line bg-bg p-5">
        <h2 className="font-semibold">SEO</h2>
        <p className="mt-1 text-xs text-muted">
          Пустые поля заполняются по шаблону. Текст под сеткой — свой, не из
          шаблона: это то, что отличает страницу от пустой витрины.
        </p>
        <div className="mt-4 grid gap-4">
          <AField id="seoMetaTitle" name="seoMetaTitle" label="Заголовок страницы (title)"
            defaultValue={category?.seo.metaTitle ?? ""} maxLength={120} />
          <ATextarea id="seoMetaDescription" name="seoMetaDescription" label="Описание (description)"
            defaultValue={category?.seo.metaDescription ?? ""} rows={2} maxLength={320} />
          <AField id="seoH1" name="seoH1" label="Заголовок H1"
            defaultValue={category?.seo.h1 ?? ""} maxLength={160} />
          <ATextarea id="seoText" name="seoText" label="Текст под сеткой товаров"
            defaultValue={category?.seo.seoText ?? ""} rows={10}
            hint="Допускается простая разметка: абзацы, заголовки, списки" />
          <ACheckbox id="seoNoindex" name="seoNoindex" label="Закрыть от индексации"
            defaultChecked={category?.seo.noindex ?? false} />
        </div>
      </section>

      <div className="flex items-center gap-6 rounded-lg border border-line bg-bg p-5">
        <ACheckbox id="isPublished" name="isPublished" label="Опубликована"
          defaultChecked={category?.isPublished ?? true} />
        <SubmitButton className="ml-auto">
          {isNew ? "Создать категорию" : "Сохранить"}
        </SubmitButton>
      </div>
    </form>
  );
}
