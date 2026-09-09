"use server";

import { nanoid } from "nanoid";
import { redirect } from "next/navigation";

import { assertAdmin } from "@/server/admin/guard";
import {
  getCategoryById,
  getProductById,
} from "@/server/repositories/catalog";
import {
  cloneProduct,
  deleteCategory,
  deleteColor,
  deleteModelLine,
  deleteProduct,
  deleteSizeChart,
  isCategorySlugTaken,
  isProductSlugTaken,
  saveCategory,
  saveColor,
  saveModelLine,
  saveProduct,
  saveSizeChart,
} from "@/server/repositories/catalog-write";
import {
  revalidateCatalog,
  revalidateCategoryTree,
  revalidateProduct,
} from "@/server/seo/revalidate";
import {
  DENIED,
  fieldErrorsFrom,
  jsonField,
  listField,
  numberOrNull,
  stringOrNull,
  type ActionState,
} from "@/server/validation/errors";
import {
  categorySchema,
  colorSchema,
  modelLineSchema,
  productSchema,
  sizeChartSchema,
} from "@/server/validation/schemas";

/**
 * Действия админки для каталога.
 *
 * Каждое начинается с проверки прав: серверные действия доступны прямым
 * POST-запросом, и проверка в макете админки их не защищает.
 */

// ─── Товары ──────────────────────────────────────────────────────────────────

/** Поля с текстом из формы в объект для схемы. */
function readSeo(formData: FormData) {
  return {
    metaTitle: String(formData.get("seoMetaTitle") ?? ""),
    metaDescription: String(formData.get("seoMetaDescription") ?? ""),
    h1: String(formData.get("seoH1") ?? ""),
    seoText: String(formData.get("seoText") ?? ""),
    noindex: formData.get("seoNoindex") === "on",
  };
}

type VariantDraft = {
  id?: string;
  sizeEu: string | number;
  insoleCm?: string | number | null;
  stock: string | number;
  barcode?: string;
  markingCode?: string;
};

export async function saveProductAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await assertAdmin())) return DENIED;

  const existingId = stringOrNull(formData.get("id"));
  const id = existingId ?? nanoid(12);

  // Варианты приходят JSON-строкой: у формы динамический список размеров,
  // и собирать его из плоских полей по индексам было бы хрупко.
  const variants = jsonField<VariantDraft[]>(formData, "variants", []).map(
    (variant) => ({
      id: variant.id || nanoid(12),
      sizeEu: variant.sizeEu,
      insoleCm:
        variant.insoleCm === "" || variant.insoleCm == null
          ? null
          : variant.insoleCm,
      stock: variant.stock,
      barcode: variant.barcode ?? "",
      markingCode: variant.markingCode ?? "",
    }),
  );

  const parsed = productSchema.safeParse({
    id,
    slug: formData.get("slug"),
    title: formData.get("title"),
    sku: formData.get("sku") ?? "",
    description: formData.get("description") ?? "",
    gender: formData.get("gender"),
    modelLineId: stringOrNull(formData.get("modelLineId")),
    colorId: stringOrNull(formData.get("colorId")),
    categoryIds: jsonField<string[]>(formData, "categoryIds", []),
    primaryCategoryId: formData.get("primaryCategoryId"),
    groupId: stringOrNull(formData.get("groupId")),
    materials: jsonField<string[]>(formData, "materials", []),
    seasons: jsonField<string[]>(formData, "seasons", []),
    shaftHeightCm: numberOrNull(formData.get("shaftHeightCm")),
    heelHeightCm: numberOrNull(formData.get("heelHeightCm")),
    price: formData.get("price"),
    oldPrice: numberOrNull(formData.get("oldPrice")),
    images: jsonField<string[]>(formData, "images", []),
    variants,
    weight: formData.get("weight"),
    length: formData.get("length"),
    width: formData.get("width"),
    height: formData.get("height"),
    isPublished: formData.get("isPublished") === "on",
    isBestseller: formData.get("isBestseller") === "on",
    seo: readSeo(formData),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  if (isProductSlugTaken(parsed.data.slug, id)) {
    return { fieldErrors: { slug: "Такой адрес уже занят другим товаром" } };
  }

  const previous = existingId ? getProductById(existingId) : null;

  const product = saveProduct({
    ...parsed.data,
    sku: parsed.data.sku || null,
    seo: {
      ...parsed.data.seo,
      metaTitle: parsed.data.seo.metaTitle || undefined,
      metaDescription: parsed.data.seo.metaDescription || undefined,
      h1: parsed.data.seo.h1 || undefined,
      seoText: parsed.data.seo.seoText || undefined,
    },
  });

  revalidateProduct(product, previous?.slug);

  // Новый товар — на страницу редактирования: там появляются клонирование
  // и удаление, которых у несохранённой карточки быть не может.
  if (!existingId) redirect(`/admin/products/${product.id}?created=1`);

  return { success: "Сохранено" };
}

export async function deleteProductAction(formData: FormData): Promise<void> {
  if (!(await assertAdmin())) return;

  const id = String(formData.get("id") ?? "");
  const product = getProductById(id);
  if (!product) return;

  deleteProduct(id);
  revalidateProduct(product);
  redirect("/admin/products");
}

/** Клонирование под другой цвет — см. cloneProduct в хранилище. */
export async function cloneProductAction(formData: FormData): Promise<void> {
  if (!(await assertAdmin())) return;

  const copy = cloneProduct(String(formData.get("id") ?? ""));
  if (!copy) return;

  redirect(`/admin/products/${copy.id}?cloned=1`);
}

// ─── Категории ───────────────────────────────────────────────────────────────

export async function saveCategoryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await assertAdmin())) return DENIED;

  const existingId = stringOrNull(formData.get("id"));
  const id = existingId ?? nanoid(12);

  const parsed = categorySchema.safeParse({
    id,
    slug: formData.get("slug"),
    sectionSlug: formData.get("sectionSlug"),
    title: formData.get("title"),
    shortTitle: formData.get("shortTitle") ?? "",
    description: formData.get("description") ?? "",
    image: stringOrNull(formData.get("image")),
    order: formData.get("order") ?? 0,
    isPublished: formData.get("isPublished") === "on",
    aliases: listField(formData, "aliases"),
    seo: readSeo(formData),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  if (isCategorySlugTaken(parsed.data.sectionSlug, parsed.data.slug, id)) {
    return {
      fieldErrors: {
        slug: "Этот адрес в разделе уже занят категорией или её синонимом",
      },
    };
  }

  // Синоним не может совпадать с собственным адресом категории.
  const selfAlias = parsed.data.aliases.includes(parsed.data.slug);
  if (selfAlias) {
    return { fieldErrors: { aliases: "Синоним совпадает с адресом самой категории" } };
  }

  const category = saveCategory({
    ...parsed.data,
    shortTitle: parsed.data.shortTitle || undefined,
    seo: {
      ...parsed.data.seo,
      metaTitle: parsed.data.seo.metaTitle || undefined,
      metaDescription: parsed.data.seo.metaDescription || undefined,
      h1: parsed.data.seo.h1 || undefined,
      seoText: parsed.data.seo.seoText || undefined,
    },
  });

  revalidateCategoryTree(category);

  if (!existingId) redirect(`/admin/categories/${category.id}?created=1`);

  return { success: "Сохранено" };
}

export async function deleteCategoryAction(formData: FormData): Promise<void> {
  if (!(await assertAdmin())) return;

  const id = String(formData.get("id") ?? "");
  const category = getCategoryById(id);
  if (!category) return;

  deleteCategory(id);
  revalidateCategoryTree(category);
  redirect("/admin/categories");
}

// ─── Справочники ─────────────────────────────────────────────────────────────

export async function saveModelLineAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await assertAdmin())) return DENIED;

  const parsed = modelLineSchema.safeParse({
    id: stringOrNull(formData.get("id")) ?? nanoid(12),
    slug: formData.get("slug"),
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    genders: formData.getAll("genders"),
    sizeChartId: stringOrNull(formData.get("sizeChartId")),
    order: formData.get("order") ?? 0,
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  saveModelLine({
    ...parsed.data,
    id: stringOrNull(formData.get("id")) ?? undefined,
  });
  revalidateCatalog();

  return { success: "Сохранено" };
}

export async function deleteModelLineAction(formData: FormData): Promise<void> {
  if (!(await assertAdmin())) return;
  deleteModelLine(String(formData.get("id") ?? ""));
  revalidateCatalog();
}

export async function saveColorAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await assertAdmin())) return DENIED;

  const parsed = colorSchema.safeParse({
    id: stringOrNull(formData.get("id")) ?? nanoid(12),
    slug: formData.get("slug"),
    title: formData.get("title"),
    group: formData.get("group"),
    hex: formData.get("hex"),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  saveColor({ ...parsed.data, id: stringOrNull(formData.get("id")) ?? undefined });
  revalidateCatalog();

  return { success: "Сохранено" };
}

export async function deleteColorAction(formData: FormData): Promise<void> {
  if (!(await assertAdmin())) return;
  deleteColor(String(formData.get("id") ?? ""));
  revalidateCatalog();
}

export async function saveSizeChartAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await assertAdmin())) return DENIED;

  const parsed = sizeChartSchema.safeParse({
    id: stringOrNull(formData.get("id")) ?? nanoid(12),
    slug: formData.get("slug"),
    title: formData.get("title"),
    gender: formData.get("gender"),
    rows: jsonField(formData, "rows", []),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  saveSizeChart({
    ...parsed.data,
    id: stringOrNull(formData.get("id")) ?? undefined,
    rows: parsed.data.rows.map((row) => ({
      ...row,
      sizeUs: row.sizeUs || undefined,
      sizeUk: row.sizeUk || undefined,
    })),
  });
  revalidateCatalog();

  return { success: "Сохранено" };
}

export async function deleteSizeChartAction(formData: FormData): Promise<void> {
  if (!(await assertAdmin())) return;
  deleteSizeChart(String(formData.get("id") ?? ""));
  revalidateCatalog();
}
