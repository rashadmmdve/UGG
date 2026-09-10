"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/** Сколько кадр держится на экране. */
const INTERVAL_MS = 6000;

/**
 * Карусель баннеров в шапке главной.
 *
 * Кадры не размонтируются, а меняют прозрачность: браузер не перезагружает
 * картинку при возврате к ней, и переход получается без мигания.
 *
 * Первый кадр грузится сразу — он самый крупный элемент первого экрана и
 * определяет оценку скорости загрузки. Остальные ждут своей очереди.
 *
 * При включённом в системе «уменьшении движения» автопрокрутка не
 * запускается: листать можно точками.
 */
export function HeroCarousel({ images, rotate }: { images: string[]; rotate: boolean }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!rotate || images.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const id = setInterval(() => setIndex((current) => (current + 1) % images.length), INTERVAL_MS);
    return () => clearInterval(id);
  }, [rotate, images.length]);

  return (
    <>
      {images.map((src, i) => (
        <Image
          key={src}
          src={src}
          alt=""
          fill
          sizes="100vw"
          className={cn(
            "object-contain transition-opacity duration-700",
            i === index ? "opacity-100" : "opacity-0",
          )}
          loading={i === 0 ? "eager" : "lazy"}
          fetchPriority={i === 0 ? "high" : "auto"}
        />
      ))}

      {images.length > 1 && (
        <div className="absolute inset-x-0 bottom-4 z-10 flex justify-center gap-2">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Баннер ${i + 1}`}
              aria-current={i === index}
              className={cn(
                "h-2 rounded-full transition-all",
                i === index ? "w-6 bg-fg" : "w-2 bg-fg/30 hover:bg-fg/60",
              )}
            />
          ))}
        </div>
      )}
    </>
  );
}
