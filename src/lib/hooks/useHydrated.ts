"use client";

import { useSyncExternalStore } from "react";

/** Состояние гидрации не меняется — подписка никогда не срабатывает. */
const subscribe = () => () => {};

/**
 * Корзина и избранное восстанавливаются из localStorage только на клиенте.
 * До гидрации компоненты должны рисовать «пустое» состояние, иначе разметка
 * сервера и клиента разойдётся.
 *
 * useSyncExternalStore даёт разные снимки для сервера (false) и клиента
 * (true) без setState в эффекте и лишнего каскада рендеров.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
