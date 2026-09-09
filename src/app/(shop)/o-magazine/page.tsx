import type { Metadata } from "next";
import Link from "next/link";

import { InfoPage } from "@/components/shop/InfoPage";
import { SITE_NAME, TRADEMARK_DISCLAIMER } from "@/lib/constants";
import { getContent } from "@/server/repositories/settings";
import { pageCrumbs } from "@/server/seo/breadcrumbs";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "О магазине",
  description: `${SITE_NAME} — независимый магазин оригинальной обуви UGG® с доставкой по России.`,
  alternates: { canonical: "/o-magazine" },
};

export default function AboutPage() {
  const about = getContent().about;

  return (
    <InfoPage crumbs={pageCrumbs("О магазине")} title={about.title || "О магазине"}>
      {about.body ? (
        <div dangerouslySetInnerHTML={{ __html: about.body }} />
      ) : (
        <>
          <p>
            Мы — независимый магазин оригинальной обуви UGG®. Продаём то, что
            носим сами: классические угги на натуральной овчине, тапочки, ботинки
            и аксессуары бренда.
          </p>
          <p>
            Каждая пара — с документами на поставку и возвратом в течение 14 дней.
            Доставляем по всей России через СДЭК. Подробнее о том, откуда товар и как
            проверить подлинность, — на странице{" "}
            <Link href="/garantiya-podlinnosti">гарантии подлинности</Link>.
          </p>
        </>
      )}
      <p className="mt-10 text-xs text-muted">{TRADEMARK_DISCLAIMER}</p>
    </InfoPage>
  );
}
