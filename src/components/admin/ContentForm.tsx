"use client";

import { useActionState, useState } from "react";

import { ImageUploader } from "@/components/admin/ImageUploader";
import { AField, ATextarea, FormMessage, SubmitButton } from "@/components/admin/ui";
import { CATALOG_TILES } from "@/lib/constants";
import { saveContentAction } from "@/server/admin/actions/settings";
import type { SiteContent } from "@/server/repositories/settings";
import type { ActionState } from "@/server/validation/errors";

type FaqRow = { key: number; question: string; answer: string };
let counter = 0;

export function ContentForm({ content }: { content: SiteContent }) {
  const [state, action] = useActionState<ActionState, FormData>(saveContentAction, {});
  const errors = state.fieldErrors ?? {};

  const [hero, setHero] = useState<string[]>(content.home.heroImage ? [content.home.heroImage] : []);
  const [sectionImages, setSectionImages] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      CATALOG_TILES.map((section) => [section.slug, content.sectionImages?.[section.slug] ?? ""]),
    ),
  );
  const [faq, setFaq] = useState<FaqRow[]>(
    content.faq.map((item) => ({ key: ++counter, ...item })),
  );

  function updateFaq(key: number, patch: Partial<FaqRow>) {
    setFaq((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  return (
    <form action={action} className="space-y-8" noValidate>
      <input type="hidden" name="heroImage" value={hero[0] ?? ""} />
      {CATALOG_TILES.map((section) => (
        <input
          key={section.slug}
          type="hidden"
          name={`sectionImage_${section.slug}`}
          value={sectionImages[section.slug] ?? ""}
        />
      ))}
      <input
        type="hidden"
        name="faq"
        value={JSON.stringify(faq.map(({ question, answer }) => ({ question, answer })))}
      />

      <FormMessage error={state.error} success={state.success} />

      <section className="rounded-lg border border-line bg-bg p-5">
        <h2 className="font-semibold">Главная страница</h2>
        <div className="mt-4 grid gap-4">
          <AField id="heroTitle" name="heroTitle" label="Заголовок"
            defaultValue={content.home.heroTitle} error={errors.heroTitle} />
          <AField id="heroSubtitle" name="heroSubtitle" label="Подзаголовок"
            defaultValue={content.home.heroSubtitle} error={errors.heroSubtitle} />
          <div>
            <p className="text-xs font-medium text-muted">Фото в шапке</p>
            <div className="mt-2">
              <ImageUploader value={hero} onChange={(urls) => setHero(urls.slice(-1))} />
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-muted">Фото разделов</p>
            <p className="mt-1 text-xs text-muted">
              Плитки под шапкой. Пропорция вертикальная, 3:4 — снимок обрежется
              по центру. Без фото плитка остаётся с одним названием.
            </p>
            <div className="mt-2 grid gap-4 sm:grid-cols-2">
              {CATALOG_TILES.map((section) => (
                <div key={section.slug}>
                  <p className="mb-1.5 text-xs text-muted">{section.title}</p>
                  <ImageUploader
                    value={sectionImages[section.slug] ? [sectionImages[section.slug]] : []}
                    onChange={(urls) =>
                      setSectionImages((current) => ({ ...current, [section.slug]: urls.at(-1) ?? "" }))
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-bg p-5">
        <h2 className="font-semibold">Контакты и реквизиты</h2>
        <p className="mt-1 text-xs text-muted">
          Выводятся в подвале и на странице контактов. Реквизиты нужны и по закону,
          и для доверия: Яндекс учитывает их наличие как коммерческий фактор.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <AField id="phone" name="phone" label="Телефон" defaultValue={content.contacts.phone}
            placeholder="+7 (999) 000-00-00" error={errors.phone} />
          <AField id="email" name="email" label="Почта" type="email"
            defaultValue={content.contacts.email} error={errors.email} />
          <AField id="address" name="address" label="Адрес" defaultValue={content.contacts.address}
            error={errors.address} className="md:col-span-2" />
          <AField id="legalName" name="legalName" label="Юридическое лицо или ИП"
            defaultValue={content.contacts.legalName} error={errors.legalName} className="md:col-span-2" />
          <AField id="inn" name="inn" label="ИНН" defaultValue={content.contacts.inn}
            inputMode="numeric" error={errors.inn} />
          <AField id="ogrn" name="ogrn" label="ОГРН / ОГРНИП" defaultValue={content.contacts.ogrn}
            inputMode="numeric" error={errors.ogrn} />
        </div>
      </section>

      <section className="rounded-lg border border-line bg-bg p-5">
        <h2 className="font-semibold">О магазине</h2>
        <div className="mt-4 grid gap-4">
          <AField id="aboutTitle" name="aboutTitle" label="Заголовок"
            defaultValue={content.about.title} error={errors.aboutTitle} />
          <ATextarea id="aboutBody" name="aboutBody" label="Текст"
            defaultValue={content.about.body} rows={10}
            hint="HTML-разметка: <h2>, <p>, <ul>" error={errors.aboutBody} />
        </div>
      </section>

      <section className="rounded-lg border border-line bg-bg p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Частые вопросы</h2>
            <p className="mt-1 text-xs text-muted">Выводятся на главной с разметкой FAQPage.</p>
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
              <input value={row.question} aria-label="Вопрос" placeholder="Вопрос"
                onChange={(e) => updateFaq(row.key, { question: e.target.value })}
                className="w-full rounded border border-line px-3 py-2 text-sm font-medium" />
              <textarea value={row.answer} aria-label="Ответ" placeholder="Ответ" rows={3}
                onChange={(e) => updateFaq(row.key, { answer: e.target.value })}
                className="mt-2 w-full rounded border border-line px-3 py-2 text-sm" />
              <button type="button" className="mt-2 text-xs text-muted hover:text-danger"
                onClick={() => setFaq((rows) => rows.filter((r) => r.key !== row.key))}>
                Удалить вопрос
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-line bg-bg p-5">
        <h2 className="font-semibold">Юридические документы</h2>
        <p className="mt-1 text-xs text-muted">
          Пока поле пустое, страница закрыта от индексации и показывает заглушку.
          Тексты согласуйте с юристом: оферта — это договор с покупателем,
          политика — требование 152-ФЗ.
        </p>
        <div className="mt-4 grid gap-4">
          <ATextarea id="legalOferta" name="legalOferta" label="Публичная оферта"
            defaultValue={content.legal.oferta} rows={12} hint="HTML-разметка: <h2>, <p>, <ol>" />
          <ATextarea id="legalPrivacy" name="legalPrivacy" label="Политика конфиденциальности"
            defaultValue={content.legal.privacy} rows={12} hint="HTML-разметка: <h2>, <p>, <ol>" />
        </div>
      </section>

      <div className="flex justify-end">
        <SubmitButton>Сохранить</SubmitButton>
      </div>
    </form>
  );
}
