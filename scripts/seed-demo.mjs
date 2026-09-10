/**
 * Демонстрационные товары для проверки витрины.
 *
 *   npm run seed:demo          — создать
 *   npm run seed:demo -- --clear  — удалить
 *
 * Отдельный скрипт, а не часть основного сида: боевой каталог заводится
 * через админку, и демо-карточки не должны попасть в него случайно.
 * У всех демо-товаров слаг начинается с `demo-`, по нему же они и удаляются.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import Database from "better-sqlite3";
import sharp from "sharp";

const id = () => crypto.randomBytes(9).toString("base64url");
const now = new Date().toISOString();
const root = process.cwd();
const clear = process.argv.includes("--clear");

const db = new Database(path.join(process.env.DATA_DIR ?? path.join(root, "data"), "shop.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

if (clear) {
  const products = db
    .prepare("DELETE FROM products WHERE slug LIKE 'demo-%'")
    .run();
  const landings = db
    .prepare(
      "DELETE FROM seo_landings WHERE section_slug = 'zhenskie' AND category_slug = 'mini' AND facet_slug = 'chernye'",
    )
    .run();
  const orders = db.prepare("DELETE FROM orders WHERE id LIKE 'demo-%'").run();
  console.log(`Удалено демо-товаров: ${products.changes}`);
  console.log(`Удалено демо-посадочных: ${landings.changes}`);
  console.log(`Удалено демо-заказов: ${orders.changes}`);
  db.close();
  process.exit(0);
}

// ─── Картинки-заглушки ───────────────────────────────────────────────────────
// Настоящие фотографии загрузит владелец магазина. Здесь просто однотонные
// прямоугольники, чтобы проверить работу оптимизатора изображений.
const uploadsDir = path.join(root, "public", "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

async function placeholder(name, hex) {
  const file = path.join(uploadsDir, name);
  if (fs.existsSync(file)) return `/uploads/${name}`;

  await sharp({
    create: {
      width: 900,
      height: 900,
      channels: 3,
      background: hex,
    },
  })
    .jpeg({ quality: 80 })
    .toFile(file);

  return `/uploads/${name}`;
}


/** Осветлить цвет на заданное число пунктов — для набора разных кадров. */
function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const clamp = (v) => Math.max(0, Math.min(255, v + amount));
  const r = clamp((n >> 16) & 255);
  const g = clamp((n >> 8) & 255);
  const b = clamp(n & 255);
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

// ─── Демо-товары ─────────────────────────────────────────────────────────────
const DEMO = [
  {
    slug: "demo-classic-mini-chestnut",
    group: "demo-classic-mini",
    shots: 4,
    title: "UGG Classic Mini Chestnut",
    sku: "1016222-CHE",
    colorTitle: "Chestnut",
    hex: "#a05c33",
    price: 13990,
    oldPrice: 19990,
    category: { section: "zhenskie", slug: "mini" },
    sizes: [36, 37, 38, 39, 40],
    description:
      "Классические мини-угги из натуральной овчины. Высота голенища 17 см, " +
      "подошва Treadlite by UGG. Модель садится плотно и разнашивается по ноге.",
  },
  {
    slug: "demo-classic-mini-black",
    group: "demo-classic-mini",
    title: "UGG Classic Mini Black",
    sku: "1016222-BLK",
    colorTitle: "Black",
    hex: "#1a1a1a",
    price: 13990,
    oldPrice: null,
    category: { section: "zhenskie", slug: "mini" },
    sizes: [37, 38, 39],
    description:
      "Чёрные мини-угги из натуральной овчины. Универсальный вариант на " +
      "каждый день, не маркий и сочетается с любой верхней одеждой.",
  },
  // Ещё два чёрных оттенка — чтобы демо-посадочная «Чёрные Classic Mini»
  // набирала три товара в наличии и проходила порог публикации.
  {
    slug: "demo-classic-mini-onyx",
    group: "demo-classic-mini",
    title: "UGG Classic Mini Onyx",
    sku: "1016222-ONX",
    colorTitle: "Onyx",
    hex: "#0f0f10",
    price: 13990,
    oldPrice: null,
    category: { section: "zhenskie", slug: "mini" },
    sizes: [37, 38, 39],
    description:
      "Глубокий чёрный оттенок Onyx без отлива. Овчина внутри, замша снаружи.",
  },
  {
    slug: "demo-classic-mini-metallic",
    group: "demo-classic-mini",
    title: "UGG Classic Mini Metallic Black",
    sku: "1016222-MTB",
    colorTitle: "Metallic Black",
    hex: "#232326",
    price: 14990,
    oldPrice: null,
    category: { section: "zhenskie", slug: "mini" },
    sizes: [36, 37, 38],
    description:
      "Чёрная замша с металлическим напылением. Вариант на выход, " +
      "требует бережного ухода и обработки водоотталкивающим спреем.",
  },
  {
    slug: "demo-tasman-chestnut",
    group: "demo-tasman",
    title: "UGG Tasman Chestnut",
    sku: "5955-CHE",
    colorTitle: "Chestnut",
    hex: "#8a6a4a",
    price: 11990,
    oldPrice: 15990,
    category: { section: "zhenskie", slug: "tapochki" },
    sizes: [36, 38, 40],
    description:
      "Тапочки-слиперы Tasman с фирменным орнаментом по канту. " +
      "Носятся и дома, и на улице благодаря литой подошве.",
  },
];

// Длина стельки по женской сетке — переносится в карточку размера.
const INSOLE = { 35: 22.5, 36: 23, 37: 23.5, 38: 24.5, 39: 25, 40: 25.5, 41: 26.5, 42: 27 };

const findCategory = db.prepare(
  "SELECT id FROM categories WHERE section_slug = ? AND slug = ?",
);
const findColor = db.prepare("SELECT id FROM colors WHERE title = ?");
const findLine = db.prepare("SELECT id FROM model_lines WHERE slug = ?");
const findProduct = db.prepare("SELECT id FROM products WHERE slug = ?");

const insertProduct = db.prepare(
  `INSERT INTO products
     (id, slug, title, sku, description, gender, model_line_id, color_id,
      primary_category_id, group_id, materials, seasons, shaft_height_cm,
      heel_height_cm, price, old_price, images, weight, length, width, height,
      is_published, is_bestseller, rating_value, rating_count, seo,
      created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, 'women', ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?,
           900, 34, 23, 14, 1, ?, NULL, 0, '{}', ?, ?)`,
);
const insertLink = db.prepare(
  "INSERT OR IGNORE INTO product_categories (product_id, category_id) VALUES (?, ?)",
);
const insertVariant = db.prepare(
  `INSERT INTO product_variants (id, product_id, size_eu, insole_cm, stock)
   VALUES (?, ?, ?, ?, ?)`,
);

let created = 0;

for (const item of DEMO) {
  if (findProduct.get(item.slug)) continue;

  const category = findCategory.get(item.category.section, item.category.slug);
  if (!category) {
    console.error(
      `Категория ${item.category.section}/${item.category.slug} не найдена — сначала выполните npm run seed`,
    );
    process.exit(1);
  }

  // Первому товару даём несколько снимков разных оттенков — иначе под
  // главным кадром не видно полосу миниатюр.
  const images = item.shots
    ? await Promise.all(
        Array.from({ length: item.shots }, (_, i) =>
          placeholder(`${item.slug}-${i + 1}.jpg`, shade(item.hex, i * 14)),
        ),
      )
    : [await placeholder(`${item.slug}.jpg`, item.hex)];
  const color = findColor.get(item.colorTitle);
  const line = findLine.get(item.category.slug === "tapochki" ? "tasman" : "classic");
  const productId = id();

  db.transaction(() => {
    insertProduct.run(
      productId,
      item.slug,
      item.title,
      item.sku,
      item.description,
      line?.id ?? null,
      color?.id ?? null,
      category.id,
      // Цветовые вариации одной модели связываются общим groupId — на нём
      // строится блок «другие цвета» на карточке.
      item.group,
      JSON.stringify(["ovchina", "zamsha"]),
      JSON.stringify(["winter", "demi"]),
      17,
      item.price,
      item.oldPrice,
      JSON.stringify(images),
      item.slug.includes("classic-mini") ? 1 : 0,
      now,
      now,
    );

    insertLink.run(productId, category.id);

    for (const size of item.sizes) {
      insertVariant.run(id(), productId, size, INSOLE[size] ?? null, 3);
    }
  })();

  created += 1;
}

// ─── Демо-посадочная страница фильтра ────────────────────────────────────────
// Нужна, чтобы проверить порог публикации: страница открывается всегда,
// но в индекс попадает только при трёх и более товарах в наличии.
const LANDING_TEXT =
  "Чёрные мини-угги — самая практичная версия классической модели. " +
  "Тёмный замшевый верх не показывает следы реагентов и разводы от снега так, " +
  "как это делают светлые оттенки, поэтому пару проще носить каждый день в " +
  "городе. Внутри натуральная овчина: она подстраивается под температуру и " +
  "одинаково работает и в мороз, и в оттепель. Высота голенища около семнадцати " +
  "сантиметров — угги не мешают заправлять брюки и садятся плотно по ноге. " +
  "Подошва Treadlite by UGG заметно легче литой резины и не дубеет на холоде. " +
  "Размер стоит подбирать по длине стельки, а не по привычному европейскому " +
  "номеру: модель разнашивается примерно на треть размера.";

const landingExists = db
  .prepare(
    "SELECT id FROM seo_landings WHERE section_slug='zhenskie' AND category_slug='mini' AND facet_slug='chernye'",
  )
  .get();

if (!landingExists) {
  db.prepare(
    `INSERT INTO seo_landings
       (id, section_slug, category_slug, facet_slug, facet_type, facet_value,
        title, h1, meta_title, meta_description, seo_text, aliases,
        is_published, created_at, updated_at)
     VALUES (?, 'zhenskie', 'mini', 'chernye', 'color', 'chernye',
             ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
  ).run(
    id(),
    "Чёрные",
    "Чёрные UGG Classic Mini",
    "Чёрные UGG Classic Mini — купить в интернет-магазине",
    "Чёрные мини-угги UGG из натуральной овчины. Доставка по всей России.",
    LANDING_TEXT,
    JSON.stringify(["black"]),
    now,
    now,
  );
  console.log("Демо-посадочная создана: /catalog/zhenskie/mini/chernye");
}

// ─── Демо-заказ ──────────────────────────────────────────────────────────────
// Нужен, чтобы посмотреть страницу заказа в админке до появления оформления.
// Остатки не списывает: это иллюстрация, а не покупка.
if (!db.prepare("SELECT id FROM orders WHERE id = 'demo-order-1'").get()) {
  const chestnut = db
    .prepare("SELECT p.id, p.slug, p.title, p.price, p.images, v.id AS vid, v.size_eu FROM products p JOIN product_variants v ON v.product_id = p.id WHERE p.slug = 'demo-classic-mini-chestnut' AND v.size_eu = 38")
    .get();
  const tasman = db
    .prepare("SELECT p.id, p.slug, p.title, p.price, p.images, v.id AS vid, v.size_eu FROM products p JOIN product_variants v ON v.product_id = p.id WHERE p.slug = 'demo-tasman-chestnut' AND v.size_eu = 38")
    .get();

  if (chestnut && tasman) {
    const items = [chestnut, tasman].map((row) => ({
      productId: row.id,
      variantId: row.vid,
      title: row.title,
      slug: row.slug,
      sizeEu: row.size_eu,
      image: JSON.parse(row.images)[0] ?? null,
      price: row.price,
      quantity: 1,
    }));
    const subtotal = items.reduce((sum, item) => sum + item.price, 0);
    const deliveryPrice = 350;

    db.prepare(
      `INSERT INTO orders
         (id, number, user_id, customer, delivery, comment, items, subtotal, discount,
          delivery_price, package_weight, total, promocode, status, payment_status, cdek,
          created_at, updated_at)
       VALUES ('demo-order-1', 'UG-DEMO1', NULL, ?, ?, ?, ?, ?, 0, ?, 1800, ?, NULL,
               'new', 'unpaid', NULL, ?, ?)`,
    ).run(
      JSON.stringify({ name: "Анна Демидова", email: "demo@example.com", phone: "+7 900 000-00-00" }),
      JSON.stringify({
        mode: "pvz",
        cityCode: 44,
        city: "Москва",
        address: "ул. Тверская, 1",
        pointCode: "MSK123",
        periodMin: 2,
        periodMax: 4,
      }),
      "Позвоните перед доставкой, пожалуйста.",
      JSON.stringify(items),
      subtotal,
      deliveryPrice,
      subtotal + deliveryPrice,
      now,
      now,
    );
    console.log("Демо-заказ создан: /admin/orders/demo-order-1");
  }
}

console.log(`Демо-товаров создано: ${created}`);
console.log(
  `Всего в каталоге: ${db.prepare("SELECT COUNT(*) c FROM products").get().c}`,
);
db.close();
