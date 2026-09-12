"use server";

import { CATALOG_TILES } from "@/lib/constants";
import { assertAdmin } from "@/server/admin/guard";
import {
  getContent,
  saveContent,
  saveLogistics,
  type SiteContent,
} from "@/server/repositories/settings";
import { revalidateContent } from "@/server/seo/revalidate";
import {
  DENIED,
  fieldErrorsFrom,
  jsonField,
  type ActionState,
} from "@/server/validation/errors";
import { logisticsSchema } from "@/server/validation/schemas";

export async function saveLogisticsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await assertAdmin())) return DENIED;

  const parsed = logisticsSchema.safeParse({
    fromCityCode: formData.get("fromCityCode"),
    fromCity: formData.get("fromCity"),
    shipmentPointCode: formData.get("shipmentPointCode") ?? "",
    shipmentPointAddress: formData.get("shipmentPointAddress") ?? "",
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  saveLogistics(parsed.data);
  // Стоимость доставки считается от города отправления — она попадает
  // в разметку карточек, поэтому сбрасываем всё.
  revalidateContent();

  return { success: "Сохранено. Новые расчёты доставки пойдут из этого города." };
}

const text = (formData: FormData, key: string) =>
  String(formData.get(key) ?? "").trim();

export async function saveContentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await assertAdmin())) return DENIED;

  const fieldErrors: Record<string, string> = {};

  const email = text(formData, "email");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fieldErrors.email = "Проверьте формат почты";
  }

  const faq = jsonField<{ question: string; answer: string }[]>(formData, "faq", [])
    .map((item) => ({ question: item.question.trim(), answer: item.answer.trim() }))
    .filter((item) => item.question || item.answer);
  if (faq.some((item) => !item.question || !item.answer)) {
    fieldErrors.faq = "У каждого вопроса должен быть ответ";
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const heroImages = jsonField<string[]>(formData, "heroImages", []).filter(Boolean);
  const heroMobileImages = jsonField<string[]>(formData, "heroMobileImages", []).filter(Boolean);
  const current = getContent();

  const content: SiteContent = {
    home: {
      heroTitle: text(formData, "heroTitle") || current.home.heroTitle,
      heroSubtitle: text(formData, "heroSubtitle"),
      heroImages,
      heroMobileImages,
      heroRotate: formData.get("heroRotate") === "on",
    },
    sectionImages: Object.fromEntries(
      CATALOG_TILES.map((section) => [section.slug, text(formData, `sectionImage_${section.slug}`) || null]),
    ),
    // Пустое поле означает «как в коде», поэтому пустые значения не храним.
    sectionTitles: Object.fromEntries(
      CATALOG_TILES.map((section) => [section.slug, text(formData, `sectionTitle_${section.slug}`)]).filter(
        ([, title]) => title,
      ),
    ),
    about: {
      title: text(formData, "aboutTitle") || current.about.title,
      body: text(formData, "aboutBody"),
    },
    contacts: {
      phone: text(formData, "phone"),
      email,
      address: text(formData, "address"),
    },
    faq,
    legal: {
      oferta: text(formData, "legalOferta"),
      privacy: text(formData, "legalPrivacy"),
    },
  };

  saveContent(content);
  revalidateContent();

  return { success: "Сохранено" };
}
