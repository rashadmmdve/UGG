"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";

type Hit = { id: string; title: string; slug: string; price: number; image: string | null };

/**
 * Поле поиска с живыми подсказками: ищет по мере ввода, без кнопки.
 *
 * Запрос уходит с задержкой в четверть секунды после последнего символа
 * и отменяется, если человек продолжил печатать — иначе на каждую букву
 * летел бы отдельный запрос. Enter ведёт на страницу со всей выдачей.
 */
export function SearchBox({
  autoFocus = false,
  className,
  inputClassName,
  icon = false,
  onNavigate,
}: {
  autoFocus?: boolean;
  className?: string;
  inputClassName?: string;
  /** Лупа справа в поле — в шапке на компьютере. */
  icon?: boolean;
  /** Переход по подсказке или Enter — родитель закрывает свою панель. */
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [total, setTotal] = useState(0);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const controller = new AbortController();
    const id = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        if (!response.ok) return;
        const data = (await response.json()) as { items: Hit[]; total: number };
        setHits(data.items);
        setTotal(data.total);
        setOpen(true);
      } catch {
        // отменённый или упавший запрос — подсказки просто не обновятся
      }
    }, 250);
    return () => {
      clearTimeout(id);
      controller.abort();
    };
  }, [query]);

  // Клик мимо поля закрывает подсказки.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;
    setOpen(false);
    onNavigate?.();
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  const showList = open && query.trim().length >= 2;

  return (
    <div ref={boxRef} className={cn("relative", className)}>
      <form onSubmit={submit} role="search">
        <label className="relative block">
          <span className="sr-only">Поиск по каталогу</span>
          <input
            ref={inputRef}
            type="search"
            name="q"
            value={query}
            onChange={(event) => {
              const value = event.target.value;
              setQuery(value);
              // Короткий ввод — подсказок нет: чистим сразу, не дожидаясь запроса.
              if (value.trim().length < 2) {
                setHits([]);
                setTotal(0);
                setOpen(false);
              }
            }}
            onFocus={() => hits.length > 0 && setOpen(true)}
            placeholder="Поиск"
            autoComplete="off"
            className={cn(
              "h-10 w-full rounded border border-line bg-bg px-4 text-fg outline-none transition-[border-color] placeholder:text-muted focus:border-accent",
              icon && "pr-10",
              inputClassName,
            )}
          />
          {icon && (
            <span className="pointer-events-none absolute inset-y-0 right-0 flex w-10 items-center justify-center text-fg">
              <Search className="h-4.5 w-4.5" strokeWidth={1.8} />
            </span>
          )}
        </label>
      </form>

      {showList && (
        <div className="absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-md border border-line bg-bg shadow-lg">
          {hits.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted">Ничего не нашлось</p>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto">
              {hits.map((hit) => (
                <li key={hit.id}>
                  <Link
                    href={`/product/${hit.slug}`}
                    onClick={() => {
                      setOpen(false);
                      onNavigate?.();
                    }}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-sand"
                  >
                    <span className="relative block h-12 w-12 shrink-0 overflow-hidden rounded bg-elevated">
                      {hit.image && <Image src={hit.image} alt="" fill sizes="48px" className="object-contain" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">{hit.title}</span>
                    <span className="shrink-0 text-sm tabular-nums">{formatPrice(hit.price)}</span>
                  </Link>
                </li>
              ))}
              {total > hits.length && (
                <li>
                  <Link
                    href={`/search?q=${encodeURIComponent(query.trim())}`}
                    onClick={() => {
                      setOpen(false);
                      onNavigate?.();
                    }}
                    className="block border-t border-line px-3 py-2.5 text-center text-sm font-medium hover:bg-sand"
                  >
                    Все результаты ({total})
                  </Link>
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
