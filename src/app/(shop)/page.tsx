import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { JsonLd } from "@/components/JsonLd";
import { Logo } from "@/components/Logo";
import { ProductCard } from "@/components/shop/ProductCard";
import { SECTIONS, SITE_DESCRIPTION, SITE_NAME } from "@/lib/constants";
import {
  getBestsellers,
  getCategoriesBySection,
  getNewArrivals,
  getProductsByCategory,
} from "@/server/repositories/catalog";
import { getContent } from "@/server/repositories/settings";
import { faqLd } from "@/server/seo/jsonld";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: { absolute: `${SITE_NAME} — угги с доставкой по России` },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
};

export default function HomePage() {
  const content = getContent();
  const bestsellers = getBestsellers(8);
  const arrivals = getNewArrivals(8);

  // Популярные категории — те, где есть товары; по три из каждого раздела.
  const popular = SECTIONS.flatMap((section) =>
    getCategoriesBySection(section.slug)
      .filter((category) => getProductsByCategory(category.id).length > 0)
      .slice(0, 3)
      .map((category) => ({ ...category, sectionTitle: section.title })),
  ).slice(0, 8);

  return (
    <>
      {content.faq.length > 0 && <JsonLd data={faqLd(content.faq)} />}

      {/* Герой во всю ширину */}
      <section className="container-page pt-6">
        <div className="relative flex min-h-[340px] flex-col justify-end overflow-hidden rounded-xl bg-sand p-8 md:min-h-[460px] md:p-12">
          {content.home.heroImage ? (
            <Image src={content.home.heroImage} alt="" fill sizes="100vw"
              className="object-cover" loading="eager" fetchPriority="high" />
          ) : (
            // Подложка занимает весь герой и оказывается самым крупным
            // элементом первого экрана — грузим её сразу, иначе она
            // портит LCP, а он учитывается в оценке скорости.
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.07]">
              <Logo width={760} href={null} eager />
            </div>
          )}
          <div className="relative max-w-xl">
            <h1 className="text-3xl font-bold leading-tight md:text-5xl">{content.home.heroTitle}</h1>
            {content.home.heroSubtitle && (
              <p className="mt-3 text-muted md:text-lg">{content.home.heroSubtitle}</p>
            )}
            <Link href="/catalog/zhenskie" className="mt-6 inline-flex h-12 items-center rounded-md bg-accent px-6 text-sm font-semibold text-white hover:bg-accent-hover">
              Смотреть коллекцию
            </Link>
          </div>
        </div>

        {/* Разделы — рядом под героем */}
        <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {SECTIONS.map((section) => (
            // Пропорция 3:4, а не фиксированная высота: плитки останутся
            // вертикальными на любой ширине экрана, и в них без переделки
            // встанут фотографии разделов, когда их загрузят.
            <Link key={section.slug} href={`/catalog/${section.slug}`}
              className="group flex aspect-[3/4] flex-col justify-end rounded-xl border border-line bg-bg p-5 transition hover:border-accent">
              <span className="text-lg font-semibold group-hover:text-accent">{section.title}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Преимущества */}
      <section className="container-page mt-10">
        {/* Пункты отцентрованы внутри своих колонок: при выравнивании по
            левому краю третий заканчивался на середине полосы, и справа
            оставалась пустота во весь экран. */}
        <ul className="grid gap-4 rounded-xl border border-line bg-sand px-4 py-5 text-center text-sm sm:grid-cols-3">
          <li><span className="font-semibold">Доставка по России</span><span className="block text-xs text-muted">СДЭК: пункт выдачи или курьер до двери</span></li>
          <li><span className="font-semibold">Обмен и возврат 14 дней</span><span className="block text-xs text-muted">Если не подошёл размер — поменяем</span></li>
          <li><span className="font-semibold">Натуральная овчина</span><span className="block text-xs text-muted">Тепло в мороз, не потеет в оттепель</span></li>
        </ul>
      </section>

      {bestsellers.length > 0 && (
        <ProductRow title="Хиты" href="/catalog" products={bestsellers} eager />
      )}

      {popular.length > 0 && (
        <section className="container-page mt-14">
          <h2 className="heading-section">Категории</h2>
          <ul className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            {popular.map((category) => (
              <li key={category.id}>
                <Link href={`/catalog/${category.sectionSlug}/${category.slug}`}
                  className="group block overflow-hidden rounded-lg border border-line transition hover:border-accent">
                  <div className="relative aspect-[4/3] bg-elevated">
                    {category.image && <Image src={category.image} alt="" fill sizes="25vw" className="object-cover" />}
                  </div>
                  <div className="p-3">
                    <span className="block text-sm font-medium group-hover:text-accent">{category.shortTitle ?? category.title}</span>
                    <span className="block text-xs text-muted">{category.sectionTitle}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {arrivals.length > 0 && (
        <ProductRow title="Новинки" href="/catalog" products={arrivals} />
      )}

      {content.faq.length > 0 && (
        <section className="container-page mt-14 max-w-3xl">
          <h2 className="heading-section">Частые вопросы</h2>
          <div className="mt-6 divide-y divide-line border-y border-line">
            {content.faq.map((item) => (
              <details key={item.question} className="group py-4">
                <summary className="cursor-pointer list-none font-medium">{item.question}</summary>
                <p className="mt-2 text-sm leading-relaxed text-muted">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function ProductRow({ title, href, products, eager = false }: {
  title: string; href: string; products: Parameters<typeof ProductCard>[0]["product"][]; eager?: boolean;
}) {
  return (
    <section className="container-page mt-14">
      <div className="flex items-baseline justify-between">
        <h2 className="heading-section">{title}</h2>
        <Link href={href} className="text-sm text-accent hover:underline">Все товары →</Link>
      </div>
      <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">
        {products.map((product, index) => (
          <li key={product.id}><ProductCard product={product} eager={eager && index < 4} /></li>
        ))}
      </ul>
    </section>
  );
}
