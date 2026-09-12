"use client";

import { Heart } from "lucide-react";

import { useHydrated } from "@/lib/hooks/useHydrated";
import { useFavoritesStore } from "@/lib/store/favorites";
import { cn } from "@/lib/utils";

export function FavoriteButton({
  productId,
  className,
  iconClassName,
}: {
  productId: string;
  className?: string;
  /** Размер самого сердца — в плитке каталога оно мельче, чем в карточке. */
  iconClassName?: string;
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
      {/* Только сам знак: ни подложки, ни свечения. */}
      <Heart
        className={iconClassName ?? "h-6 w-6"}
        strokeWidth={1.6}
        fill={active ? "currentColor" : "none"}
      />
    </button>
  );
}
