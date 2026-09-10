import type { Metadata } from "next";
import Link from "next/link";

import { InfoPage } from "@/components/shop/InfoPage";
import { SITE_NAME } from "@/lib/constants";
import { getContent } from "@/server/repositories/settings";
import { pageCrumbs } from "@/server/seo/breadcrumbs";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "О магазине",
  description: `${SITE_NAME} — независимый интернет-магазин обуви UGG® с доставкой по России.`,
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
            Мы — независимый интернет-магазин обуви UGG®. Продаём то, что
            носим сами: классические угги на натуральной овчине, тапочки, ботинки
            и аксессуары бренда.
          </p>
          <p>
            Доставляем по всей России через СДЭК: до пункта выдачи или курьером
            до двери. Если размер не подошёл — обменяем или вернём деньги в
            течение 14 дней, подробности на странице{" "}
            <Link href="/obmen-i-vozvrat">обмена и возврата</Link>.
          </p>
        </>
      )}
    </InfoPage>
  );
}
