import fs from "node:fs/promises";
import path from "node:path";

import { nanoid } from "nanoid";
import sharp, { type Metadata } from "sharp";

import { assertAdmin } from "@/server/admin/guard";

/**
 * Загрузка фотографий товаров.
 *
 * Принимает сразу несколько файлов: у одной модели восемь цветов по
 * пять-шесть ракурсов, и грузить их по одному — это сотни кликов на
 * каждую линейку.
 *
 * Каждый файл пересобирается через sharp: приводится к разумному размеру
 * и сохраняется в WebP. Пересборка — ещё и проверка: файл, который sharp
 * не смог разобрать как изображение, отклоняется независимо от того, что
 * написано в его расширении или заголовке Content-Type.
 */

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const MAX_FILES = 12;
const MAX_BYTES = 12 * 1024 * 1024;
/** Длинная сторона после сжатия. Для карточки товара больше не нужно. */
const MAX_SIDE = 1600;
const WEBP_QUALITY = 82;

/**
 * SVG в списке нет намеренно: это исполняемая разметка, а не растр,
 * и через неё в страницу можно провести скрипт.
 */
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp", "avif", "heif", "tiff"]);

type UploadResult =
  | { name: string; ok: true; url: string; width: number; height: number }
  | { name: string; ok: false; error: string };

async function processFile(file: File): Promise<UploadResult> {
  const name = file.name;

  if (file.size > MAX_BYTES) {
    return { name, ok: false, error: "Файл больше 12 МБ" };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let metadata: Metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch {
    return { name, ok: false, error: "Не удалось прочитать как изображение" };
  }

  if (!metadata.format || !ALLOWED_FORMATS.has(metadata.format)) {
    return { name, ok: false, error: `Формат ${metadata.format ?? "неизвестен"} не поддерживается` };
  }

  // Имя файла генерируется здесь: имя, пришедшее от клиента, в путь
  // не попадает ни в каком виде.
  const fileName = `${nanoid(16)}.webp`;

  try {
    const output = await sharp(buffer)
      // Поворот по EXIF: снимки с телефона иначе лягут боком.
      .rotate()
      .resize({
        width: MAX_SIDE,
        height: MAX_SIDE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer({ resolveWithObject: true });

    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    await fs.writeFile(path.join(UPLOAD_DIR, fileName), output.data);

    return {
      name,
      ok: true,
      url: `/uploads/${fileName}`,
      width: output.info.width,
      height: output.info.height,
    };
  } catch {
    return { name, ok: false, error: "Ошибка при обработке файла" };
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!(await assertAdmin())) {
    return Response.json({ error: "Нет доступа" }, { status: 401 });
  }

  const form = await request.formData();
  const files = form
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (files.length === 0) {
    return Response.json({ error: "Файлы не переданы" }, { status: 400 });
  }

  if (files.length > MAX_FILES) {
    return Response.json(
      { error: `За один раз можно загрузить не больше ${MAX_FILES} файлов` },
      { status: 400 },
    );
  }

  // Файлы обрабатываются последовательно: sharp и так использует все
  // ядра на каждом изображении, параллельность здесь ничего не даст,
  // а память на дюжину исходников по 12 МБ уже заметна.
  const results: UploadResult[] = [];
  for (const file of files) {
    results.push(await processFile(file));
  }

  return Response.json({ results });
}
