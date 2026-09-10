import "server-only";

import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import { applySchema } from "./schema";

/**
 * Подключение к SQLite.
 *
 * База лежит в `data/shop.db` рядом с проектом. Файл в git не попадает:
 * в нём персональные данные покупателей и хеши паролей.
 */
/**
 * Папка базы задаётся переменной DATA_DIR, если она есть. На сервере база
 * общая для всех версий кода и лежит вне папки проекта: символическая
 * ссылка на неё внутри проекта роняет сборку — Turbopack не пускает пути
 * за пределы корня.
 */
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "shop.db");

/**
 * В режиме разработки Next перезагружает модули при каждом изменении файла.
 * Без глобального кэша это плодило бы новое соединение на каждую правку,
 * пока SQLite не упрётся в лимит дескрипторов.
 */
const globalForDb = globalThis as unknown as {
  __uggDb?: Database.Database;
};

function createConnection(): Database.Database {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const db = new Database(DB_PATH);

  // Журналирование с опережающей записью: читатели не блокируют писателя.
  // Для витрины это основной режим работы — много чтений, редкие записи.
  db.pragma("journal_mode = WAL");
  // Компромисс между скоростью записи и устойчивостью к потере питания.
  // При WAL этого достаточно: потерять можно только последнюю транзакцию.
  db.pragma("synchronous = NORMAL");
  // Внешние ключи в SQLite выключены по умолчанию — включаем явно,
  // иначе каскадное удаление вариантов и связей работать не будет.
  db.pragma("foreign_keys = ON");
  // Ждать освобождения блокировки вместо мгновенной ошибки SQLITE_BUSY.
  db.pragma("busy_timeout = 5000");

  applySchema(db);

  return db;
}

export function getDb(): Database.Database {
  if (!globalForDb.__uggDb) {
    globalForDb.__uggDb = createConnection();
  }
  return globalForDb.__uggDb;
}

/**
 * Выполнить набор изменений одной транзакцией.
 *
 * Пример, где это обязательно: оформление заказа списывает остатки по
 * нескольким позициям и создаёт заказ — либо всё, либо ничего.
 */
export function transaction<T>(fn: () => T): T {
  const db = getDb();
  return db.transaction(fn)();
}
