import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { JsonLd } from "@/components/JsonLd";
import { Logo } from "@/components/Logo";
import { HeroCarousel } from "@/components/shop/HeroCarousel";
import { ProductCard } from "@/components/shop/ProductCard";
import { SALE_SECTION, SITE_DESCRIPTION, SITE_NAME } from "@/lib/constants";
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
      {/* На телефоне подзаголовок не показываем: баннер и так тесный. */}
      {content.home.heroSubtitle && (
        <p className={cn("mt-3 hidden md:block md:text-lg", onBanner ? "text-white/85" : "text-muted")}>
          {content.home.heroSubtitle}
        </p>
      )}
      <Link href="/catalog" className="mt-6 inline-flex h-12 items-center rounded-md bg-accent px-6 text-sm font-semibold text-white hover:bg-accent-hover">
        Смотреть коллекцию
      </Link>
    </>
  );

  // Без баннера: бледный логотип на подложке и обычный текст. Подложка
  // занимает весь герой и оказывается самым крупным элементом первого
  // экрана — грузим её сразу, иначе она портит LCP.
  const heroPlaceholder = (
    <div className="relative flex min-h-[440px] flex-col justify-end overflow-hidden bg-sand p-8 md:min-h-[620px] md:p-12">
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
        Герой — во всю ширину экрана, без полей и скруглений: он единственный
        блок, который выходит за container-page. Телефон и широкий экран —
        два разных блока, виден один. На широком экране блок 2:1 под
        горизонтальный баннер, кадр целиком, текст поверх. На телефоне
        блок тянется до плиток разделов, и текст с кнопкой тоже поверх:
        свой вертикальный кадр 4:5 показывается целиком, а если его не
        загрузили — горизонтальный заполняет высоту, и края у него срезаются
        (иначе на 2:1 при ширине телефона высоты хватит на две строки).
        Скрытой карусели через sizes достаётся самая маленькая картинка.
      */}
      <section>
        {/* Телефон */}
        <div className="md:hidden">
          {hasMobileBanner ? (
            <div className="relative aspect-[4/5] overflow-hidden bg-sand">
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
            <div className="relative min-h-[440px] overflow-hidden bg-sand">
              <HeroCarousel
                images={content.home.heroImages}
                rotate={content.home.heroRotate}
                sizes="(min-width: 768px) 16px, 100vw"
                fit="cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/25 to-transparent px-6 pb-8 pt-20">
                {heroText(true)}
              </div>
            </div>
          ) : (
            heroPlaceholder
          )}
        </div>

        {/* Широкий экран */}
        <div className="hidden md:block">
          {hasBanner ? (
            <div className="relative aspect-[2/1] overflow-hidden bg-sand">
              <HeroCarousel
                images={content.home.heroImages}
                rotate={content.home.heroRotate}
                sizes="(max-width: 767px) 16px, 100vw"
              />
              {/* Отступ слева — как у container-page, чтобы текст стоял в линию с плитками. */}
              <div className="absolute bottom-12 left-8 max-w-xl xl:left-14">{heroText(true)}</div>
            </div>
          ) : (
            heroPlaceholder
          )}
        </div>

      </section>

      <section className="container-page">
        {/* Разделы под героем: три квадрата — женские, мужские, детские, а
            распродажа под ними одним прямоугольником во всю ширину тройки. */}
        <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-4">
          {tiles
            .filter((section) => section.slug !== SALE_SECTION.slug)
            .map((section) => (
              <SectionTile key={section.slug} section={section} image={content.sectionImages?.[section.slug]} className="aspect-square" />
            ))}
          {tiles
            .filter((section) => section.slug === SALE_SECTION.slug)
            .map((section) => (
              <SectionTile
                key={section.slug}
                section={section}
                image={content.sectionImages?.[section.slug]}
                className="col-span-3 aspect-[3/1]"
                wide
              />
            ))}
        </div>
      </section>

      {/* Преимущества */}
      {/* Подложка во всю ширину экрана, как у героя; сами пункты остаются
          на прежних местах — внутренний контейнер повторяет поля страницы
          и те же px-4, что были у полосы. */}
      <section className="mt-10 bg-sand py-5">
        {/* Пункты отцентрованы внутри своих колонок: при выравнивании по
            левому краю третий заканчивался на середине полосы, и справа
            оставалась пустота во весь экран. */}
        <ul className="grid grid-cols-1 gap-4 px-8 text-center text-sm sm:grid-cols-3 md:px-12 xl:px-[4.5rem]">
          <li><span className="font-semibold">Доставка по России</span><span className="block text-xs text-muted">СДЭК: пункт выдачи или курьер до двери</span></li>
          <li><span className="font-semibold">Обмен и возврат 14 дней</span><span className="block text-xs text-muted">Если не подошёл размер — поменяем</span></li>
          <li><span className="font-semibold">Натуральная овчина</span><span className="block text-xs text-muted">Тепло в мороз, не потеет в оттепель</span></li>
        </ul>
      </section>

      {bestsellers.length > 0 && (
        <ProductRow title="Хиты" href="/catalog" products={bestsellers} eager />
      )}

      {arrivals.length > 0 && (
        <ProductRow title="Новинки" href="/catalog?sort=new" products={arrivals} />
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
      {/* Ссылкой служит сам заголовок раздела: отдельная «Все товары»
          дублировала бы его и уводила взгляд вправо. */}
      <h2 className="heading-section">
        <Link href={href} className="transition-colors hover:text-accent">{title}</Link>
      </h2>
      <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">
        {products.map((product, index) => (
          <li key={product.id}><ProductCard product={product} eager={eager && index < 4} /></li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Плитка раздела на главной. Фото заполняет плитку целиком, подпись —
 * только введённая в админке; без неё ссылку называет aria-label.
 */
function SectionTile({ section, image, className, wide = false }: {
  section: { slug: string; title: string; caption: string | null };
  image?: string | null;
  className?: string;
  wide?: boolean;
}) {
  return (
    <Link
      href={`/catalog/${section.slug}`}
      aria-label={section.caption ? undefined : section.title}
      className={cn("group relative flex flex-col justify-end overflow-hidden bg-sand p-3 sm:p-5", className)}
    >
      {image && (
        <>
          <Image
            src={image}
            alt=""
            fill
            sizes={wide ? "100vw" : "33vw"}
            // Широкую плитку не обрезаем: баннер распродажи с надписью
            // целиком, пока под неё не загружен широкий снимок.
            className={cn(
              "transition-transform duration-300 group-hover:scale-[1.03]",
              wide ? "object-contain" : "object-cover",
            )}
          />
          {/* Затемнение снизу: белое название на светлом снимке иначе не читается. */}
          {section.caption && (
            <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent" />
          )}
        </>
      )}
      {section.caption && (
        <span
          className={cn(
            "relative text-xs font-semibold sm:text-lg",
            image ? "text-white" : "group-hover:text-accent",
          )}
        >
          {section.caption}
        </span>
      )}
    </Link>
  );
}
