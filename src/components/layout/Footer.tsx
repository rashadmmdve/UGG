import Link from "next/link";

import { Logo } from "@/components/Logo";
import { TRADEMARK_DISCLAIMER } from "@/lib/constants";
import type { MenuSection } from "@/lib/types";
import type { SiteContent } from "@/server/repositories/settings";

const INFO_LINKS = [
  { href: "/dostavka-i-oplata", label: "Доставка и оплата" },
  { href: "/obmen-i-vozvrat", label: "Обмен и возврат" },
  { href: "/garantiya-podlinnosti", label: "Гарантия подлинности" },
  { href: "/razmery-ugg", label: "Размерная сетка" },
  { href: "/kak-otlichit-original", label: "Как отличить оригинал" },
  { href: "/uhod-za-ugg", label: "Уход за обувью" },
];

const COMPANY_LINKS = [
  { href: "/o-magazine", label: "О магазине" },
  { href: "/kontakty", label: "Контакты" },
  { href: "/articles", label: "Статьи" },
  { href: "/oferta", label: "Публичная оферта" },
  { href: "/politika-konfidentsialnosti", label: "Политика конфиденциальности" },
];

/**
 * Подвал. Реквизиты и дисклеймер выводятся на каждой странице: первые —
 * требование закона и коммерческий фактор для Яндекса, второй — то, что
 * отличает независимого продавца оригинала от того, кто выдаёт себя за
 * официального представителя.
 */
export function Footer({
  menu,
  contacts,
}: {
  menu: MenuSection[];
  contacts: SiteContent["contacts"];
}) {
  return (
    <footer className="mt-20 border-t border-line bg-sand">
      <div className="container-page py-12">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Logo width={110} />
            <p className="mt-4 max-w-sm text-sm text-muted">
              Магазин оригинальной обуви UGG®. Натуральная овчина, проверенные
              поставки, доставка по всей России.
            </p>
            {(contacts.phone || contacts.email) && (
              <ul className="mt-5 space-y-1 text-sm">
                {contacts.phone && (
                  <li>
                    <a href={`tel:${contacts.phone.replace(/[^\d+]/g, "")}`} className="hover:text-accent">
                      {contacts.phone}
                    </a>
                  </li>
                )}
                {contacts.email && (
                  <li>
                    <a href={`mailto:${contacts.email}`} className="hover:text-accent">
                      {contacts.email}
                    </a>
                  </li>
                )}
              </ul>
            )}
          </div>

          <div>
            <p className="label-caps">Каталог</p>
            <ul className="mt-3 space-y-1.5 text-sm">
              {menu.map((section) => (
                <li key={section.slug}>
                  <Link href={section.href} className="hover:text-accent">{section.title}</Link>
                </li>
              ))}
              <li>
                <Link href="/catalog" className="hover:text-accent">Все товары</Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="label-caps">Покупателям</p>
            <ul className="mt-3 space-y-1.5 text-sm">
              {INFO_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-accent">{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="label-caps">Магазин</p>
            <ul className="mt-3 space-y-1.5 text-sm">
              {COMPANY_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-accent">{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-line pt-6 text-xs leading-relaxed text-muted">
          {(contacts.legalName || contacts.inn) && (
            <p>
              {contacts.legalName}
              {contacts.inn && ` · ИНН ${contacts.inn}`}
              {contacts.ogrn && ` · ОГРН ${contacts.ogrn}`}
              {contacts.address && ` · ${contacts.address}`}
            </p>
          )}
          <p className="mt-2">{TRADEMARK_DISCLAIMER}</p>
          <p className="mt-2">© {new Date().getFullYear()}</p>
        </div>
      </div>
    </footer>
  );
}
