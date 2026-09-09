import { SITE_URL } from "@/lib/constants";

/**
 * Индексный файл карты сайта.
 *
 * `generateSitemaps` в Next создаёт только сами файлы по адресам
 * /sitemap/{id}.xml, но индекс, который их перечисляет, не генерирует.
 * А в Яндекс Вебмастер и Google Search Console удобнее сдавать один адрес,
 * а не четыре по отдельности, — поэтому индекс собирается здесь.
 *
 * Список должен совпадать с тем, что возвращает generateSitemaps
 * в src/app/sitemap.ts.
 */
const SHARDS = ["static", "catalog", "products", "articles"] as const;

export const revalidate = 3600;

export function GET(): Response {
  const lastModified = new Date().toISOString();

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${SHARDS.map(
  (shard) => `  <sitemap>
    <loc>${SITE_URL}/sitemap/${shard}.xml</loc>
    <lastmod>${lastModified}</lastmod>
  </sitemap>`,
).join("\n")}
</sitemapindex>
`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
