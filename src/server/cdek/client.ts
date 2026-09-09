import "server-only";

/**
 * Низкоуровневый клиент API СДЭК.
 *
 * Авторизация — OAuth 2.0 client_credentials: токен живёт час, поэтому
 * держим его в памяти процесса и обновляем заранее. Запрашивать токен на
 * каждый вызов нельзя: у СДЭК общий лимит 200 запросов в секунду на все
 * методы, а токенов на один аккаунт выдаётся заметно меньше.
 */

const API_URL = process.env.CDEK_API_URL ?? "https://api.edu.cdek.ru";

/** Обновляем токен за минуту до истечения — с запасом на сетевые задержки. */
const TOKEN_SAFETY_MARGIN_MS = 60_000;

type CachedToken = { value: string; expiresAt: number };

let cached: CachedToken | null = null;
/** Параллельные запросы ждут один и тот же поход за токеном, а не каждый свой. */
let pending: Promise<string> | null = null;

function credentials() {
  const account = process.env.CDEK_ACCOUNT;
  const password = process.env.CDEK_PASSWORD;

  if (!account || !password) {
    throw new Error(
      "CDEK_ACCOUNT и CDEK_PASSWORD не заданы. Добавьте их в .env.local (см. .env.example).",
    );
  }

  return { account, password };
}

async function requestToken(): Promise<string> {
  const { account, password } = credentials();

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: account,
    client_secret: password,
  });

  const response = await fetch(`${API_URL}/v2/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    // Токен зависит от секретов, а не от адреса — кешировать ответ нельзя.
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `СДЭК не выдал токен (HTTP ${response.status}). Проверьте CDEK_ACCOUNT и CDEK_PASSWORD.`,
    );
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };

  cached = {
    value: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000 - TOKEN_SAFETY_MARGIN_MS,
  };

  return cached.value;
}

async function getToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (pending) return pending;

  pending = requestToken().finally(() => {
    pending = null;
  });

  return pending;
}

export class CdekError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "CdekError";
  }
}

/**
 * Запрос к API СДЭК с уже подставленным токеном.
 *
 * @param path путь вида `/v2/deliverypoints`
 * @param init `query` — параметры строки запроса, `body` — JSON-тело (тогда метод POST)
 */
export async function cdekRequest<T>(
  path: string,
  init: {
    query?: Record<string, string | number | boolean | undefined>;
    body?: unknown;
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    /** Сколько секунд ответ можно держать в кеше Next. 0 — не кешировать. */
    revalidate?: number;
  } = {},
): Promise<T> {
  const token = await getToken();

  const url = new URL(path, API_URL);
  for (const [key, value] of Object.entries(init.query ?? {})) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }

  const method = init.method ?? (init.body ? "POST" : "GET");

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    ...(init.revalidate && method === "GET"
      ? { next: { revalidate: init.revalidate } }
      : { cache: "no-store" as const }),
  });

  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    throw new CdekError(
      `СДЭК вернул ошибку по ${path} (HTTP ${response.status})`,
      response.status,
      data,
    );
  }

  return data as T;
}

/**
 * Скачать бинарный файл (PDF этикетки) с уже подставленным токеном.
 *
 * Ссылки, которые отдаёт СДЭК на готовые PDF (`/v2/print/barcodes/{uuid}.pdf`),
 * защищены тем же Bearer-токеном, что и остальной API. Отдать такую ссылку
 * браузеру напрямую нельзя — токен есть только у сервера, а без него СДЭК
 * возвращает JSON с ошибкой авторизации вместо файла. Поэтому файл всегда
 * скачивается здесь и уже готовыми байтами уходит к клиенту.
 */
export async function cdekFetchBinary(url: string): Promise<ArrayBuffer> {
  const token = await getToken();

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new CdekError(
      `СДЭК не отдал файл ${url} (HTTP ${response.status})`,
      response.status,
    );
  }

  return response.arrayBuffer();
}

/** Сбросить кеш токена — нужно только в тестах и при смене ключей на лету. */
export function resetCdekToken() {
  cached = null;
  pending = null;
}
