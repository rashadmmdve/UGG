/**
 * Заливка реквизитов и юридических текстов в настройки сайта.
 *
 *   npm run seed:legal
 *
 * Тексты берутся из docs/*-черновик.html, служебный комментарий в начале
 * файла отбрасывается. Остальные настройки витрины не трогаются — читаем
 * и перезаписываем только те поля, что заданы здесь.
 *
 * Скрипт идемпотентен: его же нужно будет запустить один раз на боевом
 * сервере, чтобы не переносить тексты через админку вручную.
 */
import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

const root = process.cwd();
const db = new Database(path.join(root, "data", "shop.db"));
db.pragma("journal_mode = WAL");

/** Убираем шапку-комментарий: она для нас, а не для покупателя. */
const readDoc = (name) =>
  fs
    .readFileSync(path.join(root, "docs", name), "utf8")
    .replace(/^\s*<!--[\s\S]*?-->\s*/, "")
    .trim();

const oferta = readDoc("oferta-черновик.html");
const privacy = readDoc("politika-черновик.html");

// Телефон в оферте остаётся подстановкой, пока номера нет: публиковать
// договор с дырой нельзя, поэтому пусть это видно невооружённым глазом.
const unfilled = [...oferta.matchAll(/\{[А-ЯЁ_]+\}/g)].map((m) => m[0]);
if (unfilled.length) {
  console.log(`Внимание: в оферте остались подстановки — ${[...new Set(unfilled)].join(", ")}`);
  console.log("Страница /oferta будет отдаваться с текстом как есть.\n");
}

const row = db.prepare("SELECT value FROM settings WHERE key = 'content'").get();
const content = row ? JSON.parse(row.value) : {};

content.contacts = {
  ...(content.contacts ?? {}),
  phone: content.contacts?.phone ?? "",
  email: "info@uggrussia.shop",
  address: "Республика Мордовия, г. Саранск, ул. Терешковой, д. 16, кв. 49",
  legalName: "ИП Абдуллаев Акиф Юнис Оглы",
  inn: "361902932899",
  ogrn: "317366800074557",
};
content.legal = { oferta, privacy };

db.prepare(
  `INSERT INTO settings (key, value) VALUES ('content', ?)
   ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
).run(JSON.stringify(content));

console.log("Реквизиты записаны:");
console.log(`  ${content.contacts.legalName}, ИНН ${content.contacts.inn}, ОГРНИП ${content.contacts.ogrn}`);
console.log(`Оферта: ${oferta.length} знаков, политика: ${privacy.length} знаков.`);
db.close();
