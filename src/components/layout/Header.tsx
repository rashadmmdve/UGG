"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Heart, ShoppingBag, User } from "lucide-react";

import { Logo } from "@/components/Logo";
import { useHydrated } from "@/lib/hooks/useHydrated";
import { cartCount, useCartStore } from "@/lib/store/cart";
import { useFavoritesStore } from "@/lib/store/favorites";
import type { MenuSection } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Ссылки после разделов каталога. */
const NAV_LINKS = [
  { href: "/articles", label: "Статьи" },
  { href: "/dostavka-i-oplata", label: "Доставка" },
];

/**
 * Шапка витрины: логотип слева, разделы каталога с выпадающими меню
 * по центру, избранное, корзина и кабинет справа. На мобильном — бургер
 * со шторкой и аккордеонами по разделам.
 *
 * Все ссылки меню — обычные <a href>, а не кнопки: робот должен обходить
 * категории через шапку.
 */
export function Header({ menu }: { menu: MenuSection[] }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(null);

  const hydrated = useHydrated();
  const items = useCartStore((state) => state.items);
  const openCart = useCartStore((state) => state.open);
  const favorites = useFavoritesStore((state) => state.ids);

  const count = hydrated ? cartCount(items) : 0;
  const favoritesCount = hydrated ? favorites.length : 0;

  // Переход по ссылке закрывает и меню, и шторку. Через таймер, чтобы не
  // вызывать setState синхронно в теле эффекта.
  useEffect(() => {
    const id = setTimeout(() => {
      setOpenSection(null);
      setDrawerOpen(false);
    }, 0);
    return () => clearTimeout(id);
  }, [pathname]);

  useEffect(() => {
    if (!openSection) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenSection(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openSection]);

  const active = menu.find((section) => section.slug === openSection) ?? null;

  return (
    <header
      onMouseLeave={() => setOpenSection(null)}
      className="sticky top-0 z-40 border-b border-line bg-bg/95 backdrop-blur-sm"
    >
      <div className="container-page flex h-16 items-center gap-6">
        <BurgerButton open={drawerOpen} onClick={() => setDrawerOpen((v) => !v)} />

        <Logo width={88} eager />

        <nav className="hidden flex-1 items-center gap-6 lg:flex" aria-label="Каталог">
          {menu.map((section) => (
            <Link
              key={section.slug}
              href={section.href}
              onMouseEnter={() => setOpenSection(section.slug)}
              onFocus={() => setOpenSection(section.slug)}
              aria-expanded={openSection === section.slug}
              className={cn(
                "flex items-center gap-1 text-sm font-medium transition-colors hover:text-accent",
                pathname.startsWith(section.href) ? "text-accent" : "text-fg",
              )}
            >
              {section.title}
              {/* Стрелка разворачивается на 180°, пока открыто меню раздела. */}
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 opacity-60 transition-transform duration-300 ease-out",
                  openSection === section.slug && "rotate-180",
                )}
                strokeWidth={2}
              />
            </Link>
          ))}
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onMouseEnter={() => setOpenSection(null)}
              className={cn(
                "text-sm font-medium transition-colors hover:text-accent",
                pathname.startsWith(link.href) ? "text-accent" : "text-fg",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <Link
            href="/favorites"
            aria-label={`Избранное${favoritesCount ? `, ${favoritesCount}` : ""}`}
            className="relative flex h-10 w-10 items-center justify-center transition-colors hover:text-accent"
          >
            <Heart className="h-5 w-5" strokeWidth={1.6} />
            {favoritesCount > 0 && <Indicator value={favoritesCount} />}
          </Link>
          <button
            type="button"
            onClick={openCart}
            aria-label={`Корзина${count ? `, ${count}` : ", пусто"}`}
            className="relative flex h-10 w-10 items-center justify-center transition-colors hover:text-accent"
          >
            <ShoppingBag className="h-5 w-5" strokeWidth={1.6} />
            {count > 0 && <Indicator value={count} />}
          </button>
          <Link
            href="/account"
            aria-label="Личный кабинет"
            className="flex h-10 w-10 items-center justify-center transition-colors hover:text-accent"
          >
            <User className="h-5 w-5" strokeWidth={1.6} />
          </Link>
        </div>
      </div>

      {/* Выпадающее меню раздела — только десктоп */}
      <div
        inert={!active}
        className={cn(
          "absolute inset-x-0 top-full hidden border-b border-line bg-bg shadow-[0_18px_40px_-24px_rgba(0,0,0,0.35)] transition-all duration-200 lg:block",
          active ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-1 opacity-0",
        )}
      >
        {active && (
          <div className="container-page py-8">
            {/*
              Ни заголовка раздела, ни ссылки «Все …»: название дублировало
              пункт шапки, под которым меню и раскрылось, а перейти в раздел
              можно нажатием на сам пункт. Остаются только категории —
              сетка ограничена по ширине и отцентрована, чтобы столбцы
              стояли ровно, а не расползались по всему экрану.
            */}
            <ul className="mx-auto grid max-w-5xl grid-cols-4 gap-x-8 gap-y-2 text-center">
              {active.categories.map((category) => (
                <li key={category.slug}>
                  <Link
                    href={category.href}
                    className={cn(
                      "block py-0.5 text-sm transition-colors hover:text-accent",
                      category.hasProducts ? "text-fg" : "text-muted",
                    )}
                  >
                    {category.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} menu={menu} />
    </header>
  );
}

function Indicator({ value }: { value: number }) {
  return (
    <span className="absolute top-1 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[0.625rem] leading-none text-white tabular-nums">
      {value}
    </span>
  );
}

function BurgerButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={open ? "Закрыть меню" : "Открыть меню"}
      aria-expanded={open}
      className="-ml-2 flex h-10 w-10 items-center justify-center lg:hidden"
    >
      <span className="relative flex h-3.5 w-5 flex-col justify-between">
        <span className={cn("block h-0.5 w-full rounded bg-current transition-transform duration-300", open && "translate-y-[6px] rotate-45")} />
        <span className={cn("block h-0.5 w-full rounded bg-current transition-opacity duration-200", open && "opacity-0")} />
        <span className={cn("block h-0.5 w-full rounded bg-current transition-transform duration-300", open && "-translate-y-[6px] -rotate-45")} />
      </span>
    </button>
  );
}

function MobileDrawer({
  open,
  onClose,
  menu,
}: {
  open: boolean;
  onClose: () => void;
  menu: MenuSection[];
}) {
  const hydrated = useHydrated();
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!hydrated) return null;

  // Портал в body: у шапки backdrop-filter, а он делает из неё containing
  // block для position:fixed — без портала шторка не растянулась бы на экран.
  return createPortal(
    <div
      aria-hidden={!open}
      className={cn(
        "fixed inset-x-0 top-16 bottom-0 z-50 overflow-hidden lg:hidden",
        !open && "pointer-events-none",
      )}
    >
      <div
        className={cn(
          "h-full overflow-y-auto bg-bg transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <nav className="container-page flex flex-col py-6" aria-label="Мобильное меню">
          {menu.map((section) => {
            const isOpen = expanded === section.slug;
            return (
              <div key={section.slug} className="border-b border-line">
                <div className="flex items-center">
                  <Link
                    href={section.href}
                    tabIndex={open ? undefined : -1}
                    onClick={onClose}
                    className="flex-1 py-3 text-base font-semibold"
                  >
                    {section.title}
                  </Link>
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : section.slug)}
                    aria-expanded={isOpen}
                    aria-label={`Категории: ${section.title}`}
                    className="flex h-10 w-10 items-center justify-center"
                  >
                    <ChevronDown
                      className={cn("h-4 w-4 transition-transform", isOpen ? "rotate-180" : "")}
                      strokeWidth={2}
                    />
                  </button>
                </div>
                <div className={cn("grid transition-[grid-template-rows] duration-300", isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                  <ul className="overflow-hidden">
                    {section.categories.map((category) => (
                      <li key={category.slug}>
                        <Link
                          href={category.href}
                          tabIndex={open && isOpen ? undefined : -1}
                          onClick={onClose}
                          className={cn("block py-2 pl-3 text-sm", category.hasProducts ? "text-fg" : "text-muted")}
                        >
                          {category.title}
                        </Link>
                      </li>
                    ))}
                    <li className="pb-3" />
                  </ul>
                </div>
              </div>
            );
          })}
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              tabIndex={open ? undefined : -1}
              onClick={onClose}
              className="border-b border-line py-3 text-base font-semibold"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>,
    document.body,
  );
}
