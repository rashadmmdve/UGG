import Image from "next/image";
import Link from "next/link";

/**
 * Логотип.
 *
 * Единственный источник — public/brand/ugg-logo.png (2000×1111, прозрачный
 * фон). Отсюда же собираются иконка вкладки и картинка для Open Graph, так
 * что замена файла меняет знак сразу везде.
 */
export const LOGO_SRC = "/brand/ugg-logo.png";
const LOGO_RATIO = 1111 / 2000;

export function Logo({
  width = 120,
  href = "/",
  eager = false,
  className,
}: {
  width?: number;
  /** Куда ведёт ссылка; null — просто картинка без ссылки. */
  href?: string | null;
  /** Грузить сразу — для шапки, где логотип виден на первом экране. */
  eager?: boolean;
  className?: string;
}) {
  const image = (
    <Image
      src={LOGO_SRC}
      alt="UGG"
      width={width}
      height={Math.round(width * LOGO_RATIO)}
      className={className}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : undefined}
    />
  );

  if (!href) return image;

  return (
    <Link href={href} aria-label="На главную" className="inline-block">
      {image}
    </Link>
  );
}
