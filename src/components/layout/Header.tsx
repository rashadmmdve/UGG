"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Heart, LayoutDashboard, Search, ShoppingBag, User } from "lucide-react";

import { Logo } from "@/components/Logo";
import { SearchBox } from "@/components/layout/SearchBox";
import { useHydrated } from "@/lib/hooks/useHydrated";
import { useStaffRole } from "@/lib/hooks/useIsAdmin";
import { cartCount, useCartStore } from "@/lib/store/cart";
import { useFavoritesStore } from "@/lib/store/favorites";
import type { MenuSection } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Ссылки после разделов каталога. */
const NAV_LINKS = [
  { href: "/dostavka-i-oplata", label: "Доставка" },
  { href: "/articles", label: "Статьи" },
];

/**
 * Подчёркивание пункта шапки, как на ugg.com: тонкая линия под текстом
 * вырастает слева направо при наведении и остаётся у текущего раздела.
 * Рисуется псевдоэлементом, чтобы не дёргать разметку; transform вместо
 * width — так линия анимируется без перерасчёта макета.
 */
const UNDERLINE =
  "relative after:absolute after:inset-x-0 after:-bottom-1 after:h-0.5 after:origin-left " +
  "after:scale-x-0 after:bg-fg after:transition-transform after:duration-300 after:ease-out " +
  "hover:after:scale-x-100 data-on:after:scale-x-100 motion-reduce:after:transition-none";

/**
 * Шапка витрины: логотип слева, разделы каталога с выпадающими меню
 * по центру, избранное, корзина и кабинет справа. На мобильном — бургер
 * со шторкой в два экрана: разделы, затем категории раздела.
 *
 * Все ссылки меню — обычные <a href>, а не кнопки: робот должен обходить
 * категории через шапку.
 */
export function Header({ menu }: { menu: MenuSection[] }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Поиск на телефоне: выпадающая полоска под шапкой поверх страницы.
  const [searchOpen, setSearchOpen] = useState(false);
  // Ключ поля: каждое открытие — новое пустое поле, но само оно не
  // размонтируется при закрытии, иначе полоска схлопывалась бы рывком.
  const [searchKey, setSearchKey] = useState(0);
  const [openSection, setOpenSection] = useState<string | null>(null);
  // Кнопка панели — только сотруднику, и каждому в свою: владельцу
  // админка, оператору панель оператора. См. useStaffRole.
  const staffRole = useStaffRole();

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
      setSearchOpen(false);
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

  // Полоска поиска прячется сама: Escape, прокрутка страницы или тап
  // мимо неё — покупатель пошёл дальше, поле ему уже не нужно.
  const searchBar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!searchOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSearchOpen(false);
    };
    const onScroll = () => setSearchOpen(false);
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (searchBar.current?.contains(target)) return;
      if ((target as Element).closest?.('button[aria-label="Поиск"]')) return;
      setSearchOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [searchOpen]);

  const active = menu.find((section) => section.slug === openSection) ?? null;
  // В меню попадают только непустые категории — см. пояснение у разметки.
  const activeCategories = active?.categories.filter((c) => c.hasProducts) ?? [];

  return (
    <header
      onMouseLeave={() => setOpenSection(null)}
      className="sticky top-0 z-40 border-b border-line bg-bg/95 backdrop-blur-sm"
    >
      {/*
        На телефоне шапка симметрична: бургер у левого края, иконки у
        правого на том же расстоянии (оба блока сдвинуты на -2 за поле),
        логотип — строго по центру экрана, а не «после бургера». С lg
        логотип возвращается в поток слева от меню.
      */}
      <div className="container-page relative flex h-16 items-center gap-6">
        <BurgerButton open={drawerOpen} onClick={() => setDrawerOpen((v) => !v)} />

        {/* Поиск на телефоне — значком сразу за бургером, как на ugg.com;
            по нему под шапкой раскрывается поле поверх страницы. */}
        <button
          type="button"
          onClick={() => {
            if (!searchOpen) setSearchKey((k) => k + 1);
            setSearchOpen((v) => !v);
            setDrawerOpen(false);
          }}
          aria-label="Поиск"
          aria-expanded={searchOpen}
          className="-ml-3 flex h-10 w-9 items-center justify-center transition-colors hover:text-accent lg:hidden"
        >
          <Search className="h-5 w-5" strokeWidth={1.6} />
        </button>

        {/* Вход в админку стоит слева, у бургера: справа значки покупателя,
            и хозяйская кнопка среди них читается как ещё один из них. */}
        {staffRole && (
          <Link
            href={staffRole === "operator" ? "/operator/dispatch" : "/admin"}
            aria-label={staffRole === "operator" ? "Панель оператора" : "Админ-панель"}
            title={staffRole === "operator" ? "Панель оператора" : "Админ-панель"}
            className="-ml-1 flex h-10 w-9 items-center justify-center transition-colors hover:text-accent lg:-ml-2 lg:w-10"
          >
            <LayoutDashboard className="h-5 w-5" strokeWidth={1.6} />
          </Link>
        )}

        <div className="absolute left-1/2 -translate-x-1/2 lg:static lg:translate-x-0">
          <Logo width={88} eager />
        </div>

        <nav className="hidden flex-1 items-center gap-6 lg:flex" aria-label="Каталог">
          {menu.map((section) => (
            <Link
              key={section.slug}
              href={section.href}
              // У раздела без категорий раскрывать нечего — ведём себя
              // как обычная ссылка и не рисуем стрелку.
              onMouseEnter={() => setOpenSection(section.categories.length ? section.slug : null)}
              onFocus={() => setOpenSection(section.categories.length ? section.slug : null)}
              aria-expanded={section.categories.length ? openSection === section.slug : undefined}
              // Без стрелок, как на ugg.com: о выпадающем меню говорит
              // само наведение, а подчёркивание держится, пока оно открыто.
              // data-on держит линию у текущего раздела и пока открыто его меню.
              data-on={pathname.startsWith(section.href) || openSection === section.slug || undefined}
              className={cn(UNDERLINE, "text-base font-medium text-fg")}
            >
              {section.title}
            </Link>
          ))}
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onMouseEnter={() => setOpenSection(null)}
              data-on={pathname.startsWith(link.href) || undefined}
              className={cn(UNDERLINE, "text-base font-medium text-fg")}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/*
          На телефоне ячейки 36 px с зазором 4 px: значки стоят через
          20 px. Сдвиг за поле на 6 px оставляет крайний значок на тех же
          18 px от края, что и полоски бургера (поле 16 − 6 + 8 внутри ячейки).
        */}
        {/* Поиск — в свободном месте между меню и значками, как на ugg.com.
            На телефоне вместо поля — значок у бургера. */}
        <SearchBox className="ml-auto hidden w-[336px] focus-within:w-[400px] transition-[width] duration-300 lg:block" inputClassName="text-sm" icon />

        <div className="-mr-1.5 ml-auto flex items-center gap-1 lg:ml-0 lg:mr-0">
          <Link
            href="/favorites"
            aria-label={`Избранное${favoritesCount ? `, ${favoritesCount}` : ""}`}
            className="relative flex h-10 w-9 items-center justify-center lg:w-10 transition-colors hover:text-accent"
          >
            <Heart className="h-5 w-5" strokeWidth={1.6} />
            {favoritesCount > 0 && <Indicator value={favoritesCount} />}
          </Link>
          <button
            type="button"
            onClick={openCart}
            aria-label={`Корзина${count ? `, ${count}` : ", пусто"}`}
            className="relative flex h-10 w-9 items-center justify-center lg:w-10 transition-colors hover:text-accent"
          >
            <ShoppingBag className="h-5 w-5" strokeWidth={1.6} />
            {count > 0 && <Indicator value={count} />}
          </button>
          <Link
            href="/account"
            aria-label="Личный кабинет"
            className="flex h-10 w-9 items-center justify-center transition-colors hover:text-accent lg:w-10"
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
              можно нажатием на сам пункт.

              Показываются только категории, в которых есть товары: пустая
              ссылка в меню ведёт покупателя на страницу «здесь ничего нет»,
              и это худшее, чем может закончиться клик по каталогу.
            */}
            {activeCategories.length > 0 ? (
              <ul className="mx-auto grid max-w-5xl grid-cols-4 gap-x-8 gap-y-2">
                {activeCategories.map((category) => (
                  <li key={category.slug}>
                    <Link
                      href={category.href}
                      className="block py-0.5 text-sm transition-colors hover:text-accent"
                    >
                      {category.title}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mx-auto max-w-5xl text-sm text-muted">
                В этом разделе пока нет товаров.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Полоска поиска на телефоне: лежит поверх страницы и ничего не
          сдвигает — absolute под шапкой, а не в потоке. */}
      <div
        ref={searchBar}
        inert={!searchOpen}
        className={cn(
          "absolute inset-x-0 top-full border-b border-line bg-bg shadow-[0_18px_40px_-24px_rgba(0,0,0,0.35)] transition-[opacity,transform] duration-300 ease-out lg:hidden",
          searchOpen ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-3 opacity-0",
        )}
      >
        <div className="container-page py-3">
          <SearchBox key={searchKey} autoFocus={searchOpen} inputClassName="h-11 text-base" onNavigate={() => setSearchOpen(false)} />
        </div>
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
  // Открытый раздел — второй «экран» меню. Как на ugg.com: список
  // разделов, нажатие уводит вправо в список категорий, «Назад» — обратно.
  const [section, setSection] = useState<MenuSection | null>(null);

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

  // После закрытия возвращаемся на первый экран — но уже за кадром,
  // когда шторка уехала: иначе списки перелистнутся у всех на глазах.
  useEffect(() => {
    if (open) return;
    const id = setTimeout(() => setSection(null), 300);
    return () => clearTimeout(id);
  }, [open]);

  if (!hydrated) return null;

  const row = "flex w-full items-center justify-between border-b border-line py-3.5 text-left text-[15px] font-medium";

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
      {/* Затемнение справа от шторки: тап по нему закрывает меню. */}
      <div
        onClick={onClose}
        aria-hidden
        className={cn("absolute inset-0 bg-black/40 transition-opacity duration-300", open ? "opacity-100" : "opacity-0")}
      />
      <div
        className={cn(
          "absolute inset-y-0 left-0 w-[82%] max-w-sm overflow-hidden bg-bg shadow-xl transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Два экрана рядом, шириной в две шторки; сдвиг на половину
            показывает второй. Так листается без перестроения списка. */}
        <div
          className={cn(
            "flex h-full w-[200%] transition-transform duration-300 ease-out",
            section ? "-translate-x-1/2" : "translate-x-0",
          )}
        >
          <nav
            inert={!open || Boolean(section)}
            className="flex h-full w-1/2 flex-col overflow-y-auto"
            aria-label="Мобильное меню"
          >
            <div className="px-5 pt-2">
            {menu.map((item) =>
              item.categories.some((c) => c.hasProducts) ? (
                <button
                  key={item.slug}
                  type="button"
                  onClick={() => setSection(item)}
                  className={row}
                >
                  {item.title}
                  <ChevronRight className="h-5 w-5 text-muted" strokeWidth={1.6} />
                </button>
              ) : (
                <Link key={item.slug} href={item.href} onClick={onClose} className={row}>
                  {item.title}
                </Link>
              ),
            )}
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} onClick={onClose} className={row}>
                {link.label}
              </Link>
            ))}
            </div>
            {/* Серый низ с кабинетом — как на ugg.com. */}
            <div className="mt-auto flex flex-col gap-1 bg-elevated px-5 py-4 text-sm">
              <Link href="/account" onClick={onClose} className="flex items-center gap-2 py-2">
                <User className="h-4 w-4" strokeWidth={1.6} /> Личный кабинет
              </Link>
              <Link href="/favorites" onClick={onClose} className="flex items-center gap-2 py-2">
                <Heart className="h-4 w-4" strokeWidth={1.6} /> Избранное
              </Link>
            </div>
          </nav>

          <div inert={!open || !section} className="h-full w-1/2 overflow-y-auto px-5 pt-2">
            {/* Как на ugg.com: «‹ Все разделы», затем название раздела
                (ссылка на него целиком) и его категории. */}
            <button
              type="button"
              onClick={() => setSection(null)}
              className="flex w-full items-center gap-1 border-b border-line py-3.5 text-left text-sm font-semibold"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={2} />
              Все разделы
            </button>
            {section && (
              <ul>
                <li>
                  <Link href={section.href} onClick={onClose} className={cn(row, "font-semibold")}>
                    {section.title}
                  </Link>
                </li>
                {section.categories
                  .filter((category) => category.hasProducts)
                  .map((category) => (
                    <li key={category.slug}>
                      <Link href={category.href} onClick={onClose} className={cn(row, "font-normal")}>
                        {category.title}
                      </Link>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
