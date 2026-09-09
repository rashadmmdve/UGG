"use client";

import { useActionState, useState } from "react";

import { ImageUploader } from "@/components/admin/ImageUploader";
import {
  ACheckbox,
  AField,
  ATextarea,
  FormMessage,
  SubmitButton,
} from "@/components/admin/ui";
import { slugify } from "@/lib/utils";
import { saveArticleAction } from "@/server/admin/actions/articles";
import type { ActionState } from "@/server/validation/errors";
import type { Article } from "@/lib/types";

type FaqRow = { key: number; question: string; answer: string };
let counter = 0;

export function ArticleForm({ article }: { article: Article | null }) {
  const [state, action] = useActionState<ActionState, FormData>(saveArticleAction, {});
  const isNew = article === null;

  const [title, setTitle] = useState(article?.title ?? "");
  const [slug, setSlug] = useState(article?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [cover, setCover] = useState<string[]>(article?.cover ? [article.cover] : []);
  const [faq, setFaq] = useState<FaqRow[]>(
    (article?.faq ?? []).map((item) => ({ key: ++counter, ...item })),
  );

  const errors = state.fieldErrors ?? {};

  function updateFaq(key: number, patch: Partial<FaqRow>) {
    setFaq((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  return (
    <form action={action} className="space-y-8" noValidate>
      {article && <input type="hidden" name="id" value={article.id} />}
      <input type="hidden" name="cover" value={cover[0] ?? ""} />
      <input
        type="hidden"
        name="faq"
        value={JSON.stringify(faq.map(({ question, answer }) => ({ question, answer })))}
      />

      <FormMessage error={state.error} success={state.success} />

      <section className="rounded-lg border border-line bg-bg p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <AField
            id="title"
            name="title"
            label="Заголовок"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
            error={errors.title}
            className="md:col-span-2"
          />
          <AField
            id="slug"
            name="slug"
            label="Адрес"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            hint={`/articles/${slug || "…"}`}
            error={errors.slug}
          />
          <AField
            id="publishedAt"
            name="publishedAt"
            label="Дата публикации"
            type="date"
            defaultValue={(article?.publishedAt ?? new Date().toISOString()).slice(0, 10)}
            error={errors.publishedAt}
          />
          <ATextarea
            id="excerpt"
            name="excerpt"
            label="Анонс"
            defaultValue={article?.excerpt ?? ""}
            rows={2}
            hint="Два-три предложения для списка статей и описания страницы"
            error={errors.excerpt}
            className="md:col-span-2"
          />
          <ATextarea
            id="body"
            name="body"
            label="Текст"
            defaultValue={article?.body ?? ""}
            rows={24}
            hint="HTML-разметка: <h2>, <p>, <ul>, <a>. Подзаголовки h2 обязательны — по ним поисковик понимает структуру"
            error={errors.body}
            className="md:col-span-2"
          />
        </div>
      </section>

      <section className="rounded-lg border border-line bg-bg p-5">
        <h2 className="font-semibold">Обложка</h2>
        <div className="mt-4">
          <ImageUploader value={cover} onChange={(urls) => setCover(urls.slice(-1))} />
        </div>
      </section>

      <section className="rounded-lg border border-line bg-bg p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Вопрос — ответ</h2>
            <p className="mt-1 text-xs text-muted">
              Попадает в разметку FAQPage и в быстрые ответы Яндекса. Два-четыре вопроса по теме статьи.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setFaq((rows) => [...rows, { key: ++counter, question: "", answer: "" }])}
            className="rounded border border-line px-3 py-1.5 text-sm hover:border-accent"
          >
            + Вопрос
          </button>
        </div>
        {errors.faq && <p className="mt-2 text-xs text-danger">{errors.faq}</p>}
        <ul className="mt-4 space-y-4">
          {faq.map((row) => (
            <li key={row.key} className="rounded border border-line p-3">
              <input
                value={row.question}
                onChange={(e) => updateFaq(row.key, { question: e.target.value })}
                placeholder="Вопрос"
                aria-label="Вопрос"
                className="w-full rounded border border-line px-3 py-2 text-sm font-medium"
              />
              <textarea
                value={row.answer}
                onChange={(e) => updateFaq(row.key, { answer: e.target.value })}
                placeholder="Ответ"
                aria-label="Ответ"
                rows={3}
                className="mt-2 w-full rounded border border-line px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => setFaq((rows) => rows.filter((r) => r.key !== row.key))}
                className="mt-2 text-xs text-muted hover:text-danger"
              >
                Удалить вопрос
              </button>
            </li>
          ))}
        </ul>
      </section>

      <details className="rounded-lg border border-line bg-bg p-5">
        <summary className="cursor-pointer font-semibold">SEO</summary>
        <div className="mt-4 grid gap-4">
          <AField id="seoMetaTitle" name="seoMetaTitle" label="Заголовок страницы (title)"
            defaultValue={article?.seo.metaTitle ?? ""} maxLength={120}
            hint="Пусто — берётся заголовок статьи" />
          <ATextarea id="seoMetaDescription" name="seoMetaDescription" label="Описание (description)"
            defaultValue={article?.seo.metaDescription ?? ""} rows={2} maxLength={320}
            hint="Пусто — берётся анонс" />
          <ACheckbox id="seoNoindex" name="seoNoindex" label="Закрыть от индексации"
            defaultChecked={article?.seo.noindex ?? false} />
        </div>
      </details>

      <div className="flex items-center gap-6 rounded-lg border border-line bg-bg p-5">
        <ACheckbox id="isPublished" name="isPublished" label="Опубликована"
          defaultChecked={article?.isPublished ?? false} />
        <SubmitButton className="ml-auto">{isNew ? "Создать статью" : "Сохранить"}</SubmitButton>
      </div>
    </form>
  );
}
