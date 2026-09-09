import type { Metadata } from "next";

import { InfoPage } from "@/components/shop/InfoPage";
import { getContent } from "@/server/repositories/settings";
import { pageCrumbs } from "@/server/seo/breadcrumbs";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const filled = Boolean(getContent().legal.privacy);
  return {
    title: "Политика конфиденциальности",
    description: "Как магазин обрабатывает и защищает персональные данные покупателей.",
    alternates: { canonical: "/politika-konfidentsialnosti" },
    robots: filled ? { index: true, follow: true } : { index: false, follow: true },
  };
}

export default function PrivacyPage() {
  const text = getContent().legal.privacy;

  return (
    <InfoPage crumbs={pageCrumbs("Политика конфиденциальности")} title="Политика конфиденциальности">
      {text ? (
        <div dangerouslySetInnerHTML={{ __html: text }} />
      ) : (
        <p className="rounded-lg border border-line bg-sand p-5 text-muted">
          Документ готовится. Заполняется в панели управления, раздел «Тексты
          сайта». Политика обязательна по 152-ФЗ — до её публикации сайт не
          должен собирать персональные данные покупателей.
        </p>
      )}
    </InfoPage>
  );
}
