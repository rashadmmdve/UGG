import "server-only";

import path from "node:path";

/**
 * Где лежат загруженные фотографии.
 *
 * По умолчанию — public/uploads, как и было. На сервере папка вынесена
 * из версии в /srv/ugg/shared/uploads и задаётся переменной UPLOADS_DIR
 * — так же, как DATA_DIR для базы, и по той же причине: ссылка внутри
 * проекта роняет сборку Turbopack.
 *
 * Отдаём файлы сами (см. app/uploads/[file]/route.ts), а не через
 * public: `next start` читает список public один раз при запуске, и
 * всё, что загружено после, отвечало бы 404 до следующего перезапуска.
 */
export const UPLOADS_DIR = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(process.cwd(), "public", "uploads");
