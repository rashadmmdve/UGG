import fs from "node:fs/promises";
import path from "node:path";

import { UPLOADS_DIR } from "@/server/uploads/dir";

/**
 * Отдача загруженных фотографий.
 *
 * Раньше их отдавала папка public, но `next start` составляет её
 * список один раз при запуске: фото, загруженное владельцем после
 * этого, отвечало 404 до следующего перезапуска сервера. Здесь файл
 * читается с диска на каждый запрос — загрузил и сразу видно.
 * Оптимизатор next/image ходит по тому же адресу, так что и он
 * получает свежие файлы.
 *
 * Имена файлов выдаёт загрузчик — случайные и без пути, поэтому
 * принимается только один сегмент из безопасных символов. Кэш вечный:
 * файл под своим именем никогда не перезаписывается.
 */
export const dynamic = "force-dynamic";

const NAME = /^[A-Za-z0-9_-]{1,64}\.(webp|jpe?g|png|gif|avif)$/;

const TYPES: Record<string, string> = {
  webp: "image/webp",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  avif: "image/avif",
};

export async function GET(
  _request: Request,
  context: RouteContext<"/uploads/[file]">,
): Promise<Response> {
  const { file } = await context.params;
  if (!NAME.test(file)) return new Response(null, { status: 404 });

  try {
    const data = await fs.readFile(path.join(UPLOADS_DIR, file));
    const ext = file.slice(file.lastIndexOf(".") + 1).toLowerCase();
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": TYPES[ext] ?? "application/octet-stream",
        "Content-Length": String(data.byteLength),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
