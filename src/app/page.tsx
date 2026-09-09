import { SITE_NAME, TRADEMARK_DISCLAIMER } from "@/lib/constants";
import { getPublishedCategories, getPublishedProducts } from "@/server/repositories/catalog";

/**
 * Временная главная страница.
 *
 * Настоящая витрина собирается на четвёртом этапе. Пока страница
 * показывает, что каркас поднялся и база отвечает.
 */
export default function HomePage() {
  const categories = getPublishedCategories();
  const products = getPublishedProducts();

  return (
    <main className="container-page mx-auto max-w-3xl py-16">
      <p className="label-caps">Каркас проекта</p>
      <h1 className="heading-section mt-3">{SITE_NAME}</h1>

      <p className="mt-4 text-muted">
        Основание проекта готово: база данных, аутентификация, доставка и
        SEO-плумбинг на месте. Витрина собирается на следующих этапах.
      </p>

      <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line">
        <div className="bg-sand p-5">
          <dt className="label-caps">Категорий</dt>
          <dd className="mt-1 text-2xl font-bold">{categories.length}</dd>
        </div>
        <div className="bg-sand p-5">
          <dt className="label-caps">Товаров</dt>
          <dd className="mt-1 text-2xl font-bold">{products.length}</dd>
        </div>
      </dl>

      <ul className="mt-10 space-y-2 text-sm">
        <li>
          <a className="text-accent underline" href="/robots.txt">
            /robots.txt
          </a>
        </li>
        <li>
          <a className="text-accent underline" href="/sitemap-index.xml">
            /sitemap-index.xml
          </a>
        </li>
        <li>
          <a className="text-accent underline" href="/admin/login">
            /admin/login
          </a>
        </li>
      </ul>

      <footer className="mt-16 border-t border-line pt-6 text-xs leading-relaxed text-muted">
        {TRADEMARK_DISCLAIMER}
      </footer>
    </main>
  );
}
