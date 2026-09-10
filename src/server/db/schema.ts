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
const SCHEMA_VERSION = 5;

function readDdl(): string {
  return fs.readFileSync(
    path.join(process.cwd(), "db", "schema.sql"),
    "utf8",
  );
}

export function applySchema(db: Database): void {
  db.exec(readDdl());

  const current = db.pragma("user_version", { simple: true }) as number;

  // Миграции по возрастанию версии. CREATE TABLE IF NOT EXISTS новых
  // столбцов в существующую таблицу не добавит — для этого и нужны они.
  if (current < 2) addColumn(db, "orders", "payment_method", "TEXT NOT NULL DEFAULT 'on_delivery'");
  if (current < 3) {
    addColumn(db, "users", "email_verified_at", "TEXT");
    addColumn(db, "users", "verify_token_hash", "TEXT");
    addColumn(db, "users", "verify_token_expires_at", "TEXT");
    // Кто зарегистрировался до подтверждения почты, тот считается
    // подтверждённым — иначе все существующие аккаунты оказались бы заперты.
    db.exec("UPDATE users SET email_verified_at = created_at WHERE email_verified_at IS NULL");
    db.exec("CREATE INDEX IF NOT EXISTS idx_users_verify_token ON users(verify_token_hash)");
  }
  if (current < 4) {
    addColumn(db, "users", "reset_token_hash", "TEXT");
    addColumn(db, "users", "reset_token_expires_at", "TEXT");
    db.exec("CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token_hash)");
  }
  if (current < 5) {
    addColumn(db, "products", "is_sale", "INTEGER NOT NULL DEFAULT 0");
    db.exec("CREATE INDEX IF NOT EXISTS idx_products_sale ON products(is_sale, is_published)");
  }

  if (current < SCHEMA_VERSION) {
    db.pragma(`user_version = ${SCHEMA_VERSION}`);
  }
}

/**
 * Добавить столбец, если его ещё нет. Свежая база получает его из
 * schema.sql, и повторный ALTER упал бы с «duplicate column».
 */
function addColumn(db: Database, table: string, column: string, ddl: string): void {
  const columns = db.pragma(`table_info(${table})`) as { name: string }[];
  if (columns.some((c) => c.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
}
