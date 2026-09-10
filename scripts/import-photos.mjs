/**
 * Раскладка фотографий поставщика по товарам.
 *
 *   npm run import-photos -- "C:\путь\к\архиву-с-фото"
 *   npm run import-photos -- "C:\путь" --dry     — только показать, что будет
 *
 * Ищет снимки в присланной папке (включая вложенные), сопоставляет их с
 * товарами и раскладывает в public/uploads, прописывая пути в карточки.
 *
 * Сопоставление по трём признакам, в порядке надёжности:
 *   1. артикул в имени файла или в имени родительской папки
 *   2. слаг товара
 *   3. модель и цвет в имени папки — «Classic Ultra Mini — Chestnut»
 *
 * Порядок снимков внутри товара — по имени файла. Первый становится
 * главным в карточке, остальные попадают в галерею.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import Database from "better-sqlite3";
import sharp from "sharp";

const SOURCE = process.argv[2];
const DRY_RUN = process.argv.includes("--dry");

if (!SOURCE) {
  console.error('Укажите папку с фотографиями: npm run import-photos -- "C:\\путь"');
  process.exit(1);
}
if (!fs.existsSync(SOURCE)) {
  console.error(`Папка не найдена: ${SOURCE}`);
  process.exit(1);
}

const root = process.cwd();
const uploadsDir = path.join(root, "public", "uploads");
const db = new Database(path.join(process.env.DATA_DIR ?? path.join(root, "data"), "shop.db"));
db.pragma("journal_mode = WAL");

const PHOTO_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);
/** Ширина, до которой ужимаются снимки: больше для витрины не нужно. */
const MAX_WIDTH = 1600;

// ─── Товары из базы ──────────────────────────────────────────────────────────
const products = db
  .prepare(
    `SELECT p.id, p.slug, p.sku, p.title, c.title AS color
     FROM products p
     LEFT JOIN colors c ON c.id = p.color_id`,
  )
  .all();

if (products.length === 0) {
  console.error("В каталоге нет товаров — сначала заведите их через админку.");
  process.exit(1);
}

/** Строка к виду, пригодному для сравнения: только буквы и цифры. */
const key = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9]/gi, "");

// Указатели для быстрого поиска.
const bySku = new Map();
const bySlug = new Map();
const byModelColor = new Map();

for (const p of products) {
  if (p.sku) bySku.set(key(p.sku), p);
  bySlug.set(key(p.slug), p);
  // Два варианта ключа: с цветом и без. У большинства товаров цвет уже
  // входит в название, и связка «название + цвет» оказывалась длиннее
  // имени папки — совпадение не находилось.
  byModelColor.set(key(p.title), p);
  if (p.color) byModelColor.set(key(`${p.title}${p.color}`), p);
}

// ─── Обход присланной папки ──────────────────────────────────────────────────
function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (PHOTO_EXT.has(path.extname(entry.name).toLowerCase())) acc.push(full);
  }
  return acc;
}

const files = walk(SOURCE).sort();
console.log(`Снимков найдено: ${files.length}`);
console.log(`Товаров в каталоге: ${products.length}\n`);

/** Подобрать товар для файла — по артикулу, слагу или связке модель-цвет. */
function match(file) {
  const name = key(path.basename(file, path.extname(file)));
  const folder = key(path.basename(path.dirname(file)));

  // Артикул — самый надёжный признак: ищем его как подстроку.
  for (const [sku, product] of bySku) {
    if (sku.length >= 4 && (name.includes(sku) || folder.includes(sku))) {
      return { product, by: "артикул" };
    }
  }
  for (const [slug, product] of bySlug) {
    if (slug.length >= 6 && (name.includes(slug) || folder.includes(slug))) {
      return { product, by: "слаг" };
    }
  }
  // Сверяем в обе стороны: имя папки может быть и длиннее ключа
  // («UGG Classic Mini Chestnut 2024»), и короче его.
  for (const [mc, product] of byModelColor) {
    if (mc.length >= 8 && (folder.includes(mc) || mc.includes(folder))) {
      return { product, by: "модель и цвет" };
    }
  }
  return null;
}

const matched = new Map(); // id товара → список файлов
const orphans = [];
const stats = { артикул: 0, слаг: 0, "модель и цвет": 0 };

for (const file of files) {
  const hit = match(file);
  if (!hit) {
    orphans.push(file);
    continue;
  }
  stats[hit.by]++;
  const list = matched.get(hit.product.id) ?? [];
  list.push(file);
  matched.set(hit.product.id, list);
}

console.log("Сопоставлено:");
for (const [by, n] of Object.entries(stats)) if (n) console.log(`  по ${by}: ${n}`);
console.log(`  без пары: ${orphans.length}`);
console.log(`Товаров со снимками: ${matched.size} из ${products.length}\n`);

if (orphans.length) {
  const listFile = path.join(process.env.DATA_DIR ?? path.join(root, "data"), "photos-orphans.txt");
  fs.writeFileSync(listFile, orphans.join("\r\n"), "utf8");
  console.log(`Файлы без пары выписаны в ${path.relative(root, listFile)}`);
}

if (DRY_RUN) {
  console.log("\nПробный запуск — ничего не записано. Уберите --dry, чтобы применить.");
  db.close();
  process.exit(0);
}

// ─── Обработка и запись ──────────────────────────────────────────────────────
fs.mkdirSync(uploadsDir, { recursive: true });
const update = db.prepare("UPDATE products SET images = ?, updated_at = ? WHERE id = ?");
const now = new Date().toISOString();

let written = 0;
for (const [productId, list] of matched) {
  const urls = [];

  for (const file of list.sort()) {
    const name = `${crypto.randomBytes(8).toString("hex")}.webp`;
    const target = path.join(uploadsDir, name);
    try {
      await sharp(file)
        // withoutEnlargement: мелкие снимки не растягиваем — станут мыльными.
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(target);
      urls.push(`/uploads/${name}`);
    } catch (error) {
      console.error(`  не удалось обработать ${path.basename(file)}: ${error.message}`);
    }
  }

  if (urls.length) {
    update.run(JSON.stringify(urls), now, productId);
    written += urls.length;
  }
}

console.log(`\nЗаписано снимков: ${written}`);
console.log("Проверьте карточки в админке — порядок снимков там можно поменять.");
db.close();
