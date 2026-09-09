import type { Metadata } from "next";
import Link from "next/link";

import { InfoPage } from "@/components/shop/InfoPage";
import { TRADEMARK_DISCLAIMER } from "@/lib/constants";
import { getContent } from "@/server/repositories/settings";
import { pageCrumbs } from "@/server/seo/breadcrumbs";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Гарантия подлинности",
  description:
    "Только оригинальная обувь UGG®: откуда берётся товар, какие документы у нас есть " +
    "и как вы сами можете проверить подлинность.",
  alternates: { canonical: "/garantiya-podlinnosti" },
};

export default function AuthenticityPage() {
  const contacts = getContent().contacts;

  return (
    <InfoPage
      crumbs={pageCrumbs("Гарантия подлинности")}
      title="Гарантия подлинности"
      lead="Мы продаём только оригинальную обувь UGG® и готовы это подтвердить."
    >
      <h2>Откуда товар</h2>
      <p>
        Обувь закупается у поставщиков, работающих с продукцией UGG® напрямую. На
        каждую партию есть товарные и таможенные документы, а на обувь — декларация
        соответствия требованиям технического регламента ЕАЭС. Документы на конкретную
        пару предоставляем по запросу{contacts.email && <>: напишите на <a href={`mailto:${contacts.email}`}>{contacts.email}</a></>}.
      </p>

      <h2>Что вы получаете</h2>
      <ul>
        <li>Фирменную коробку с этикеткой производителя и артикулом модели.</li>
        <li>Защитную голографическую наклейку на левой полупаре.</li>
        <li>Чек и полный комплект документов на покупку.</li>
      </ul>

      <h2>Проверьте сами</h2>
      <p>
        Мы собрали признаки, по которым оригинал отличается от подделки, — от
        плотности овчины до маркировки подошвы. Читайте:{" "}
        <Link href="/kak-otlichit-original">как отличить оригинальные UGG</Link>.
      </p>

      <h2>Если сомневаетесь</h2>
      <p>
        Обувь можно вернуть в течение 14 дней без объяснения причин — в том числе
        если у вас остались вопросы к подлинности. Мы уверены в товаре и не ставим
        условий.
      </p>

      <p className="mt-10 text-xs text-muted">{TRADEMARK_DISCLAIMER}</p>
    </InfoPage>
  );
}
