import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { JsonLd } from "@/components/JsonLd";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/constants";
import { organizationLd, webSiteLd } from "@/server/seo/jsonld";

import "./globals.css";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  /**
   * База для относительных адресов в метаданных: канонические ссылки и
   * картинки Open Graph разворачиваются в абсолютные именно отсюда.
   */
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — магазин оригинальной обуви UGG®`,
    // Шаблон применяется к вложенным страницам, но не к самому макету.
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — магазин оригинальной обуви UGG®`,
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
    <html lang="ru" className={inter.variable}>
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
