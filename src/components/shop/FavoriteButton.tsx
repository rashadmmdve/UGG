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
        "flex h-9 w-9 items-center justify-center transition-colors hover:text-accent",
        active ? "text-accent" : "text-fg",
        className,
      )}
    >
      <Heart className="h-5 w-5" strokeWidth={1.6} fill={active ? "currentColor" : "none"} />
    </button>
  );
}
