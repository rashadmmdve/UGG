import "server-only";

import fs from "node:fs";
import path from "node:path";

import type { Database } from "better-sqlite3";

/**
 * Применение схемы базы.
 *
 * Сам DDL лежит в `db/schema.sql` в корне проекта, а не в этом файле:
 * ту же схему разворачивают служебные скрипты (создание администратора,
 * наполнение справочников), которые запускаются обычным node и про
 * TypeScript ничего не знают. Держать два экземпляра схемы нельзя —
 * они разойдутся при первой же правке.
 *
 * Применение безопасно к повторному запуску: всё создаётся через
 * IF NOT EXISTS. Версия схемы хранится в user_version — по ней будут
 * добавляться миграции, когда структура изменится.
 */
const SCHEMA_VERSION = 1;

function readDdl(): string {
  return fs.readFileSync(
    path.join(process.cwd(), "db", "schema.sql"),
    "utf8",
  );
}

export function applySchema(db: Database): void {
  db.exec(readDdl());

  const current = db.pragma("user_version", { simple: true }) as number;

  if (current < SCHEMA_VERSION) {
    // Будущие миграции добавляются здесь по возрастанию версии.
    db.pragma(`user_version = ${SCHEMA_VERSION}`);
  }
}
