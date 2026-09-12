"use client";

import { useSyncExternalStore } from "react";

/** Метка не меняется, пока страница открыта — подписка никогда не срабатывает. */
const subscribe = () => () => {};

type StaffRole = "admin" | "operator" | null;

const read = (): StaffRole => {
  const pair = document.cookie.split("; ").find((item) => item.startsWith("ugg_role="));
  const value = pair?.slice("ugg_role=".length);
  return value === "admin" || value === "operator" ? value : null;
};

/**
 * Вошедший сотрудник — по метке, которую ставит вход.
 *
 * Сессия лежит в httpOnly-куке, и это правильно; но витрина отдаётся из
 * кэша одинаковой всем, и читать сессию при её сборке значило бы лишить
 * кэша восемьсот страниц каталога ради одной кнопки. Поэтому метку
 * читает браузер, а на сервере ответ всегда «никто» — разметка совпадает.
 *
 * Правами метка не управляет: подделавший её увидит кнопку, но панель
 * проверит настоящую сессию и отправит его на главную.
 */
export function useStaffRole(): StaffRole {
  return useSyncExternalStore(subscribe, read, () => null);
}
