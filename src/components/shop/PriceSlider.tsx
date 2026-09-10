"use client";

import { useState } from "react";

import { formatPrice } from "@/lib/utils";

/**
 * Ползунок диапазона цены — два бегунка на общей дорожке.
 *
 * Собран из двух обычных `input[type=range]`, наложенных друг на друга:
 * готового двойного ползунка в HTML нет, а свой на указателях терял бы
 * управление с клавиатуры и поддержку скринридеров.
 *
 * Положение бегунков держится в собственном состоянии, чтобы перетаскивание
 * было плавным. Наружу оно уходит сразу же, а сброс фильтров возвращает
 * бегунки на место через смену `key` со стороны каталога — синхронизировать
 * состояние с пропсом через эффект здесь не нужно.
 */
export function PriceSlider({
  min,
  max,
  value,
  onChange,
}: {
  min: number;
  max: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
}) {
  const [local, setLocal] = useState<[number, number]>(value);

  // Шаг в 500 ₽: цены на обувь всё равно кратны сотням, а мелкий шаг
  // делает попадание бегунком неоправданно точной работой.
  const step = 500;
  const span = Math.max(max - min, 1);
  const leftPercent = ((local[0] - min) / span) * 100;
  const rightPercent = ((local[1] - min) / span) * 100;

  const commit = (next: [number, number]) => {
    setLocal(next);
    onChange(next);
  };

  const thumb =
    "pointer-events-none absolute h-1 w-full appearance-none bg-transparent " +
    "[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 " +
    "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full " +
    "[&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-fg [&::-webkit-slider-thumb]:bg-bg " +
    "[&::-webkit-slider-thumb]:cursor-grab " +
    "[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 " +
    "[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-fg " +
    "[&::-moz-range-thumb]:bg-bg [&::-moz-range-thumb]:cursor-grab";

  return (
    <div>
      <div className="relative h-4">
        <div className="absolute top-1.5 h-1 w-full rounded bg-line" />
        <div
          className="absolute top-1.5 h-1 rounded bg-fg"
          style={{ left: `${leftPercent}%`, right: `${100 - rightPercent}%` }}
        />

        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={local[0]}
          aria-label="Цена от"
          onChange={(event) =>
            // Левый бегунок не заходит за правый.
            commit([Math.min(Number(event.target.value), local[1] - step), local[1]])
          }
          className={`${thumb} top-1.5`}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={local[1]}
          aria-label="Цена до"
          onChange={(event) =>
            commit([local[0], Math.max(Number(event.target.value), local[0] + step)])
          }
          className={`${thumb} top-1.5`}
        />
      </div>

      <div className="mt-2 flex justify-between text-xs text-muted tabular-nums">
        <span>{formatPrice(local[0])}</span>
        <span>{formatPrice(local[1])}</span>
      </div>
    </div>
  );
}
