import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { JsonLd } from "@/components/JsonLd";
import { Logo } from "@/components/Logo";
import { HeroCarousel } from "@/components/shop/HeroCarousel";
import { ProductCard } from "@/components/shop/ProductCard";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/constants";
import { homeTiles } from "@/server/catalog/sections";
import { cn } from "@/lib/utils";
import { getBestsellers, getNewArrivals } from "@/server/repositories/catalog";
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

  const tiles = homeTiles();
  const hasBanner = content.home.heroImages.length > 0;
  const hasMobileBanner = content.home.heroMobileImages.length > 0;

  // Заголовок, подзаголовок и кнопка героя: на телефоне с баннером
  // они рисуются под фото, на широком экране — поверх. Одна функция на
  // оба места, чтобы тексты не разъехались. Поверх фото текст белый:
  // на снимке тёмный не читается; под фото и на подложке — обычный.
  const heroText = (onBanner: boolean) => (
    <>
      <h1 className={cn("text-3xl font-bold leading-tight md:text-5xl", onBanner && "text-white")}>
        {content.home.heroTitle}
      </h1>
      {content.home.heroSubtitle && (
        <p className={cn("mt-3 md:text-lg", onBanner ? "text-white/85" : "text-muted")}>
          {content.home.heroSubtitle}
        </p>
      )}
      <Link href="/catalog/zhenskie" className="mt-6 inline-flex h-12 items-center rounded-md bg-accent px-6 text-sm font-semibold text-white hover:bg-accent-hover">
        Смотреть коллекцию
      </Link>
    </>
  );

  // Без баннера: бледный логотип на подложке и обычный текст. Подложка
  // занимает весь герой и оказывается самым крупным элементом первого
  // экрана — грузим её сразу, иначе она портит LCP.
  const heroPlaceholder = (
    <div className="relative flex min-h-[440px] flex-col justify-end overflow-hidden rounded-b-xl bg-sand p-8 md:min-h-[620px] md:p-12">
      <div className="absolute inset-0 flex items-center justify-center opacity-[0.07]">
        <Logo width={1000} href={null} eager />
      </div>
      <div className="relative max-w-xl">{heroText(false)}</div>
    </div>
  );

  return (
    <>
      {content.faq.length > 0 && <JsonLd data={faqLd(content.faq)} />}

      {/*
        Герой. Телефон и широкий экран — два разных блока, виден один.
        На широком экране блок 2:1 под горизонтальный баннер, текст поверх.
        На телефоне 2:1 слишком низкий, чтобы уместить заголовок с кнопкой,
        поэтому там свой вертикальный кадр 4:5 с текстом поверх; если его
        не загрузили — обычный баннер и текст под ним. Кадр вписывается
        целиком и не обрезается (см. ProductCard). Скрытой карусели через
        sizes достаётся самая маленькая версия картинки.
      */}
      <section className="container-page">
        {/* Телефон */}
        <div className="md:hidden">
          {hasMobileBanner ? (
            <div className="relative aspect-[4/5] overflow-hidden rounded-b-xl bg-sand">
              <HeroCarousel
                images={content.home.heroMobileImages}
                rotate={content.home.heroRotate}
                sizes="(min-width: 768px) 16px, 100vw"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/25 to-transparent px-6 pb-8 pt-20">
                {heroText(true)}
              </div>
            </div>
          ) : hasBanner ? (
            <>
              <div className="relative aspect-[2/1] overflow-hidden rounded-b-xl bg-sand">
                <HeroCarousel
                  images={content.home.heroImages}
                  rotate={content.home.heroRotate}
                  sizes="(min-width: 768px) 16px, 100vw"
                />
              </div>
              <div className="mt-6 max-w-xl">{heroText(false)}</div>
            </>
          ) : (
            heroPlaceholder
          )}
        </div>

        {/* Широкий экран */}
        <div className="hidden md:block">
          {hasBanner ? (
            <div className="relative aspect-[2/1] overflow-hidden rounded-b-xl bg-sand">
              <HeroCarousel
                images={content.home.heroImages}
                rotate={content.home.heroRotate}
                sizes="(max-width: 767px) 16px, 100vw"
              />
              <div className="absolute bottom-12 left-12 max-w-xl">{heroText(true)}</div>
            </div>
          ) : (
            heroPlaceholder
          )}
        </div>

        {/* Разделы — рядом под героем */}
        {/* Сетка всегда на четыре колонки: без распродажи четвёртое место
            пустует, зато плитки не растягиваются и фото не теряют резкость. */}
        <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {tiles.map((section) => (
            // Пропорция 3:4: плитки остаются вертикальными на любой ширине
            // экрана, и высота меняется вместе с шириной колонки.
            <Link key={section.slug} href={`/catalog/${section.slug}`}
              className="group relative flex aspect-[3/4] flex-col justify-end overflow-hidden rounded-xl border border-line bg-bg p-5 transition hover:border-accent">
              {content.sectionImages?.[section.slug] && (
                <>
                  <Image
                    src={content.sectionImages[section.slug]!}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 25vw, 50vw"
                    className="object-contain transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                  {/* Затемнение снизу: белое название на светлом снимке иначе не читается. */}
                  <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent" />
                </>
              )}
              <span
                className={cn(
                  "relative text-lg font-semibold",
                  content.sectionImages?.[section.slug] ? "text-white" : "group-hover:text-accent",
                )}
              >
                {section.title}
              </span>
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
