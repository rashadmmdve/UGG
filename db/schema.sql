-- ── Пользователи ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL DEFAULT '',
  phone         TEXT NOT NULL DEFAULT '',
  role          TEXT NOT NULL DEFAULT 'customer',
  created_at    TEXT NOT NULL,
  -- Подтверждение почты: дата подтверждения и хеш живой ссылки.
  email_verified_at        TEXT,
  verify_token_hash        TEXT,
  verify_token_expires_at  TEXT,
  -- Восстановление пароля: хеш живой ссылки и её срок.
  reset_token_hash         TEXT,
  reset_token_expires_at   TEXT
);
-- Индекс по verify_token_hash создаётся в миграции (schema.ts), а не здесь:
-- на старой базе столбец появляется только после ALTER TABLE, и индекс
-- из DDL упал бы раньше него.

-- ── Справочники каталога ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id            TEXT PRIMARY KEY,
  slug          TEXT NOT NULL,
  section_slug  TEXT NOT NULL,
  title         TEXT NOT NULL,
  short_title   TEXT,
  description   TEXT NOT NULL DEFAULT '',
  image         TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  is_published  INTEGER NOT NULL DEFAULT 1,
  aliases       TEXT NOT NULL DEFAULT '[]',
  seo           TEXT NOT NULL DEFAULT '{}',
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  -- Слаг категории уникален внутри раздела: classic-mini существует
  -- и в женском, и в мужском разделе, и это два разных адреса.
  UNIQUE (section_slug, slug)
);

CREATE TABLE IF NOT EXISTS model_lines (
  id            TEXT PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  genders       TEXT NOT NULL DEFAULT '[]',
  size_chart_id TEXT REFERENCES size_charts(id) ON DELETE SET NULL,
  sort_order    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS colors (
  id     TEXT PRIMARY KEY,
  slug   TEXT NOT NULL,
  title  TEXT NOT NULL,
  "group" TEXT NOT NULL,
  hex    TEXT NOT NULL DEFAULT '#000000'
);
CREATE INDEX IF NOT EXISTS idx_colors_slug ON colors(slug);

CREATE TABLE IF NOT EXISTS size_charts (
  id     TEXT PRIMARY KEY,
  slug   TEXT NOT NULL UNIQUE,
  title  TEXT NOT NULL,
  gender TEXT NOT NULL,
  rows   TEXT NOT NULL DEFAULT '[]'
);

-- ── Товары ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id                  TEXT PRIMARY KEY,
  slug                TEXT NOT NULL UNIQUE,
  title               TEXT NOT NULL,
  sku                 TEXT,
  description         TEXT NOT NULL DEFAULT '',
  gender              TEXT NOT NULL,
  model_line_id       TEXT REFERENCES model_lines(id) ON DELETE SET NULL,
  color_id            TEXT REFERENCES colors(id) ON DELETE SET NULL,
  primary_category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  group_id            TEXT,
  materials           TEXT NOT NULL DEFAULT '[]',
  seasons             TEXT NOT NULL DEFAULT '[]',
  shaft_height_cm     REAL,
  heel_height_cm      REAL,
  price               INTEGER NOT NULL,
  old_price           INTEGER,
  -- Закупочная цена. Внутренняя: на витрину не выводится, нужна для
  -- маржи в блоке «Цены».
  cost_price          INTEGER,
  images              TEXT NOT NULL DEFAULT '[]',
  weight              INTEGER,
  length              INTEGER,
  width               INTEGER,
  height              INTEGER,
  is_published        INTEGER NOT NULL DEFAULT 0,
  is_bestseller       INTEGER NOT NULL DEFAULT 0,
  -- Участие в распродаже отмечается вручную в админке, а не выводится из
  -- старой цены: скидка бывает и вне распродажи, и наоборот.
  is_sale             INTEGER NOT NULL DEFAULT 0,
  rating_value        REAL,
  rating_count        INTEGER NOT NULL DEFAULT 0,
  seo                 TEXT NOT NULL DEFAULT '{}',
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_products_gender     ON products(gender, is_published);
CREATE INDEX IF NOT EXISTS idx_products_model_line ON products(model_line_id);
CREATE INDEX IF NOT EXISTS idx_products_color      ON products(color_id);
CREATE INDEX IF NOT EXISTS idx_products_group      ON products(group_id);
CREATE INDEX IF NOT EXISTS idx_products_published  ON products(is_published, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_bestseller ON products(is_bestseller, is_published);

-- Связь «товар — категории» многие-ко-многим: одна пара угг честно
-- принадлежит и модельной категории, и распродаже одновременно.
CREATE TABLE IF NOT EXISTS product_categories (
  product_id  TEXT NOT NULL REFERENCES products(id)   ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, category_id)
);
CREATE INDEX IF NOT EXISTS idx_product_categories_category ON product_categories(category_id);

CREATE TABLE IF NOT EXISTS product_variants (
  id           TEXT PRIMARY KEY,
  product_id   TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size_eu      REAL NOT NULL,
  insole_cm    REAL,
  stock        INTEGER NOT NULL DEFAULT 0,
  barcode      TEXT,
  marking_code TEXT,
  UNIQUE (product_id, size_eu)
);
CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_variants_size    ON product_variants(size_eu, stock);

-- ── SEO ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seo_landings (
  id               TEXT PRIMARY KEY,
  section_slug     TEXT NOT NULL,
  category_slug    TEXT NOT NULL,
  facet_slug       TEXT NOT NULL,
  facet_type       TEXT NOT NULL,
  facet_value      TEXT NOT NULL,
  title            TEXT NOT NULL,
  h1               TEXT NOT NULL,
  meta_title       TEXT NOT NULL,
  meta_description TEXT NOT NULL,
  seo_text         TEXT NOT NULL DEFAULT '',
  aliases          TEXT NOT NULL DEFAULT '[]',
  is_published     INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  UNIQUE (section_slug, category_slug, facet_slug)
);

CREATE TABLE IF NOT EXISTS redirects (
  id   TEXT PRIMARY KEY,
  "from" TEXT NOT NULL UNIQUE,
  "to"   TEXT NOT NULL DEFAULT '',
  code INTEGER NOT NULL DEFAULT 301
);

-- ── Отзывы и статьи ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id          TEXT PRIMARY KEY,
  product_id  TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  rating      INTEGER NOT NULL,
  text        TEXT NOT NULL DEFAULT '',
  photos      TEXT NOT NULL DEFAULT '[]',
  is_approved INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id, is_approved);

CREATE TABLE IF NOT EXISTS articles (
  id           TEXT PRIMARY KEY,
  slug         TEXT NOT NULL UNIQUE,
  title        TEXT NOT NULL,
  excerpt      TEXT NOT NULL DEFAULT '',
  body         TEXT NOT NULL DEFAULT '',
  cover        TEXT,
  faq          TEXT NOT NULL DEFAULT '[]',
  is_published INTEGER NOT NULL DEFAULT 0,
  seo          TEXT NOT NULL DEFAULT '{}',
  published_at TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(is_published, published_at DESC);

-- ── Заказы ──────────────────────────────────────────────────────────────────
-- Позиции заказа лежат снимком в JSON, а не связями: цена и название
-- должны остаться такими, какими покупатель их видел при оформлении,
-- даже если карточку потом отредактировали или удалили.
CREATE TABLE IF NOT EXISTS orders (
  id             TEXT PRIMARY KEY,
  number         TEXT NOT NULL UNIQUE,
  user_id        TEXT REFERENCES users(id) ON DELETE SET NULL,
  customer       TEXT NOT NULL,
  delivery       TEXT NOT NULL,
  comment        TEXT NOT NULL DEFAULT '',
  items          TEXT NOT NULL DEFAULT '[]',
  subtotal       INTEGER NOT NULL DEFAULT 0,
  discount       INTEGER NOT NULL DEFAULT 0,
  delivery_price INTEGER NOT NULL DEFAULT 0,
  package_weight INTEGER NOT NULL DEFAULT 0,
  total          INTEGER NOT NULL DEFAULT 0,
  promocode      TEXT,
  status         TEXT NOT NULL DEFAULT 'new',
  payment_method TEXT NOT NULL DEFAULT 'on_delivery',
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  cdek           TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_user    ON orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);

-- Счётчик номеров заказов. Отдельная таблица, а не COUNT(*) по заказам:
-- счёт по количеству строк выдаёт дубль номера после удаления заказа.
CREATE TABLE IF NOT EXISTS counters (
  name  TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS promocodes (
  id             TEXT PRIMARY KEY,
  code           TEXT NOT NULL UNIQUE,
  type           TEXT NOT NULL,
  value          INTEGER NOT NULL,
  min_order_total INTEGER NOT NULL DEFAULT 0,
  expires_at     TEXT,
  usage_limit    INTEGER,
  used_count     INTEGER NOT NULL DEFAULT 0,
  is_active      INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS payments (
  id               TEXT PRIMARY KEY,
  external_id      TEXT NOT NULL UNIQUE,
  order_id         TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount           INTEGER NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending',
  idempotence_key  TEXT NOT NULL,
  confirmation_url TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);

-- ── Настройки ───────────────────────────────────────────────────────────────
-- Одиночные объекты настроек (логистика, SEO, тексты витрины) хранятся
-- как записи ключ-значение: их читают целиком и целиком же перезаписывают.
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
