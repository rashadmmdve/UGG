import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/constants";

/**
 * robots.txt
 *
 * Служебные разделы закрыты. Отдельно стоит обратить внимание на то,
 * чего здесь НЕТ: параметры фильтров и сортировки не закрыты через
 * Disallow. Это сделано намеренно.
 *
 * Disallow запрещает обход адреса, и накопленные им ссылочные сигналы
 * просто теряются, а сам адрес нередко всё равно попадает в индекс со
 * статусом «проиндексировано, несмотря на блокировку». Clean-param,
 * наоборот, велит Яндексу склеить параметрический адрес с чистым и
 * передать ему все сигналы. Директивы взаимоисключающие: закрытый в
 * Disallow адрес не обходится, и Clean-param по нему не сработает.
 */
export default function robots(): MetadataRoute.Robots {
  const disallow = [
    "/admin",
    "/api",
    "/account",
    "/cart",
    "/checkout",
    "/favorites",
    "/search",
  ];

  return {
    rules: [
      { userAgent: "*", allow: "/", disallow },
      {
        userAgent: "Yandex",
        allow: "/",
        disallow,
        other: {
          "Clean-param": [
            // Фильтры, сортировка и постраничная навигация каталога:
            // все они отдают ту же страницу, что и чистый адрес.
            "sort&page&color&size&price_min&price_max /catalog/",
            // Метки рекламных кампаний и переходов.
            "utm_source&utm_medium&utm_campaign&utm_content&utm_term&yclid&gclid&_openstat&from",
          ],
        },
      },
    ],
    /**
     * Индексный файл, перечисляющий все четыре карты сайта.
     * Собирается вручную: generateSitemaps создаёт только сами файлы,
     * индекс к ним Next не генерирует.
     */
    sitemap: `${SITE_URL}/sitemap-index.xml`,
    host: SITE_URL,
  };
}
