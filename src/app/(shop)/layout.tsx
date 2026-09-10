import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { CartDrawer } from "@/components/shop/CartDrawer";
import { SALE_SECTION, SECTIONS } from "@/lib/constants";
import { sectionTitle } from "@/server/catalog/sections";
import {
  getCategoriesBySection,
  getProductsByCategory,
  getSaleProducts,
} from "@/server/repositories/catalog";
import { getContent } from "@/server/repositories/settings";
import type { MenuSection } from "@/lib/types";

/**
 * Макет витрины: шапка, подвал, шторка корзины.
 *
 * Меню собирается здесь, на сервере: клиентской шапке незачем знать,
 * откуда берутся категории.
 */
function buildMenu(): MenuSection[] {
  const sections: MenuSection[] = SECTIONS.map((section) => ({
    slug: section.slug,
    title: sectionTitle(section.slug),
    href: `/catalog/${section.slug}`,
    categories: getCategoriesBySection(section.slug).map((category) => ({
      slug: category.slug,
      title: category.shortTitle ?? category.title,
      href: `/catalog/${section.slug}/${category.slug}`,
      hasProducts: getProductsByCategory(category.id).length > 0,
    })),
  }));

  // Распродажа встаёт последним пунктом и только когда в ней что-то есть:
  // пустой раздел в шапке — это обещание, которого магазин не выполняет.
  if (getSaleProducts().length > 0) {
    sections.push({
      slug: SALE_SECTION.slug,
      title: sectionTitle(SALE_SECTION.slug),
      href: `/catalog/${SALE_SECTION.slug}`,
      categories: [],
    });
  }

  return sections;
}

export default function ShopLayout({ children }: LayoutProps<"/">) {
  const menu = buildMenu();
  const content = getContent();

  return (
    <>
      <Header menu={menu} />
      <main className="min-h-[60vh]">{children}</main>
      <Footer menu={menu} contacts={content.contacts} />
      <CartDrawer />
    </>
  );
}
