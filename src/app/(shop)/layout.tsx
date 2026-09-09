import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { CartDrawer } from "@/components/shop/CartDrawer";
import { SECTIONS } from "@/lib/constants";
import {
  getCategoriesBySection,
  getProductsByCategory,
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
  return SECTIONS.map((section) => ({
    slug: section.slug,
    title: section.title,
    href: `/catalog/${section.slug}`,
    categories: getCategoriesBySection(section.slug).map((category) => ({
      slug: category.slug,
      title: category.shortTitle ?? category.title,
      href: `/catalog/${section.slug}/${category.slug}`,
      hasProducts: getProductsByCategory(category.id).length > 0,
    })),
  }));
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
