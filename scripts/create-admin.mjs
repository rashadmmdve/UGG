/**
 * Создание администратора.
 *
 *   npm run create-admin -- admin@example.com "пароль"
 *
 * Пароль и почта передаются аргументами, а не запрашиваются интерактивно:
 * под Git Bash на Windows чтение из stdin работает ненадёжно.
 *
 * Скрипт можно запускать повторно: если пользователь с такой почтой уже
 * есть, ему обновляется пароль и выставляется роль администратора.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import Database from "better-sqlite3";
import { hash } from "@node-rs/argon2";

const [email, password] = process.argv.slice(2);

if (!email || !password) {
  console.error('Использование: npm run create-admin -- admin@example.com "пароль"');
  process.exit(1);
}

if (password.length < 8) {
  console.error("Пароль должен быть не короче 8 символов.");
  process.exit(1);
}

const root = process.cwd();
const dataDir = process.env.DATA_DIR ?? path.join(root, "data");
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "shop.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(fs.readFileSync(path.join(root, "db", "schema.sql"), "utf8"));

// Те же параметры argon2id, что в src/server/auth/password.ts.
const passwordHash = await hash(password, {
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
});

const normalizedEmail = email.trim().toLowerCase();
const existing = db
  .prepare("SELECT id FROM users WHERE email = ?")
  .get(normalizedEmail);

if (existing) {
  db.prepare(
    "UPDATE users SET password_hash = ?, role = 'admin' WHERE id = ?",
  ).run(passwordHash, existing.id);
  console.log(`Пароль обновлён, роль администратора выдана: ${normalizedEmail}`);
} else {
  db.prepare(
    `INSERT INTO users (id, email, password_hash, name, phone, role, created_at)
     VALUES (?, ?, ?, '', '', 'admin', ?)`,
  ).run(
    crypto.randomBytes(9).toString("base64url"),
    normalizedEmail,
    passwordHash,
    new Date().toISOString(),
  );
  console.log(`Администратор создан: ${normalizedEmail}`);
}

db.close();
console.log("Вход в панель управления: /admin/login");
