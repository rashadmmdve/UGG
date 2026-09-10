import type { Metadata } from "next";
import { Ubuntu } from "next/font/google";

import { JsonLd } from "@/components/JsonLd";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/constants";
import { organizationLd, webSiteLd } from "@/server/seo/jsonld";

import "./globals.css";

/**
 * Ubuntu — единственный шрифт проекта.
 *
 * В отличие от Inter это не вариативный шрифт: начертания перечисляются
 * явно, и грузится ровно то, что используется в вёрстке — обычное,
 * среднее и жирное. Кириллица подключена отдельным набором символов,
 * иначе русский текст откатился бы на системный шрифт.
 */
const ubuntu = Ubuntu({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "700"],
  variable: "--font-ubuntu",
  display: "swap",
});

export const metadata: Metadata = {
  /**
   * База для относительных адресов в метаданных: канонические ссылки и
   * картинки Open Graph разворачиваются в абсолютные именно отсюда.
   */
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — угги с доставкой по России`,
    // Шаблон применяется к вложенным страницам, но не к самому макету.
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — угги с доставкой по России`,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  verification: {
    yandex: process.env.YANDEX_VERIFICATION,
    google: process.env.GOOGLE_VERIFICATION,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={ubuntu.variable}>
      <body>
        {/*
          Разметка организации и сайта выводится на всех страницах: по ней
          Яндекс собирает карточку организации, а Google — блок с поиском
          по сайту.
        */}
        <JsonLd data={[organizationLd(), webSiteLd()]} />
        {children}
      </body>
    </html>
  );
}
