"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

import { FavoriteButton } from "@/components/shop/FavoriteButton";
import { useHydrated } from "@/lib/hooks/useHydrated";
import { cn } from "@/lib/utils";

/** Ниже этого сдвига палец считается промахом, а не листанием. */
const SWIPE_MIN_PX = 40;

export function ProductGallery({
  images,
  title,
  productId,
}: {
  images: string[];
  title: string;
  productId: string;
}) {
  const [active, setActive] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const total = images.length;
  const current = images[active];
  const swipeStartX = useRef<number | null>(null);

  /** Листание по кругу. */
  function go(step: 1 | -1) {
    if (total < 2) return;
    setActive((index) => (index + step + total) % total);
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className="relative aspect-square w-full cursor-zoom-in overflow-hidden rounded-lg bg-elevated"
        onClick={(event) => {
          // Клик по стрелке или сердцу не должен открывать кадр.
          if ((event.target as HTMLElement).closest("button")) return;
          if (current) setZoomOpen(true);
        }}
        onTouchStart={(event) => {
          swipeStartX.current = event.touches[0].clientX;
        }}
        onTouchEnd={(event) => {
          const start = swipeStartX.current;
          swipeStartX.current = null;
          if (start === null) return;
          const shift = event.changedTouches[0].clientX - start;
          if (Math.abs(shift) < SWIPE_MIN_PX) return;
          go(shift < 0 ? 1 : -1);
        }}
      >
        {current ? (
          <Image
            src={current}
            alt={`${title} — фото ${active + 1}`}
            fill
            // Главное фото — самый крупный элемент первого экрана.
            loading="eager"
            fetchPriority="high"
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted">
            Фотографии скоро появятся
          </div>
        )}

        <FavoriteButton productId={productId} className="absolute top-3 right-3 z-10" />

        {total > 1 && (
          <>
            <GalleryArrow direction="prev" onClick={() => go(-1)} />
            <GalleryArrow direction="next" onClick={() => go(1)} />
          </>
        )}
      </div>

      {total > 1 && (
        // Миниатюры растянуты на всю ширину главного кадра: колонок
        // столько же, сколько снимков, но не больше шести — дальше ряд
        // переносится, иначе на десяти фото каждое стало бы неразличимым.
        <div
          className="grid gap-2"
          style={{
            gridTemplateColumns: `repeat(${Math.min(total, 6)}, minmax(0, 1fr))`,
          }}
        >
          {images.map((image, index) => (
            <button
              key={image}
              type="button"
              onClick={() => setActive(index)}
              aria-label={`Фото ${index + 1}`}
              aria-current={index === active}
              className={cn(
                "relative aspect-square overflow-hidden rounded border bg-elevated transition-colors",
                index === active ? "border-accent" : "border-line hover:border-line-strong",
              )}
            >
              <Image
                src={image}
                alt=""
                fill
                sizes="(min-width: 1024px) 8vw, 16vw"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {current && (
        <PhotoLightbox
          src={current}
          alt={title}
          open={zoomOpen}
          total={total}
          onPrev={() => go(-1)}
          onNext={() => go(1)}
          onClose={() => setZoomOpen(false)}
        />
      )}
    </div>
  );
}

function PhotoLightbox({
  src,
  alt,
  open,
  total,
  onPrev,
  onNext,
  onClose,
}: {
  src: string;
  alt: string;
  open: boolean;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  const hydrated = useHydrated();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") onPrev();
      if (event.key === "ArrowRight") onNext();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, onPrev, onNext]);

  if (!hydrated || !open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-fg/85 p-4"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="relative aspect-square h-[min(calc(100dvh-2rem),calc(100vw-2rem))]"
      >
        <Image src={src} alt={alt} fill sizes="100vw" className="object-contain" />
        {total > 1 && (
          <>
            <GalleryArrow direction="prev" tone="light" onClick={onPrev} />
            <GalleryArrow direction="next" tone="light" onClick={onNext} />
          </>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть фото"
          className="absolute top-2 right-2 flex h-11 w-11 items-center justify-center text-white hover:opacity-70"
        >
          <X className="h-7 w-7 drop-shadow-[0_0_6px_rgba(0,0,0,0.7)]" strokeWidth={1.5} />
        </button>
      </div>
    </div>,
    document.body,
  );
}

function GalleryArrow({
  direction,
  tone = "dark",
  onClick,
}: {
  direction: "prev" | "next";
  tone?: "dark" | "light";
  onClick: () => void;
}) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
  const light = tone === "light";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === "prev" ? "Предыдущее фото" : "Следующее фото"}
      className={cn(
        "absolute top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center transition-opacity hover:opacity-60",
        light ? "text-white" : "text-fg",
        direction === "prev" ? "left-0" : "right-0",
      )}
    >
      <Icon
        className={cn("h-7 w-7", light ? "drop-shadow-[0_0_6px_rgba(0,0,0,0.8)]" : "drop-shadow-[0_0_6px_rgba(255,255,255,0.9)]")}
        strokeWidth={1.5}
      />
    </button>
  );
}
