/**
 * Очистка списка пользователей и назначение владельца.
 *
 *   npm run reset-users -- --yes admin@example.com ["пароль"]
 *
 * Удаляет ВСЕ учётные записи и заводит одну — с ролью администратора и
 * подтверждённой почтой. Флаг --yes обязателен: без него скрипт ничего
 * не делает, чтобы такую команду нельзя было выполнить по инерции.
 *
 * Пароль можно не указывать: тогда он генерируется случайным и
 * печатается один раз здесь. Хранить его негде — владелец сразу меняет
 * пароль через «Забыли пароль?» на сайте.
 *
 * Заказы и отзывы удалённых покупателей остаются: ссылка на автора в
 * схеме обнуляется (ON DELETE SET NULL), а имя и телефон хранятся в
 * самом заказе.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import Database from "better-sqlite3";
import { hash } from "@node-rs/argon2";

const args = process.argv.slice(2);
const confirmed = args.includes("--yes");
const [email, password] = args.filter((a) => a !== "--yes");

if (!confirmed || !email) {
  console.error('Использование: npm run reset-users -- --yes admin@example.com ["пароль"]');
  console.error("Скрипт удаляет всех пользователей — флаг --yes подтверждает это.");
  process.exit(1);
}

if (password && password.length < 8) {
  console.error("Пароль должен быть не короче 8 символов.");
  process.exit(1);
}

const plain = password ?? crypto.randomBytes(12).toString("base64url");

const root = process.cwd();
const dataDir = process.env.DATA_DIR ?? path.join(root, "data");
const dbFile = path.join(dataDir, "shop.db");

if (!fs.existsSync(dbFile)) {
  console.error(`База не найдена: ${dbFile}`);
  process.exit(1);
}

const db = new Database(dbFile);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Те же параметры argon2id, что в src/server/auth/password.ts.
const passwordHash = await hash(plain, {
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
});

const normalizedEmail = email.trim().toLowerCase();
const now = new Date().toISOString();

const removed = db.transaction(() => {
  const count = db.prepare("DELETE FROM users").run().changes;
  db.prepare(
    `INSERT INTO users (id, email, password_hash, name, phone, role, created_at, email_verified_at)
     VALUES (?, ?, ?, '', '', 'admin', ?, ?)`,
  ).run(crypto.randomBytes(9).toString("base64url"), normalizedEmail, passwordHash, now, now);
  return count;
})();

db.close();

console.log(`Удалено учётных записей: ${removed}`);
console.log(`Администратор: ${normalizedEmail}`);
if (!password) console.log(`Временный пароль: ${plain}`);
console.log("Вход — на сайте: /account/login. Панель управления после входа: /admin");
