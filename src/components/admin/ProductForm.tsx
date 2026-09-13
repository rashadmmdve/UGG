"use client";

import { useActionState, useMemo, useState } from "react";

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
import { basePrice, salePrice } from "@/lib/pricing";
import { slugify } from "@/lib/utils";
import { saveProductAction } from "@/server/admin/actions/catalog";
import type { ActionState } from "@/server/validation/errors";
import type {
  Category,
  Color,
  Gender,
  Material,
  ModelLine,
  Product,
  Season,
  SizeChart,
} from "@/lib/types";

/**
 * Форма товара.
 *
 * Списки — размеры, фото, категории, материалы — живут в состоянии
 * компонента и уходят на сервер JSON-строками в скрытых полях. Плоские
 * поля формы для динамических списков не годятся: индексы съезжают при
 * удалении строки из середины.
 */

const GENDERS: { value: Gender; label: string }[] = [
  { value: "women", label: "Женские" },
  { value: "men", label: "Мужские" },
  { value: "kids", label: "Детские" },
  { value: "unisex", label: "Унисекс" },
];

const MATERIALS: { value: Material; label: string }[] = [
  { value: "ovchina", label: "Овчина" },
  { value: "zamsha", label: "Замша" },
  { value: "kozha", label: "Кожа" },
  { value: "vyazanyj", label: "Вязаный" },
  { value: "tekstil", label: "Текстиль" },
];

const SEASONS: { value: Season; label: string }[] = [
  { value: "winter", label: "Зима" },
  { value: "demi", label: "Демисезон" },
  { value: "summer", label: "Лето" },
  { value: "home", label: "Дом" },
];

type VariantRow = {
  key: number;
  id?: string;
  sizeEu: string;
  insoleCm: string;
  sizeUs: string;
  stock: string;
  barcode: string;
  markingCode: string;
};

let rowCounter = 0;
const nextKey = () => ++rowCounter;

/** Значения по умолчанию для новой карточки — типичная обувная коробка. */
const DEFAULTS = { weight: 900, length: 34, width: 23, height: 14 };

export function ProductForm({
  product,
  categories,
  modelLines,
  colors,
  sizeCharts,
}: {
  product: Product | null;
  categories: Category[];
  modelLines: ModelLine[];
  colors: Color[];
  sizeCharts: SizeChart[];
}) {
  const [state, action] = useActionState<ActionState, FormData>(
    saveProductAction,
    {},
  );

  const isNew = product === null;

  const [title, setTitle] = useState(product?.title ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!isNew);

  const [gender, setGender] = useState<Gender>(product?.gender ?? "women");
  const [modelLineId, setModelLineId] = useState(product?.modelLineId ?? "");
  const [categoryIds, setCategoryIds] = useState<string[]>(
    product?.categoryIds ?? [],
  );
  const [primaryCategoryId, setPrimaryCategoryId] = useState(
    product?.primaryCategoryId ?? "",
  );
  const [materials, setMaterials] = useState<Material[]>(product?.materials ?? []);
  const [seasons, setSeasons] = useState<Season[]>(product?.seasons ?? []);
  const [images, setImages] = useState<string[]>(product?.images ?? []);
  const [variants, setVariants] = useState<VariantRow[]>(
    (product?.variants ?? []).map((variant) => ({
      key: nextKey(),
      id: variant.id,
      sizeEu: String(variant.sizeEu),
      insoleCm: variant.insoleCm === null ? "" : String(variant.insoleCm),
      sizeUs: variant.sizeUs ?? "",
      stock: String(variant.stock),
      barcode: variant.barcode ?? "",
      markingCode: variant.markingCode ?? "",
    })),
  );

  /**
   * Размерная сетка для автозаполнения.
   *
   * Сначала — по полу товара: линия Classic продаётся и в женском, и в
   * мужском, и в детском размере, и одна сетка на линию тут не работает.
   * Привязка сетки к линии остаётся запасным вариантом для унисекса
   * и аксессуаров, у которых своей сетки нет.
   */
  const chart = useMemo(() => {
    const byGender = sizeCharts.find((item) => item.gender === gender);
    if (byGender) return byGender;
    const line = modelLines.find((item) => item.id === modelLineId);
    return line?.sizeChartId
      ? (sizeCharts.find((item) => item.id === line.sizeChartId) ?? null)
      : null;
  }, [gender, modelLineId, modelLines, sizeCharts]);

  function onTitleChange(value: string) {
    setTitle(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  function toggleCategory(id: string) {
    setCategoryIds((current) => {
      const next = current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id];
      // Основная категория должна быть среди выбранных.
      if (!next.includes(primaryCategoryId)) setPrimaryCategoryId(next[0] ?? "");
      return next;
    });
  }

  function toggle<T extends string>(list: T[], value: T, set: (next: T[]) => void) {
    set(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  }

  function updateVariant(key: number, patch: Partial<VariantRow>) {
    setVariants((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  function addVariant() {
    setVariants((current) => [
      ...current,
      { key: nextKey(), sizeEu: "", insoleCm: "", sizeUs: "", stock: "0", barcode: "", markingCode: "" },
    ]);
  }

  /**
   * Заполнить размеры по сетке модельной линии.
   *
   * Главный ускоритель при заведении тысячи карточек: вместо восьми
   * строк руками — одна кнопка. Уже существующие размеры не трогаются,
   * чтобы не потерять введённые остатки.
   */
  function fillFromChart() {
    if (!chart) return;
    const present = new Set(variants.map((row) => row.sizeEu));
    const added = chart.rows
      .filter((row) => !present.has(String(row.sizeEu)))
      .map((row) => ({
        key: nextKey(),
        sizeEu: String(row.sizeEu),
        insoleCm: String(row.insoleCm),
        sizeUs: row.sizeUs ?? "",
        stock: "0",
        barcode: "",
        markingCode: "",
      }));
    setVariants((current) =>
      [...current, ...added].sort((a, b) => Number(a.sizeEu) - Number(b.sizeEu)),
    );
  }

  const errors = state.fieldErrors ?? {};

  const categoriesBySection = SECTIONS.map((section) => ({
    section,
    items: categories.filter((category) => category.sectionSlug === section.slug),
  })).filter((group) => group.items.length > 0);

  return (
    <form action={action} className="space-y-8" noValidate>
      {product && <input type="hidden" name="id" value={product.id} />}
      <input type="hidden" name="categoryIds" value={JSON.stringify(categoryIds)} />
      <input type="hidden" name="materials" value={JSON.stringify(materials)} />
      <input type="hidden" name="seasons" value={JSON.stringify(seasons)} />
      <input type="hidden" name="images" value={JSON.stringify(images)} />
      <input
        type="hidden"
        name="variants"
        value={JSON.stringify(
          // Локальный ключ строки на сервер не уходит — он нужен только React.
          variants.map(({ id, sizeEu, insoleCm, sizeUs, stock, barcode, markingCode }) => ({
            id,
            sizeEu,
            insoleCm,
            sizeUs,
            stock,
            barcode,
            markingCode,
          })),
        )}
      />

      <FormMessage error={state.error} success={state.success} />

      {/* ── Основное ── */}
      <section className="rounded-lg border border-line bg-bg p-5">
        <h2 className="font-semibold">Основное</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <AField
            id="title"
            name="title"
            label="Название"
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            error={errors.title}
            className="md:col-span-2"
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
            error={errors.slug}
            hint={`/product/${slug || "…"} — после публикации менять не стоит`}
          />
          <AField
            id="sku"
            name="sku"
            label="Артикул"
            defaultValue={product?.sku ?? ""}
            error={errors.sku}
          />
          <ASelect
            id="gender"
            name="gender"
            label="Для кого"
            value={gender}
            onChange={(event) => setGender(event.target.value as Gender)}
            options={GENDERS}
            error={errors.gender}
          />
          <ASelect
            id="modelLineId"
            name="modelLineId"
            label="Модельная линия"
            value={modelLineId}
            onChange={(event) => setModelLineId(event.target.value)}
            placeholder="— не выбрана —"
            options={modelLines.map((line) => ({ value: line.id, label: line.title }))}
            error={errors.modelLineId}
          />
          <ASelect
            id="colorId"
            name="colorId"
            label="Цвет"
            defaultValue={product?.colorId ?? ""}
            placeholder="— не выбран —"
            options={colors.map((color) => ({
              value: color.id,
              label: `${color.title} (${color.group})`,
            }))}
            error={errors.colorId}
          />
          <AField
            id="groupId"
            name="groupId"
            label="Группа цветовых вариаций"
            defaultValue={product?.groupId ?? ""}
            hint="Одинаковая у всех цветов одной модели — так собирается блок «другие цвета»"
            error={errors.groupId}
          />
          <ATextarea
            id="description"
            name="description"
            label="Описание"
            defaultValue={product?.description ?? ""}
            rows={5}
            error={errors.description}
            className="md:col-span-2"
          />
          <ATextarea
            id="specs"
            name="specs"
            label="Характеристики (блок «Описание товара»)"
            defaultValue={(product?.specs ?? []).map((spec) => `${spec.label}: ${spec.value}`).join("\n")}
            rows={8}
            hint="По одной в строке: «Материал верха: Замша». Пусто — блок на витрине не показывается."
            error={errors.specs}
            className="md:col-span-2"
          />
        </div>
      </section>

      {/* ── Категории ── */}
      <section className="rounded-lg border border-line bg-bg p-5">
        <h2 className="font-semibold">Категории</h2>
        <p className="mt-1 text-xs text-muted">
          Отметьте все подходящие; одна из них — основная, она задаёт хлебные крошки.
        </p>
        {(errors.categoryIds || errors.primaryCategoryId) && (
          <p className="mt-2 text-xs text-danger">
            {errors.categoryIds ?? errors.primaryCategoryId}
          </p>
        )}
        <input type="hidden" name="primaryCategoryId" value={primaryCategoryId} />
        <div className="mt-4 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {categoriesBySection.map(({ section, items }) => (
            <div key={section.slug}>
              <p className="label-caps mb-2">{section.title}</p>
              <ul className="space-y-1">
                {items.map((category) => {
                  const checked = categoryIds.includes(category.id);
                  return (
                    <li key={category.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        id={`cat-${category.id}`}
                        checked={checked}
                        onChange={() => toggleCategory(category.id)}
                        className="h-4 w-4 accent-[var(--accent)]"
                      />
                      <label htmlFor={`cat-${category.id}`} className="flex-1">
                        {category.shortTitle ?? category.title}
                      </label>
                      {checked && (
                        <input
                          type="radio"
                          name="primary-choice"
                          title="Основная"
                          checked={primaryCategoryId === category.id}
                          onChange={() => setPrimaryCategoryId(category.id)}
                          className="accent-[var(--accent)]"
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ── Характеристики ── */}
      <section className="rounded-lg border border-line bg-bg p-5">
        <h2 className="font-semibold">Характеристики</h2>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <fieldset>
            <legend className="text-xs font-medium text-muted">Материалы</legend>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {MATERIALS.map((item) => (
                <ACheckbox
                  key={item.value}
                  id={`mat-${item.value}`}
                  label={item.label}
                  checked={materials.includes(item.value)}
                  onChange={() => toggle(materials, item.value, setMaterials)}
                />
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-xs font-medium text-muted">Сезон</legend>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {SEASONS.map((item) => (
                <ACheckbox
                  key={item.value}
                  id={`season-${item.value}`}
                  label={item.label}
                  checked={seasons.includes(item.value)}
                  onChange={() => toggle(seasons, item.value, setSeasons)}
                />
              ))}
            </div>
          </fieldset>
          <AField
            id="shaftHeightCm"
            name="shaftHeightCm"
            label="Высота голенища, см"
            type="number"
            step="0.5"
            defaultValue={product?.shaftHeightCm ?? ""}
            error={errors.shaftHeightCm}
          />
          <AField
            id="heelHeightCm"
            name="heelHeightCm"
            label="Высота каблука, см"
            type="number"
            step="0.5"
            defaultValue={product?.heelHeightCm ?? ""}
            error={errors.heelHeightCm}
          />
        </div>
      </section>

      {/* ── Цена ── */}
      <section className="rounded-lg border border-line bg-bg p-5">
        <h2 className="font-semibold">Цена</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {/*
            Владелец задаёт цену и, если надо, цену со скидкой. В базе это
            продажная цена и цена до скидки — пересчёт в действии сохранения.
          */}
          <AField
            id="price"
            name="price"
            label="Цена, ₽"
            type="number"
            min={0}
            defaultValue={product ? basePrice(product) : ""}
            error={errors.price}
          />
          <AField
            id="salePrice"
            name="salePrice"
            label="Цена со скидкой, ₽"
            type="number"
            min={0}
            defaultValue={product ? (salePrice(product) ?? "") : ""}
            hint="Пусто — действует обычная цена. Заполнена — продаём по ней, обычная перечёркнута"
            error={errors.salePrice}
          />
          <AField
            id="costPrice"
            name="costPrice"
            label="Себестоимость, ₽"
            type="number"
            min={0}
            defaultValue={product?.costPrice ?? ""}
            hint="Закупочная. На сайте не показывается"
            error={errors.costPrice}
          />
        </div>
      </section>

      {/* ── Размеры ── */}
      <section className="rounded-lg border border-line bg-bg p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Размеры и остатки</h2>
          <div className="flex gap-2">
            {chart && (
              <button
                type="button"
                onClick={fillFromChart}
                className="rounded border border-line px-3 py-1.5 text-sm hover:border-accent"
              >
                Заполнить по сетке «{chart.title}»
              </button>
            )}
            <button
              type="button"
              onClick={addVariant}
              className="rounded border border-line px-3 py-1.5 text-sm hover:border-accent"
            >
              + Размер
            </button>
          </div>
        </div>
        {errors.variants && <p className="mt-2 text-xs text-danger">{errors.variants}</p>}

        {variants.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            Размеров пока нет. Выберите модельную линию и заполните по сетке,
            либо добавьте вручную.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="pb-2 pr-3 font-normal">EU</th>
                  <th className="pb-2 pr-3 font-normal">Стелька, см</th>
                  <th className="pb-2 pr-3 font-normal">US</th>
                  <th className="pb-2 pr-3 font-normal">Остаток</th>
                  <th className="pb-2 pr-3 font-normal">Штрихкод</th>
                  <th className="pb-2 pr-3 font-normal">Код маркировки</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {variants.map((row) => (
                  <tr key={row.key} className="border-t border-line">
                    <td className="py-1.5 pr-3">
                      <input
                        type="number"
                        step="0.5"
                        value={row.sizeEu}
                        onChange={(e) => updateVariant(row.key, { sizeEu: e.target.value })}
                        className="w-20 rounded border border-line px-2 py-1"
                        aria-label="Размер EU"
                      />
                    </td>
                    <td className="py-1.5 pr-3">
                      <input
                        type="number"
                        step="0.5"
                        value={row.insoleCm}
                        onChange={(e) => updateVariant(row.key, { insoleCm: e.target.value })}
                        className="w-24 rounded border border-line px-2 py-1"
                        aria-label="Длина стельки"
                      />
                    </td>
                    <td className="py-1.5 pr-3">
                      <input
                        value={row.sizeUs}
                        onChange={(e) => updateVariant(row.key, { sizeUs: e.target.value })}
                        className="w-16 rounded border border-line px-2 py-1"
                        aria-label="Размер US"
                        placeholder="5"
                      />
                    </td>
                    <td className="py-1.5 pr-3">
                      <input
                        type="number"
                        min={0}
                        value={row.stock}
                        onChange={(e) => updateVariant(row.key, { stock: e.target.value })}
                        className="w-20 rounded border border-line px-2 py-1"
                        aria-label="Остаток"
                      />
                    </td>
                    <td className="py-1.5 pr-3">
                      <input
                        value={row.barcode}
                        onChange={(e) => updateVariant(row.key, { barcode: e.target.value })}
                        className="w-36 rounded border border-line px-2 py-1"
                        aria-label="Штрихкод"
                      />
                    </td>
                    <td className="py-1.5 pr-3">
                      <input
                        value={row.markingCode}
                        onChange={(e) => updateVariant(row.key, { markingCode: e.target.value })}
                        className="w-44 rounded border border-line px-2 py-1"
                        aria-label="Код маркировки"
                        placeholder="Честный ЗНАК"
                      />
                    </td>
                    <td className="py-1.5 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          setVariants((current) => current.filter((r) => r.key !== row.key))
                        }
                        className="text-muted hover:text-danger"
                        aria-label="Удалить размер"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Фото ── */}
      <section className="rounded-lg border border-line bg-bg p-5">
        <h2 className="font-semibold">Фотографии</h2>
        <div className="mt-4">
          <ImageUploader value={images} onChange={setImages} />
        </div>
      </section>

      {/* ── Доставка ── */}
      <section className="rounded-lg border border-line bg-bg p-5">
        <h2 className="font-semibold">Упаковка для расчёта доставки</h2>
        <p className="mt-1 text-xs text-muted">
          Вес в граммах и габариты коробки в сантиметрах. По ним СДЭК считает стоимость.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <AField id="weight" name="weight" label="Вес, г" type="number" min={1}
            defaultValue={product?.weight ?? DEFAULTS.weight} error={errors.weight} />
          <AField id="length" name="length" label="Длина, см" type="number" min={1}
            defaultValue={product?.length ?? DEFAULTS.length} error={errors.length} />
          <AField id="width" name="width" label="Ширина, см" type="number" min={1}
            defaultValue={product?.width ?? DEFAULTS.width} error={errors.width} />
          <AField id="height" name="height" label="Высота, см" type="number" min={1}
            defaultValue={product?.height ?? DEFAULTS.height} error={errors.height} />
        </div>
      </section>

      {/* ── SEO ── */}
      <details className="rounded-lg border border-line bg-bg p-5">
        <summary className="cursor-pointer font-semibold">
          SEO <span className="ml-2 text-xs font-normal text-muted">необязательно — иначе сработают шаблоны</span>
        </summary>
        <div className="mt-4 grid gap-4">
          <AField id="seoMetaTitle" name="seoMetaTitle" label="Заголовок страницы (title)"
            defaultValue={product?.seo.metaTitle ?? ""} maxLength={120} />
          <ATextarea id="seoMetaDescription" name="seoMetaDescription" label="Описание (description)"
            defaultValue={product?.seo.metaDescription ?? ""} rows={2} maxLength={320} />
          <AField id="seoH1" name="seoH1" label="Заголовок H1"
            defaultValue={product?.seo.h1 ?? ""} maxLength={160} />
          <ACheckbox id="seoNoindex" name="seoNoindex" label="Закрыть от индексации"
            defaultChecked={product?.seo.noindex ?? false} />
        </div>
      </details>

      {/* ── Публикация ── */}
      <div className="flex flex-wrap items-center gap-6 rounded-lg border border-line bg-bg p-5">
        <ACheckbox id="isPublished" name="isPublished" label="Опубликован"
          defaultChecked={product?.isPublished ?? false} />
        <ACheckbox id="isBestseller" name="isBestseller" label="Показывать в хитах на главной"
          defaultChecked={product?.isBestseller ?? false} />
        <ACheckbox id="isNew" name="isNew" label="Показывать в новинках"
          defaultChecked={product?.isNew ?? false} />
        {/*
          Раздел «Распродажа» собирается вручную этой галочкой, а не по
          наличию старой цены: скидка бывает и вне распродажи.
        */}
        <ACheckbox id="isSale" name="isSale" label="В распродаже"
          defaultChecked={product?.isSale ?? false} />
        <SubmitButton className="ml-auto">
          {isNew ? "Создать товар" : "Сохранить"}
        </SubmitButton>
      </div>
    </form>
  );
}
