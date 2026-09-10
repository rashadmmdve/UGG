"use client";

import { Heart } from "lucide-react";

import { useHydrated } from "@/lib/hooks/useHydrated";
import { useFavoritesStore } from "@/lib/store/favorites";
import { cn } from "@/lib/utils";

export function FavoriteButton({
  productId,
  className,
}: {
  productId: string;
  className?: string;
}) {
  const hydrated = useHydrated();
  const ids = useFavoritesStore((state) => state.ids);
  const toggle = useFavoritesStore((state) => state.toggle);

  const active = hydrated && ids.includes(productId);

  return (
    <button
      type="button"
      onClick={() => toggle(productId)}
      aria-pressed={active}
      aria-label={active ? "Убрать из избранного" : "В избранное"}
      className={cn(
        // Область нажатия шире самой иконки — иначе в сердце трудно
        // попасть пальцем.
        "flex h-10 w-10 items-center justify-center transition-colors hover:text-accent",
        active ? "text-accent" : "text-fg",
        className,
      )}
    >
      {/*
        Подложки под сердцем нет — только сам знак. Чтобы он не терялся на
        тёмной обуви, под иконкой мягкое белое свечение: на светлом фото
        оно незаметно, на чёрном держит контур читаемым.
      */}
      <Heart
        className="h-6 w-6 drop-shadow-[0_0_5px_rgba(255,255,255,0.9)]"
        strokeWidth={1.6}
        fill={active ? "currentColor" : "none"}
      />
    </button>
  );
}
