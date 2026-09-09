/**
 * Наполнение справочников каталога: цвета, размерные сетки, модельные линии
 * и категории.
 *
 *   npm run seed
 *
 * Скрипт идемпотентен: повторный запуск обновляет названия и порядок,
 * но не трогает уже заведённые SEO-тексты и не плодит дубли.
 *
 * Здесь только структура — названия, слаги, размеры. Описания и
 * SEO-тексты пишутся вручную через админку: сгенерированные пачкой
 * тексты Яндекс распознаёт как шаблонные и в индекс не берёт.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import Database from "better-sqlite3";

const id = () => crypto.randomBytes(9).toString("base64url");
const now = new Date().toISOString();

// ─── Цвета ───────────────────────────────────────────────────────────────────
// `group` сворачивает оттенки в один фильтр: Black, Onyx и Metallic Black
// для покупателя — «чёрные», и посадочная страница нужна одна, а не три.
const COLORS = [
  { slug: "chernye", title: "Black", group: "Чёрные", hex: "#1a1a1a" },
  { slug: "chernye", title: "Metallic Black", group: "Чёрные", hex: "#232326" },
  { slug: "chernye", title: "Onyx", group: "Чёрные", hex: "#0f0f10" },
  { slug: "korichnevye", title: "Chestnut", group: "Коричневые", hex: "#a05c33" },
  { slug: "korichnevye", title: "Chocolate", group: "Коричневые", hex: "#4b3226" },
  { slug: "korichnevye", title: "Hickory", group: "Коричневые", hex: "#8a6a4a" },
  { slug: "korichnevye", title: "Mustard Seed", group: "Коричневые", hex: "#b8894a" },
  { slug: "serye", title: "Grey", group: "Серые", hex: "#8b8b8b" },
  { slug: "serye", title: "Smoke Plume", group: "Серые", hex: "#9a938c" },
  { slug: "serye", title: "Cobble Grey", group: "Серые", hex: "#6f6b66" },
  { slug: "bezhevye", title: "Sand", group: "Бежевые", hex: "#d8c3a5" },
  { slug: "bezhevye", title: "Whitecap", group: "Бежевые", hex: "#e8ddd0" },
  { slug: "bezhevye", title: "Dune", group: "Бежевые", hex: "#cdbda4" },
  { slug: "bezhevye", title: "Natural", group: "Бежевые", hex: "#e3d5bf" },
  { slug: "belye", title: "White", group: "Белые", hex: "#f5f3f0" },
  { slug: "belye", title: "Jasmine White", group: "Белые", hex: "#faf7f2" },
  { slug: "sinie", title: "Navy", group: "Синие", hex: "#2b3550" },
  { slug: "sinie", title: "Big Sky", group: "Синие", hex: "#7d9cc0" },
  { slug: "rozovye", title: "Pink", group: "Розовые", hex: "#e3b7bd" },
  { slug: "krasnye", title: "Red", group: "Красные", hex: "#a83232" },
];

// ─── Размерные сетки ─────────────────────────────────────────────────────────
// Длина стельки — главный ориентир: покупатель меряет стопу линейкой, а не
// подбирает европейский размер наугад. Именно из-за этого столбца страница
// «размерная сетка UGG» собирает столько трафика.
const SIZE_CHARTS = [
  {
    slug: "women",
    title: "Женская размерная сетка UGG",
    gender: "women",
    rows: [
      { sizeEu: 35, sizeUs: "5", sizeUk: "3.5", insoleCm: 22.5 },
      { sizeEu: 36, sizeUs: "6", sizeUk: "4.5", insoleCm: 23 },
      { sizeEu: 37, sizeUs: "6.5", sizeUk: "5", insoleCm: 23.5 },
      { sizeEu: 38, sizeUs: "7", sizeUk: "5.5", insoleCm: 24.5 },
      { sizeEu: 39, sizeUs: "8", sizeUk: "6.5", insoleCm: 25 },
      { sizeEu: 40, sizeUs: "9", sizeUk: "7.5", insoleCm: 25.5 },
      { sizeEu: 41, sizeUs: "10", sizeUk: "8.5", insoleCm: 26.5 },
      { sizeEu: 42, sizeUs: "11", sizeUk: "9.5", insoleCm: 27 },
    ],
  },
  {
    slug: "men",
    title: "Мужская размерная сетка UGG",
    gender: "men",
    rows: [
      { sizeEu: 39, sizeUs: "6", sizeUk: "5.5", insoleCm: 25 },
      { sizeEu: 40, sizeUs: "7", sizeUk: "6.5", insoleCm: 25.5 },
      { sizeEu: 41, sizeUs: "8", sizeUk: "7.5", insoleCm: 26.5 },
      { sizeEu: 42, sizeUs: "9", sizeUk: "8.5", insoleCm: 27 },
      { sizeEu: 43, sizeUs: "10", sizeUk: "9.5", insoleCm: 28 },
      { sizeEu: 44, sizeUs: "11", sizeUk: "10.5", insoleCm: 28.5 },
      { sizeEu: 45, sizeUs: "12", sizeUk: "11.5", insoleCm: 29.5 },
      { sizeEu: 46, sizeUs: "13", sizeUk: "12.5", insoleCm: 30 },
    ],
  },
  {
    slug: "kids",
    title: "Детская размерная сетка UGG",
    gender: "kids",
    rows: [
      { sizeEu: 22, sizeUs: "6", sizeUk: "5", insoleCm: 13.5 },
      { sizeEu: 23, sizeUs: "7", sizeUk: "6", insoleCm: 14.5 },
      { sizeEu: 25, sizeUs: "8", sizeUk: "7", insoleCm: 15.5 },
      { sizeEu: 26, sizeUs: "9", sizeUk: "8", insoleCm: 16.5 },
      { sizeEu: 27, sizeUs: "10", sizeUk: "9", insoleCm: 17 },
      { sizeEu: 28, sizeUs: "11", sizeUk: "10", insoleCm: 18 },
      { sizeEu: 30, sizeUs: "12", sizeUk: "11", insoleCm: 19 },
      { sizeEu: 31, sizeUs: "13", sizeUk: "12", insoleCm: 19.5 },
      { sizeEu: 32, sizeUs: "1", sizeUk: "13", insoleCm: 20.5 },
      { sizeEu: 33, sizeUs: "2", sizeUk: "1", insoleCm: 21 },
      { sizeEu: 34, sizeUs: "3", sizeUk: "2", insoleCm: 21.5 },
    ],
  },
];

// ─── Модельные линии ─────────────────────────────────────────────────────────
// Линия живёт сразу в нескольких разделах: Classic Mini выпускается и в
// женском, и в мужском, и в детском варианте, а размерная сетка у них разная.
const MODEL_LINES = [
  { slug: "classic", title: "Classic", genders: ["women", "men", "kids"] },
  { slug: "ultra-mini", title: "Classic Ultra Mini", genders: ["women", "men"] },
  { slug: "bailey-bow", title: "Bailey Bow", genders: ["women", "kids"] },
  { slug: "bailey-button", title: "Bailey Button", genders: ["women", "kids"] },
  { slug: "tasman", title: "Tasman", genders: ["women", "men"] },
  { slug: "neumel", title: "Neumel", genders: ["women", "men", "kids"] },
  { slug: "tazz", title: "Tazz", genders: ["women"] },
  { slug: "lowmel", title: "Lowmel", genders: ["women", "men"] },
  { slug: "hybrid", title: "Weather Hybrid", genders: ["women", "men", "kids"] },
  { slug: "blaise", title: "Blaise", genders: ["women"] },
  { slug: "classic-cardy", title: "Classic Cardy", genders: ["women"] },
  { slug: "slipper", title: "Slipper", genders: ["women", "men"] },
  { slug: "slide", title: "Slide", genders: ["women"] },
];

// ─── Категории ───────────────────────────────────────────────────────────────
// Слаг уникален внутри раздела, а не глобально: /catalog/zhenskie/classic-mini
// и /catalog/muzhskie/classic-mini — два разных адреса под два разных запроса.
//
// `aliases` — синонимы и словоформы, по которым ищут то же самое. Они
// отдаются редиректом на эту категорию, а не отдельной страницей: у
// конкурента classic-short, classic-short-2, classic-short-uggi и
// korotkie-uggi существуют одновременно и отбирают позиции друг у друга.
const CATEGORIES = [
  // ── Женские ──
  { section: "zhenskie", slug: "classic-mini", title: "UGG Classic Mini", aliases: ["mini-uggi", "klassicheskie-mini"] },
  { section: "zhenskie", slug: "classic-short", title: "UGG Classic Short", aliases: ["korotkie-uggi", "classic-short-uggi"] },
  { section: "zhenskie", slug: "classic-tall", title: "UGG Classic Tall", aliases: ["vysokie-uggi", "dlinnye-uggi"] },
  { section: "zhenskie", slug: "ultra-mini", title: "UGG Classic Ultra Mini", aliases: [] },
  { section: "zhenskie", slug: "classic-clear-mini", title: "UGG Classic Clear Mini", aliases: [] },
  { section: "zhenskie", slug: "bailey-bow", title: "UGG Bailey Bow", aliases: ["uggi-s-bantom", "uggi-s-lentoy"] },
  { section: "zhenskie", slug: "mini-bailey-bow", title: "UGG Mini Bailey Bow", aliases: [] },
  { section: "zhenskie", slug: "bailey-button", title: "UGG Bailey Button", aliases: ["uggi-s-pugovitsey"] },
  { section: "zhenskie", slug: "bailey-button-triplet", title: "UGG Bailey Button Triplet", aliases: [] },
  { section: "zhenskie", slug: "mini-bailey-button", title: "UGG Mini Bailey Button", aliases: [] },
  { section: "zhenskie", slug: "zip", title: "UGG с молнией", aliases: ["uggi-s-molniey"] },
  { section: "zhenskie", slug: "blaise", title: "UGG Blaise", aliases: [] },
  { section: "zhenskie", slug: "tazz", title: "UGG Tazz", aliases: [] },
  { section: "zhenskie", slug: "na-platforme", title: "UGG на платформе", aliases: ["uggi-na-platforme", "ultra-mini-platform"] },
  { section: "zhenskie", slug: "tasman", title: "UGG Tasman", aliases: [] },
  { section: "zhenskie", slug: "neumel", title: "UGG Neumel", aliases: ["neumel-boots-women"] },
  { section: "zhenskie", slug: "vyazanye", title: "Вязаные UGG", aliases: ["classic-cardy", "vyazannye-uggi", "classic-argyle-knit"] },
  { section: "zhenskie", slug: "s-mehom-lisy", title: "UGG с мехом лисы", aliases: ["uggi-s-mekhom-lisy"] },
  { section: "zhenskie", slug: "s-payetkami", title: "UGG с пайетками", aliases: ["sparkles", "uggi-s-payetkami"] },
  { section: "zhenskie", slug: "so-strazami", title: "UGG со стразами", aliases: ["uggi-so-strazami", "s-kristallami"] },
  { section: "zhenskie", slug: "tapochki", title: "Домашние тапочки UGG", aliases: ["uggi-domashnie-tapochki", "slippers"] },
  { section: "zhenskie", slug: "mokasiny", title: "Мокасины UGG", aliases: ["uggi-mokasiny-zhenskie", "dakota", "ansley"] },
  { section: "zhenskie", slug: "krossovki", title: "Кроссовки UGG Lowmel", aliases: ["lowmel", "krossovki-ugg", "slipony"] },
  { section: "zhenskie", slug: "hybrid", title: "UGG Weather Hybrid", aliases: ["ugg-hybrid", "neumel-hybrid"] },
  { section: "zhenskie", slug: "letnie", title: "Летние UGG", aliases: ["slide", "ugg-letnyaya-kollektsiya"] },
  { section: "zhenskie", slug: "kollaboracii", title: "Коллаборации UGG", aliases: ["jimmy-choo", "star-wars", "palace"] },

  // ── Мужские ──
  { section: "muzhskie", slug: "neumel", title: "UGG Neumel мужские", aliases: ["neumel-boots"] },
  { section: "muzhskie", slug: "neumel-flex", title: "UGG Neumel Flex", aliases: [] },
  { section: "muzhskie", slug: "neumel-snapback", title: "UGG Neumel Snapback", aliases: [] },
  { section: "muzhskie", slug: "classic-short", title: "UGG Classic Short мужские", aliases: ["classic-short-muzh"] },
  { section: "muzhskie", slug: "classic-mini", title: "UGG Classic Mini мужские", aliases: ["classic-mini-muzh"] },
  { section: "muzhskie", slug: "ultra-mini", title: "UGG Ultra Mini мужские", aliases: ["ultra-mini-men-s"] },
  { section: "muzhskie", slug: "zip", title: "UGG с молнией мужские", aliases: ["muzhskie-zip"] },
  { section: "muzhskie", slug: "capulin", title: "UGG Capulin", aliases: [] },
  { section: "muzhskie", slug: "ailen", title: "UGG Ailen", aliases: [] },
  { section: "muzhskie", slug: "beckham", title: "UGG Beckham", aliases: [] },
  { section: "muzhskie", slug: "hannen", title: "UGG Hannen", aliases: [] },
  { section: "muzhskie", slug: "stoneman", title: "UGG Stoneman", aliases: ["polson"] },
  { section: "muzhskie", slug: "tasman", title: "UGG Tasman мужские", aliases: [] },
  { section: "muzhskie", slug: "tapochki", title: "Домашние тапочки UGG мужские", aliases: ["mens-slippers"] },
  { section: "muzhskie", slug: "krossovki", title: "Кроссовки UGG Lowmel мужские", aliases: ["ugg-men-lowmel"] },
  { section: "muzhskie", slug: "hybrid", title: "UGG Hybrid мужские", aliases: ["ugg-mens-hybrid"] },

  // ── Детские ──
  { section: "detskie", slug: "neumel", title: "UGG Kids Neumel", aliases: ["kids-neumel-boots"] },
  { section: "detskie", slug: "gita", title: "UGG Kids Gita", aliases: ["kids-gita"] },
  { section: "detskie", slug: "classic-tall", title: "UGG Kids Classic Tall", aliases: ["kids-tall"] },
  { section: "detskie", slug: "bailey-button-triplet", title: "UGG Kids Bailey Button Triplet", aliases: [] },
  { section: "detskie", slug: "classic-clear-mini", title: "UGG Kids Classic Clear Mini", aliases: [] },
  { section: "detskie", slug: "hybrid", title: "UGG Kids Hybrid", aliases: ["ugg-kids-hybrid"] },
  { section: "detskie", slug: "baby", title: "UGG для малышей", aliases: ["baby-erin", "uggi-dlya-novorozhdennyh", "pinetki"] },

  // ── Аксессуары ──
  { section: "aksessuary", slug: "perchatki", title: "Перчатки UGG", aliases: ["kozhanye-perchatki"] },
  { section: "aksessuary", slug: "varezhki", title: "Варежки UGG", aliases: [] },
  { section: "aksessuary", slug: "naushniki", title: "Меховые наушники UGG", aliases: ["earmuffs", "mekhovye-naushniki"] },
  { section: "aksessuary", slug: "shapki", title: "Шапки UGG", aliases: ["shapka"] },
  { section: "aksessuary", slug: "sharfy", title: "Шарфы UGG", aliases: ["sharf"] },
  { section: "aksessuary", slug: "snudy", title: "Снуды UGG", aliases: ["snud"] },
  { section: "aksessuary", slug: "sumki", title: "Сумки UGG", aliases: ["sumki-ugg"] },
  { section: "aksessuary", slug: "koshelki", title: "Кошельки UGG", aliases: ["koshelek-wallet"] },
  { section: "aksessuary", slug: "uhod", title: "Средства по уходу UGG", aliases: ["care-kit", "sredstva-po-ukhodu"] },
];

// ─────────────────────────────────────────────────────────────────────────────

const root = process.cwd();
const db = new Database(path.join(root, "data", "shop.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(fs.readFileSync(path.join(root, "db", "schema.sql"), "utf8"));

const seed = db.transaction(() => {
  // Цвета: ключ — пара «слаг группы + название оттенка».
  const findColor = db.prepare("SELECT id FROM colors WHERE slug = ? AND title = ?");
  const insertColor = db.prepare(
    'INSERT INTO colors (id, slug, title, "group", hex) VALUES (?, ?, ?, ?, ?)',
  );
  const updateColor = db.prepare(
    'UPDATE colors SET "group" = ?, hex = ? WHERE id = ?',
  );

  for (const color of COLORS) {
    const existing = findColor.get(color.slug, color.title);
    if (existing) updateColor.run(color.group, color.hex, existing.id);
    else insertColor.run(id(), color.slug, color.title, color.group, color.hex);
  }

  // Размерные сетки.
  const findChart = db.prepare("SELECT id FROM size_charts WHERE slug = ?");
  const insertChart = db.prepare(
    "INSERT INTO size_charts (id, slug, title, gender, rows) VALUES (?, ?, ?, ?, ?)",
  );
  const updateChart = db.prepare(
    "UPDATE size_charts SET title = ?, gender = ?, rows = ? WHERE id = ?",
  );

  const chartIds = {};
  for (const chart of SIZE_CHARTS) {
    const rows = JSON.stringify(chart.rows);
    const existing = findChart.get(chart.slug);
    if (existing) {
      updateChart.run(chart.title, chart.gender, rows, existing.id);
      chartIds[chart.slug] = existing.id;
    } else {
      const newId = id();
      insertChart.run(newId, chart.slug, chart.title, chart.gender, rows);
      chartIds[chart.slug] = newId;
    }
  }

  // Модельные линии. Сетка привязывается по первому указанному полу.
  const findLine = db.prepare("SELECT id FROM model_lines WHERE slug = ?");
  const insertLine = db.prepare(
    `INSERT INTO model_lines (id, slug, title, description, genders, size_chart_id, sort_order)
     VALUES (?, ?, ?, '', ?, ?, ?)`,
  );
  const updateLine = db.prepare(
    "UPDATE model_lines SET title = ?, genders = ?, size_chart_id = ?, sort_order = ? WHERE id = ?",
  );

  MODEL_LINES.forEach((line, index) => {
    const chartId = chartIds[line.genders[0] === "kids" ? "kids" : line.genders[0]] ?? null;
    const genders = JSON.stringify(line.genders);
    const existing = findLine.get(line.slug);
    if (existing) updateLine.run(line.title, genders, chartId, index, existing.id);
    else insertLine.run(id(), line.slug, line.title, genders, chartId, index);
  });

  // Категории. SEO-поля при обновлении не трогаем: их заполняют вручную,
  // и перезапись сидом стёрла бы работу редактора.
  const findCategory = db.prepare(
    "SELECT id FROM categories WHERE section_slug = ? AND slug = ?",
  );
  const insertCategory = db.prepare(
    `INSERT INTO categories
       (id, slug, section_slug, title, short_title, description, image,
        sort_order, is_published, aliases, seo, created_at, updated_at)
     VALUES (?, ?, ?, ?, NULL, '', NULL, ?, 1, ?, '{}', ?, ?)`,
  );
  const updateCategory = db.prepare(
    "UPDATE categories SET title = ?, aliases = ?, sort_order = ?, updated_at = ? WHERE id = ?",
  );

  CATEGORIES.forEach((category, index) => {
    const aliases = JSON.stringify(category.aliases);
    const existing = findCategory.get(category.section, category.slug);
    if (existing) {
      updateCategory.run(category.title, aliases, index, now, existing.id);
    } else {
      insertCategory.run(
        id(),
        category.slug,
        category.section,
        category.title,
        index,
        aliases,
        now,
        now,
      );
    }
  });
});

seed();

const count = (table) =>
  db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get().c;

console.log("Справочники наполнены:");
console.log(`  цветов:           ${count("colors")}`);
console.log(`  размерных сеток:  ${count("size_charts")}`);
console.log(`  модельных линий:  ${count("model_lines")}`);
console.log(`  категорий:        ${count("categories")}`);

// Проверка на конфликт слагов внутри раздела — схема его не поймает,
// если два раздела используют одно имя, а это как раз норма.
const dupes = db
  .prepare(
    `SELECT section_slug, slug, COUNT(*) AS c FROM categories
     GROUP BY section_slug, slug HAVING c > 1`,
  )
  .all();
if (dupes.length) {
  console.error("Найдены дубли слагов:", dupes);
  process.exit(1);
}

db.close();
