import "server-only";

import { cache } from "react";

import { getDb } from "@/server/db/connection";
import type { LogisticsSettings } from "@/lib/types";

/**
 * Одиночные объекты настроек: логистика и тексты витрины.
 *
 * Хранятся записями ключ-значение — их всегда читают и перезаписывают
 * целиком, отдельные таблицы под каждый набор полей были бы лишними.
 */

function readSetting<T>(key: string, fallback: T): T {
  const row = getDb()
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get(key) as { value: string } | undefined;

  if (!row) return fallback;

  try {
    return { ...fallback, ...(JSON.parse(row.value) as T) };
  } catch {
    return fallback;
  }
}

function writeSetting(key: string, value: unknown): void {
  getDb()
    .prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    .run(key, JSON.stringify(value));
}

/**
 * Откуда отправляются посылки.
 *
 * Значения из переменных окружения — только запасной вариант на первый
 * запуск: рабочие настройки задаёт администратор, и менять город
 * отправки не должно требовать передеплоя.
 */
export const getLogistics = cache((): LogisticsSettings =>
  readSetting<LogisticsSettings>("logistics", {
    fromCityCode: Number(process.env.CDEK_FROM_CITY_CODE ?? 44),
    fromCity: "Москва",
    shipmentPointCode: process.env.CDEK_SHIPMENT_POINT ?? "",
    shipmentPointAddress: "",
  }),
);

export function saveLogistics(settings: LogisticsSettings): void {
  writeSetting("logistics", settings);
}

/** Редактируемые тексты и изображения витрины. */
export type SiteContent = {
  home: {
    heroTitle: string;
    heroSubtitle: string;
    heroImage: string | null;
  };
  /**
   * Фото разделов на главной: слаг раздела → адрес картинки.
   *
   * Лежит верхним полем, а не внутри home: настройки читаются поверхностным
   * слиянием с запасным значением, и вложенный объект из базы затёр бы
   * запасной целиком — новое поле у старой записи оказалось бы undefined.
   */
  sectionImages: Record<string, string | null>;
  about: { title: string; body: string };
  contacts: {
    phone: string;
    email: string;
    address: string;
    /** Реквизиты в подвале — влияют на доверие и на коммерческие факторы. */
    legalName: string;
    inn: string;
    ogrn: string;
  };
  faq: { question: string; answer: string }[];
  /**
   * Юридические тексты. Пустые — страницы отдаются с noindex и заглушкой:
   * индексировать «текст будет позже» нельзя, а публиковать без
   * согласования с юристом — тем более.
   */
  legal: {
    oferta: string;
    privacy: string;
  };
};

const DEFAULT_CONTENT: SiteContent = {
  home: {
    heroTitle: "Новая зимняя коллекция",
    heroSubtitle: "Женские, мужские и детские модели с доставкой по России",
    heroImage: null,
  },
  sectionImages: {},
  about: { title: "О магазине", body: "" },
  contacts: {
    phone: "",
    email: "",
    address: "",
    legalName: "",
    inn: "",
    ogrn: "",
  },
  faq: [],
  legal: { oferta: "", privacy: "" },
};

export const getContent = cache((): SiteContent =>
  readSetting<SiteContent>("content", DEFAULT_CONTENT),
);

export function saveContent(content: SiteContent): void {
  writeSetting("content", content);
}

/**
 * Готов ли юридический текст к публикации.
 *
 * Мало того, что он непустой: в заготовках остаются подстановки вида
 * {ТЕЛЕФОН}, и документ с такой дырой индексировать нельзя — договор с
 * незаполненным реквизитом выглядит хуже, чем его отсутствие.
 */
export function isLegalReady(text: string): boolean {
  return Boolean(text.trim()) && !/\{[А-ЯЁA-Z_]+\}/.test(text);
}
