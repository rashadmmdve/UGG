import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { JsonLd } from "@/components/JsonLd";
import { ProductCard } from "@/components/shop/ProductCard";
import { SECTIONS, SITE_DESCRIPTION, SITE_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { getBestsellers, getNewArrivals } from "@/server/repositories/catalog";
import { getContent } from "@/server/repositories/settings";
import { faqLd } from "@/server/seo/jsonld";
import type { Product } from "@/lib/types";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: { absolute: `${SITE_NAME} — угги с доставкой по России` },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
};

/**
 * Мозаика разделов: два ряда по два блока с разной шириной.
 * Порядок и пропорции взяты из макета — женские и детские шире соседей,
 * подпись прижата к нижнему краю кадра.
 */
const TILES: {
  slug: string;
  span: string;
  align: "left" | "right";
  height: string;
}[] = [
  { slug: "zhenskie", span: "md:col-span-7", align: "left", height: "h-56 md:h-72" },
  { slug: "muzhskie", span: "md:col-span-5", align: "right", height: "h-56 md:h-72" },
  { slug: "aksessuary", span: "md:col-span-5", align: "left", height: "h-56 md:h-64" },
  { slug: "detskie", span: "md:col-span-7", align: "left", height: "h-56 md:h-64" },
];

export default function HomePage() {
  const content = getContent();
  const bestsellers = getBestsellers(8);
  const arrivals = getNewArrivals(8);

  return (
    <>
      {content.faq.length > 0 && <JsonLd data={faqLd(content.faq)} />}

      {/* ── Первый блок ── */}
      <section className="container-page pt-5">
        <div className="relative flex min-h-[300px] flex-col justify-between overflow-hidden rounded-lg border border-fg p-6 md:min-h-[380px] md:p-10">
          {content.home.heroImage && (
            <Image
              src={content.home.heroImage}
              alt=""
              fill
              sizes="100vw"
              className="object-cover"
              loading="eager"
              fetchPriority="high"
            />
          )}

          <div className="relative flex flex-1 items-center justify-center">
            <h1 className="max-w-2xl text-center text-3xl leading-tight font-semibold tracking-tight md:text-5xl">
              {content.home.heroTitle}
            </h1>
          </div>

          <div className="relative">
            {content.home.heroSubtitle && (
              <p className="mb-4 max-w-md text-sm text-muted">{content.home.heroSubtitle}</p>
            )}
            <Link
              href="/catalog/zhenskie"
              className="inline-flex h-12 items-center justify-center border border-fg px-8 text-xs tracking-[0.12em] uppercase transition-colors hover:bg-fg hover:text-bg"
            >
              Смотреть коллекцию
            </Link>
          </div>
        </div>
      </section>

      {/* ── Категория товаров ── */}
      <section className="container-page mt-10">
        <h2 className="label-caps">Категория товаров</h2>

        <div className="mt-3 grid gap-4 md:grid-cols-12">
          {TILES.map((tile) => {
            const section = SECTIONS.find((item) => item.slug === tile.slug);
            if (!section) return null;

            return (
              <Link
                key={tile.slug}
                href={`/catalog/${tile.slug}`}
                className={cn(
                  "group relative flex overflow-hidden rounded-lg border border-fg transition-colors hover:bg-elevated",
                  tile.span,
                  tile.height,
                  tile.align === "right" ? "items-end justify-end" : "items-end justify-start",
                )}
              >
                <span className="p-5 text-lg tracking-wide uppercase md:text-xl">
                  {section.title}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {bestsellers.length > 0 && <ProductRow title="Хиты" products={bestsellers} eager />}
      {arrivals.length > 0 && <ProductRow title="Новинки" products={arrivals} />}

      {content.faq.length > 0 && (
        <section className="container-page mt-14 max-w-3xl">
          <h2 className="heading-section">Частые вопросы</h2>
          <div className="mt-6 divide-y divide-line border-y border-line">
            {content.faq.map((item) => (
              <details key={item.question} className="py-4">
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

function ProductRow({
  title,
  products,
  eager = false,
}: {
  title: string;
  products: Product[];
  eager?: boolean;
}) {
  return (
    <section className="container-page mt-14">
      <div className="flex items-baseline justify-between">
        <h2 className="heading-section">{title}</h2>
        <Link href="/catalog" className="text-sm underline underline-offset-4 hover:text-muted">
          Все товары
        </Link>
      </div>
      <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">
        {products.map((product, index) => (
          <li key={product.id}>
            <ProductCard product={product} eager={eager && index < 4} />
          </li>
        ))}
      </ul>
    </section>
  );
}
