"use client";

import { useActionState, useState } from "react";

import { ImageUploader } from "@/components/admin/ImageUploader";
import { ACheckbox, AField, ATextarea, FormMessage, SubmitButton } from "@/components/admin/ui";
import { CATALOG_TILES } from "@/lib/constants";
import { saveContentAction } from "@/server/admin/actions/settings";
import type { SiteContent } from "@/server/repositories/settings";
import type { ActionState } from "@/server/validation/errors";

type FaqRow = { key: number; question: string; answer: string };
let counter = 0;

export function ContentForm({ content }: { content: SiteContent }) {
  const [state, action] = useActionState<ActionState, FormData>(saveContentAction, {});
  const errors = state.fieldErrors ?? {};

  const [hero, setHero] = useState<string[]>(content.home.heroImages);
  const [heroMobile, setHeroMobile] = useState<string[]>(content.home.heroMobileImages);
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
      <input type="hidden" name="heroImages" value={JSON.stringify(hero)} />
      <input type="hidden" name="heroMobileImages" value={JSON.stringify(heroMobile)} />
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
            <p className="text-xs font-medium text-muted">Баннеры в шапке</p>
            <p className="mt-1 text-xs text-muted">
              Горизонтальные, примерно 2:1 — например 2400×1200. JPG, PNG или
              WebP, до 12 МБ; сожмутся сами. Снимок вписывается целиком и
              встаёт по центру, поэтому важное не обрежется. Порядок — стрелками
              на карточке, первый показывается сразу. Без баннера в шапке
              остаётся бледный логотип.
            </p>
            <div className="mt-2">
              <ImageUploader value={hero} onChange={setHero} aspect="wide" />
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-muted">Баннеры для телефона</p>
            <p className="mt-1 text-xs text-muted">
              Вертикальные, 4:5 — например 1200×1500. Показываются только на
              телефоне, заголовок и кнопка ложатся поверх фото, поэтому низ
              кадра лучше оставить спокойным. Без них на телефоне идёт обычный
              баннер, а текст — под ним.
            </p>
            <div className="mt-2">
              <ImageUploader value={heroMobile} onChange={setHeroMobile} aspect="portrait" />
            </div>
            {(hero.length > 1 || heroMobile.length > 1) && (
              <div className="mt-3">
                <ACheckbox id="heroRotate" name="heroRotate" label="Листать баннеры автоматически"
                  defaultChecked={content.home.heroRotate} />
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-medium text-muted">Разделы каталога</p>
            <p className="mt-1 text-xs text-muted">
              Плитки под шапкой и пункты меню. Название меняется свободно,
              адрес страницы остаётся прежним. Пустое поле — плитка на главной
              без подписи (когда слово уже на снимке); в меню и на странице
              раздела остаётся название по умолчанию. Плитка вертикальная,
              3:4 — снимок вписывается по центру,
              подойдёт кадр вроде 900×1200.
            </p>
            <div className="mt-3 grid gap-5 sm:grid-cols-2">
              {CATALOG_TILES.map((section) => (
                <div key={section.slug} className="rounded border border-line p-3">
                  <AField
                    id={`sectionTitle-${section.slug}`}
                    name={`sectionTitle_${section.slug}`}
                    label="Название"
                    defaultValue={content.sectionTitles?.[section.slug] ?? ""}
                    placeholder={section.title}
                    hint={`Адрес: /catalog/${section.slug}`}
                  />
                  <div className="mt-3">
                    <ImageUploader
                      aspect="tall"
                      value={sectionImages[section.slug] ? [sectionImages[section.slug]] : []}
                      onChange={(urls) =>
                        setSectionImages((current) => ({ ...current, [section.slug]: urls.at(-1) ?? "" }))
                      }
                    />
                  </div>
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
