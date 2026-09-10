import type { Metadata } from "next";

import { InfoPage } from "@/components/shop/InfoPage";
import { getContent, isLegalReady } from "@/server/repositories/settings";
import { pageCrumbs } from "@/server/seo/breadcrumbs";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const filled = isLegalReady(getContent().legal.oferta);
  return {
    title: "Публичная оферта",
    description: "Условия продажи товаров в интернет-магазине.",
    alternates: { canonical: "/oferta" },
    // Незаполненный документ индексировать нельзя.
    robots: filled ? { index: true, follow: true } : { index: false, follow: true },
  };
}

export default function OfferPage() {
  const text = getContent().legal.oferta;

  return (
    <InfoPage crumbs={pageCrumbs("Публичная оферта")} title="Публичная оферта">
      {text ? (
        <div dangerouslySetInnerHTML={{ __html: text }} />
      ) : (
        <p className="rounded-lg border border-line bg-sand p-5 text-muted">
          Текст оферты готовится. Заполняется в панели управления, раздел
          «Тексты сайта» — после согласования с юристом.
        </p>
      )}
    </InfoPage>
  );
}
