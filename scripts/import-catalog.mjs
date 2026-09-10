/**
 * Заливка каталога из файла с фактическими данными.
 *
 *   npm run import-catalog -- "C:\путь\к\catalog.json"
 *   npm run import-catalog -- "C:\путь" --dry        — только показать разбор
 *   npm run import-catalog -- "C:\путь" --stock 3    — остаток на каждый размер
 *   npm run import-catalog -- --clear                — убрать залитое этим скриптом
 *
 * Формат входного файла — массив объектов:
 *   { name, sku, price, inStock, gender, category, color,
 *     sizes: [{ eu, us, insoleCm }] }
 *
 * Заливаются только факты: название, артикул, цена, размерный ряд, длина
 * стельки. Описания и SEO-тексты остаются пустыми — их пишут вручную через
 * админку. Пачка сгенерированных описаний Яндексу видна как шаблонная,
 * в индекс такие страницы не идут, и заполнить их «чем-нибудь» хуже, чем
 * оставить пустыми.
 *
 * Фотографий у залитых карточек нет: витрина показывает «Фото скоро».
 * Когда снимки появятся — `npm run import-photos` расставит их по артикулам.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import Database from "better-sqlite3";

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const SOURCE = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--stock");
const DRY_RUN = flag("--dry");
const CLEAR = flag("--clear");
/**
 * Остаток, который проставляется каждому размеру. Это заглушка: источник
 * знает только «есть/нет», а не количество. Перед запуском продаж остатки
 * нужно выставить по своему складу — иначе магазин продаст то, чего нет.
 */
const STOCK = Number(value("--stock", 3));

const root = process.cwd();
const db = new Database(path.join(process.env.DATA_DIR ?? path.join(root, "data"), "shop.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const id = () => crypto.randomBytes(9).toString("base64url");
const now = new Date().toISOString();

// ─── Очистка ─────────────────────────────────────────────────────────────────
// Признак залитого импортом товара — заполненный sku при пустом описании.
// Отдельного столбца под «источник» заводить не стали: он нужен ровно один
// раз, а лишний столбец пришлось бы тащить в схеме навсегда.
if (CLEAR) {
  const removed = db
    .prepare("DELETE FROM products WHERE description = '' AND images = '[]' AND sku IS NOT NULL")
    .run();
  console.log(`Удалено карточек: ${removed.changes}`);
  db.close();
  process.exit(0);
}

if (!SOURCE || !fs.existsSync(SOURCE)) {
  console.error('Укажите файл с данными: npm run import-catalog -- "C:\\путь\\catalog.json"');
  process.exit(1);
}

const source = JSON.parse(fs.readFileSync(SOURCE, "utf8"));
console.log(`Записей в файле: ${source.length}\n`);

// ─── Разделы ─────────────────────────────────────────────────────────────────
// Аксессуаров в магазине нет: раздел заменён распродажей, и записи с
// таким полом пропускаются при заливке.
const SECTIONS = {
  Женские: { gender: "women", section: "zhenskie" },
  Мужские: { gender: "men", section: "muzhskie" },
  Детские: { gender: "kids", section: "detskie" },
};

// ─── Категории источника → наши ──────────────────────────────────────────────
// Ключ — «раздел/категория» как они пришли в файле.
const CATEGORY_MAP = {
  "zhenskie/Тапочки": "tapochki",
  "zhenskie/Слипоны": "slipony",
  "zhenskie/Ботинки": "botinki",
  "zhenskie/Мини": "mini",
  "zhenskie/На платформе": "na-platforme",
  "zhenskie/Ультра мини": "ultra-mini",
  "zhenskie/Босоножки": "bosonozhki",
  "zhenskie/Гибриды": "gibridy",
  "zhenskie/Средние": "srednie",
  "zhenskie/Высокие": "vysokie",
  "zhenskie/Мокасины": "mokasiny",
  "zhenskie/Вязаные": "vyazanye",
  "zhenskie/Силиконовые": "silikonovye",
  "zhenskie/С бантом": "s-bantom",
  "zhenskie/С молнией": "s-molniey",
  "zhenskie/С пуговицами": "srednie-s-pugovicami",
  "zhenskie/Средние с пуговицами": "srednie-s-pugovicami",
  "zhenskie/Мини с пуговицами": "mini-s-pugovicami",
  "zhenskie/Новинки": "novinki",
  "zhenskie/Новинки 2026": "novinki",

  "muzhskie/Ботинки": "botinki",
  "muzhskie/Тапочки": "tapochki",
  "muzhskie/Мини": "mini",
  "muzhskie/Ультра мини": "ultra-mini",
  "muzhskie/Средние": "srednie",
  "muzhskie/Гибриды": "gibridy",
  "muzhskie/Слипоны": "slipony",
  "muzhskie/Мокасины": "mokasiny",
  "muzhskie/Новинки": "novinki",

  // Детская сетка у нас короче: мини и средние — это всё «классические».
  "detskie/Ботинки": "botinki",
  "detskie/Классические": "klassicheskie",
  "detskie/Мини": "klassicheskie",
  "detskie/Средние": "klassicheskie",
  "detskie/С пуговицами": "s-pugovicami",
  "detskie/Пинетки": "pinetki",
  "detskie/Новинки": "novinki",

};

/** Запасной разбор по названию — для товаров, пришедших без категории. */
const CATEGORY_RULES = [

  [/пинетк|\bbaby\b|sparrow|erin/i, { detskie: "pinetki" }],

  [/flip.?flop|\bslide\b|sandal|босонож/i, { zhenskie: "bosonozhki", muzhskie: "slipony" }],
  [/ultra.?mini/i, { zhenskie: "ultra-mini", muzhskie: "ultra-mini" }],
  [/bailey.?bow/i, { zhenskie: "s-bantom" }],
  [/bailey.?button|triplet/i, { zhenskie: "srednie-s-pugovicami", detskie: "s-pugovicami" }],
  [/\btall\b/i, { zhenskie: "vysokie" }],
  [/\bshort\b/i, { zhenskie: "srednie", muzhskie: "srednie" }],
  [/\bmini\b/i, { zhenskie: "mini", muzhskie: "mini", detskie: "klassicheskie" }],
  [/platform|tazz|funkette|disquette/i, { zhenskie: "na-platforme" }],
  [/tasman|slipper|scuff|coquette|ansley|fluff|alena|hailey|ascot|stitch slip/i, {
    zhenskie: "tapochki",
    muzhskie: "tapochki",
  }],
  [/lowmel|trainer|sneaker|slip.?on|hayden/i, { zhenskie: "slipony", muzhskie: "slipony" }],
  [/hybrid|weather/i, { zhenskie: "gibridy", muzhskie: "gibridy" }],
  [/dakota|moccasin|мокасин/i, { zhenskie: "mokasiny", muzhskie: "mokasiny" }],
  [/cardy|knit|вязан/i, { zhenskie: "vyazanye" }],
  [/clear/i, { zhenskie: "silikonovye" }],
  [/neumel|boot|ботинк|chukka|capitan|venture/i, {
    zhenskie: "botinki",
    muzhskie: "botinki",
    detskie: "botinki",
  }],
];

/** Куда сложить товар, если раздел есть, а категории нет. */
const FALLBACK = {
  zhenskie: "novinki",
  muzhskie: "novinki",
  detskie: "novinki",
};

// ─── Цвета ───────────────────────────────────────────────────────────────────
// Оттенок определяется по всему названию, а не по вычлененному полю: в
// исходных данных оно местами прихватывало кусок модели. Порядок правил
// важен — частное перед общим, иначе Mustard Seed уедет в жёлтые.
const COLOR_RULES = [
  [/mustard seed|chestnut|chocolate|hickory|cappuccino|molasses|bison|cocoa|camel|\bcoco\b|rocky oak|burnt cedar|caramel|brown|коричнев/i, "korichnevye", "Коричневые", "#a05c33"],
  [/metallic black|\bonyx\b|obsidian|\bblack\b|чёрн|черн/i, "chernye", "Чёрные", "#1a1a1a"],
  [/charcoal|thundercloud|cobble|\bsmoke\b|smoke plume|\bgrey\b|\bgray\b|dark ice|\bshade\b|сер(ый|ые|ая)/i, "serye", "Серые", "#8b8b8b"],
  [/whitecap|jasmine white|\bwhite\b|\bбел/i, "belye", "Белые", "#f5f3f0"],
  [/\bsand\b|natural|\bdune\b|beige|birch|cream|antilope|magnolia|бежев/i, "bezhevye", "Бежевые", "#d8c3a5"],
  [/\bnavy\b|caspian|big sky|cornflower|\bblue\b|син(ий|ие|яя)/i, "sinie", "Синие", "#2b3550"],
  [/moss green|dark green|olive|kh?aki|\bgreen\b|clover|alpine|parakeet|ceramic|зелён|зелен/i, "zelenye", "Зелёные", "#4f5f42"],
  [/bordo|бордо|poppy|strawberry|watermelon|lava|\bred\b|красн/i, "krasnye", "Красные", "#a83232"],
  [/\brose\b|rock rose|\bpink\b|розов/i, "rozovye", "Розовые", "#e3b7bd"],
  [/sulfur|apricot|\bgold\b|\byellow\b|жёлт|желт/i, "zheltye", "Жёлтые", "#d8b34a"],
  [/purple|violet|фиолет/i, "fioletovye", "Фиолетовые", "#6b4c8a"],
  [/orange|оранж/i, "oranzhevye", "Оранжевые", "#d1732f"],
];

/** Оттенки, которые не стыдно показать покупателю как есть. */
const CLEAN_SHADES = new Set(
  [
    "Black", "Metallic Black", "Onyx", "Chestnut", "Chocolate", "Hickory",
    "Mustard Seed", "Grey", "Smoke Plume", "Cobble Grey", "Smoke", "Sand",
    "Whitecap", "Dune", "Natural", "White", "Jasmine White", "Navy", "Big Sky",
    "Pink", "Red", "Khaki", "Cappuccino", "Burnt Olive", "Dusk", "Orange",
    "Beige", "Camel", "Antilope", "Caspian", "Coco", "Shaded Clover",
  ].map((s) => s.toLowerCase()),
);

// ─── Модельные линии ─────────────────────────────────────────────────────────
const LINE_RULES = [
  [/ultra.?mini/i, "ultra-mini"],
  [/bailey.?bow/i, "bailey-bow"],
  [/bailey.?button|triplet/i, "bailey-button"],
  [/\btasman\b|tazzelle/i, "tasman"],
  [/\btazz\b/i, "tazz"],
  [/neumel/i, "neumel"],
  [/lowmel/i, "lowmel"],
  [/hybrid|weather/i, "hybrid"],
  [/blaise/i, "blaise"],
  [/cardy/i, "classic-cardy"],
  [/slipper|scuff/i, "slipper"],
  [/\bslide\b|flip.?flop/i, "slide"],
  [/classic/i, "classic"],
];

// ─── Транслитерация для адреса ───────────────────────────────────────────────
const TRANSLIT = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[а-яё]/g, (ch) => TRANSLIT[ch] ?? "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "tovar";
}

// ─── Разбор ──────────────────────────────────────────────────────────────────
function resolveCategory(section, rawCategory, name) {
  const direct = CATEGORY_MAP[`${section}/${rawCategory}`];
  if (direct) return direct;

  for (const [pattern, targets] of CATEGORY_RULES) {
    if (pattern.test(name) && targets[section]) return targets[section];
  }
  return FALLBACK[section];
}

function resolveColor(name) {
  for (const [pattern, slug, group, hex] of COLOR_RULES) {
    if (pattern.test(name)) return { slug, group, hex };
  }
  return null;
}

function resolveLine(name) {
  for (const [pattern, slug] of LINE_RULES) if (pattern.test(name)) return slug;
  return null;
}

/** Ключ семьи «одна модель, разные цвета» — для блока «другие цвета». */
function familyKey(name, gender, shade) {
  let base = name.replace(/^UGG\s*/i, "").replace(/\([^)]*\)/g, " ");
  if (shade) base = base.replace(new RegExp(shade.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), " ");
  return `${gender}:${base.toLowerCase().replace(/[^a-zа-я0-9]/gi, "")}`;
}

// ─── Справочники из базы ─────────────────────────────────────────────────────
const categoryIds = new Map();
for (const row of db.prepare("SELECT id, section_slug, slug FROM categories").all()) {
  categoryIds.set(`${row.section_slug}/${row.slug}`, row.id);
}
const lineIds = new Map(
  db.prepare("SELECT id, slug FROM model_lines").all().map((r) => [r.slug, r.id]),
);
const colorIds = new Map(
  db.prepare('SELECT id, slug, title FROM colors').all().map((r) => [`${r.slug}|${r.title}`, r.id]),
);
const insertColor = db.prepare(
  'INSERT INTO colors (id, slug, title, "group", hex) VALUES (?, ?, ?, ?, ?)',
);

function colorId(match, rawShade) {
  if (!match) return null;
  const shade =
    rawShade && CLEAN_SHADES.has(rawShade.toLowerCase()) ? rawShade : match.group;
  const key = `${match.slug}|${shade}`;
  if (!colorIds.has(key)) {
    const newId = id();
    if (!DRY_RUN) insertColor.run(newId, match.slug, shade, match.group, match.hex);
    colorIds.set(key, newId);
  }
  return colorIds.get(key);
}

// ─── Подготовка записей ──────────────────────────────────────────────────────
const seenSku = new Set();
const seenSlug = new Set(db.prepare("SELECT slug FROM products").all().map((r) => r.slug));
const families = new Map();
const prepared = [];
const skipped = [];

for (const row of source) {
  const map = SECTIONS[row.gender];
  if (!map) {
    skipped.push(`${row.name}: неизвестный раздел «${row.gender}»`);
    continue;
  }
  if (!row.sku || seenSku.has(row.sku)) {
    skipped.push(`${row.name}: артикул пустой или повторяется`);
    continue;
  }
  seenSku.add(row.sku);

  const categorySlug = resolveCategory(map.section, row.category, row.name);
  const categoryId = categoryIds.get(`${map.section}/${categorySlug}`);
  if (!categoryId) {
    skipped.push(`${row.name}: нет категории ${map.section}/${categorySlug}`);
    continue;
  }

  const color = resolveColor(row.name);
  let slug = slugify(row.name);
  if (seenSlug.has(slug)) slug = `${slug}-${row.sku.toLowerCase()}`;
  seenSlug.add(slug);

  const key = familyKey(row.name, map.gender, row.color);
  families.set(key, (families.get(key) ?? 0) + 1);

  prepared.push({
    row,
    gender: map.gender,
    section: map.section,
    categorySlug,
    categoryId,
    color,
    slug,
    familyKey: key,
    lineSlug: resolveLine(row.name),
  });
}

// ─── Сводка ──────────────────────────────────────────────────────────────────
const bySection = {};
for (const item of prepared) {
  const k = `${item.section}/${item.categorySlug}`;
  bySection[k] = (bySection[k] ?? 0) + 1;
}
console.log("Разбор по категориям:");
for (const [k, v] of Object.entries(bySection).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(34)} ${v}`);
}
const noColor = prepared.filter((i) => !i.color).length;
console.log(`\nБез распознанного цвета: ${noColor}`);
console.log(`Семей «модель + цвета»:  ${[...families.values()].filter((n) => n > 1).length}`);
if (skipped.length) {
  console.log(`\nПропущено: ${skipped.length}`);
  skipped.slice(0, 5).forEach((s) => console.log(`  ${s}`));
}

if (DRY_RUN) {
  console.log("\nПробный запуск — в базу ничего не записано.");
  db.close();
  process.exit(0);
}

// ─── Запись ──────────────────────────────────────────────────────────────────
const insertProduct = db.prepare(
  `INSERT INTO products
     (id, slug, title, sku, description, gender, model_line_id, color_id,
      primary_category_id, group_id, materials, seasons, shaft_height_cm,
      heel_height_cm, price, old_price, images, weight, length, width, height,
      is_published, is_bestseller, rating_value, rating_count, seo,
      created_at, updated_at)
   VALUES (?, ?, ?, ?, '', ?, ?, ?, ?, ?, '[]', '[]', NULL, NULL, ?, NULL,
           '[]', NULL, NULL, NULL, NULL, ?, 0, NULL, 0, '{}', ?, ?)`,
);
const insertVariant = db.prepare(
  `INSERT INTO product_variants (id, product_id, size_eu, insole_cm, stock, barcode, marking_code)
   VALUES (?, ?, ?, ?, ?, NULL, NULL)`,
);
const insertLink = db.prepare(
  "INSERT OR IGNORE INTO product_categories (product_id, category_id) VALUES (?, ?)",
);
const existingSku = new Set(
  db.prepare("SELECT sku FROM products WHERE sku IS NOT NULL").all().map((r) => r.sku),
);

let created = 0;
let variants = 0;
let already = 0;

const run = db.transaction(() => {
  for (const item of prepared) {
    if (existingSku.has(item.row.sku)) {
      already++;
      continue;
    }

    const productId = id();
    // Идентификатор семьи проставляем только там, где цветов правда несколько:
    // одинокий group_id включил бы блок «другие цвета» с самим собой внутри.
    const groupId = families.get(item.familyKey) > 1 ? slugify(item.familyKey) : null;

    insertProduct.run(
      productId,
      item.slug,
      item.row.name,
      item.row.sku,
      item.gender,
      item.lineSlug ? (lineIds.get(item.lineSlug) ?? null) : null,
      colorId(item.color, item.row.color),
      item.categoryId,
      groupId,
      item.row.price,
      item.row.inStock ? 1 : 0,
      now,
      now,
    );
    insertLink.run(productId, item.categoryId);

    const sizes = item.row.sizes?.length
      ? item.row.sizes
      // У аксессуаров размера нет. Ноль — признак безразмерного товара:
      // витрина в этом случае не показывает выбор размера.
      : [{ eu: 0, insoleCm: null }];

    const seenSize = new Set();
    for (const size of sizes) {
      const eu = Number(size.eu ?? 0);
      if (seenSize.has(eu)) continue;
      seenSize.add(eu);
      insertVariant.run(
        id(),
        productId,
        eu,
        size.insoleCm ?? null,
        item.row.inStock ? STOCK : 0,
        );
      variants++;
    }
    created++;
  }
});

run();

console.log(`\nЗаведено карточек: ${created}`);
console.log(`Размеров:          ${variants}`);
if (already) console.log(`Уже были (по артикулу): ${already}`);
console.log(`\nОстатки проставлены заглушкой — по ${STOCK} шт. на размер.`);
console.log("Перед запуском продаж выставьте реальные остатки в админке.");
console.log("Описания и SEO-тексты пустые: их пишут вручную, пачкой они бесполезны.");
db.close();
