import type { z } from "zod";

/**
 * Состояние формы после серверного действия.
 *
 * Общее для админки и витрины: одна форма ошибок — один компонент
 * вывода, а не по обёртке на каждый раздел.
 */
export type ActionState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
  /** Что можно сделать с ошибкой — например, отправить письмо ещё раз. */
  action?: { href: string; label: string };
};

export const DENIED: ActionState = { error: "Нет доступа" };

/**
 * Ошибки zod в вид «имя поля → сообщение».
 *
 * Берётся только первый сегмент пути: для вложенных структур вроде
 * variants[2].stock форма подсвечивает целиком блок variants, а не
 * пытается адресовать отдельную ячейку.
 */
export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !result[key]) result[key] = issue.message;
  }
  return result;
}

/** Пустая строка из формы означает «не задано», а не число ноль. */
export function numberOrNull(value: FormDataEntryValue | null): string | null {
  if (value === null) return null;
  const text = String(value).trim();
  return text === "" ? null : text;
}

/** Пустой вариант в выпадающем списке — тоже «не задано». */
export function stringOrNull(value: FormDataEntryValue | null): string | null {
  if (value === null) return null;
  const text = String(value).trim();
  return text === "" ? null : text;
}

/** Разбор JSON-поля формы с запасным значением. */
export function jsonField<T>(
  formData: FormData,
  key: string,
  fallback: T,
): T {
  const raw = formData.get(key);
  if (typeof raw !== "string" || raw.trim() === "") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Список из текстового поля: по запятым и переносам строк. */
export function listField(formData: FormData, key: string): string[] {
  const raw = formData.get(key);
  if (typeof raw !== "string") return [];
  return raw
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}
