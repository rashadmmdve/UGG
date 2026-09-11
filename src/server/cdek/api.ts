import "server-only";

import { cdekRequest } from "@/server/cdek/client";
import { sizeLabel } from "@/lib/utils";
import { settledLines } from "@/server/orders/pricing";
import { getLogistics } from "@/server/repositories/settings";
import type {
  CdekCity,
  CdekDeliveryPoint,
  CdekQuote,
  Order,
} from "@/lib/types";

/**
 * Методы СДЭК, которые нужны витрине: подбор города, список пунктов выдачи
 * и расчёт стоимости доставки.
 *
 * Тарифы «склад-*» — мы сами привозим посылки в ПВЗ отправления (см.
 * CDEK_SHIPMENT_POINT), поэтому для покупателя доставка дешевле, чем при
 * вызове курьера к нам.
 */
export const TARIFF_TO_PVZ = 136; // Посылка склад-склад
export const TARIFF_TO_DOOR = 137; // Посылка склад-дверь

/** Габариты по умолчанию, если у товара не заданы свои (в сантиметрах). */
const FALLBACK_DIMENSIONS = { length: 30, width: 25, height: 10 };
/** Вес по умолчанию, если у товара не задан свой (в граммах). */
export const FALLBACK_WEIGHT = 500;


/* ─────────────────────────── Города ─────────────────────────── */

type CityResponse = {
  code: number;
  city: string;
  region?: string;
  sub_region?: string;
  country_code?: string;
};

/**
 * Подбор города по началу названия — для подсказок в форме заказа.
 * Отдаём не более `limit` вариантов: список городов у СДЭК огромный.
 */
export async function searchCities(
  query: string,
  limit = 8,
): Promise<CdekCity[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const cities = await cdekRequest<CityResponse[]>("/v2/location/cities", {
    query: { city: trimmed, country_codes: "RU", size: 100, page: 0 },
    // Список городов меняется редко — держим сутки, чтобы не дёргать API
    // на каждую букву в поле поиска.
    revalidate: 60 * 60 * 24,
  });

  return cities.slice(0, limit).map((city) => ({
    code: city.code,
    city: city.city,
    region: city.region ?? "",
  }));
}

/* ────────────────────────── Пункты выдачи ────────────────────── */

type OfficeResponse = {
  code: string;
  name: string;
  type: "PVZ" | "POSTAMAT";
  work_time?: string;
  address_comment?: string;
  is_dressing_room?: boolean;
  have_cashless?: boolean;
  weight_max?: number;
  location?: {
    address?: string;
    address_full?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
  };
};

/**
 * Пункты выдачи в городе. `weightGrams` отсекает офисы, которые не примут
 * посылку по весу: у части ПВЗ ограничение 15–30 кг.
 *
 * `purpose` различает две разные роли пункта: «handout» — куда покупатель
 * придёт за заказом, «reception» — куда мы сами привозим посылки. Это разные
 * списки: не каждый пункт выдачи принимает отправления.
 */
export async function getDeliveryPoints(
  cityCode: number,
  weightGrams?: number,
  purpose: "handout" | "reception" = "handout",
): Promise<CdekDeliveryPoint[]> {
  const offices = await cdekRequest<OfficeResponse[]>("/v2/deliverypoints", {
    query: {
      city_code: cityCode,
      type: "PVZ",
      is_handout: purpose === "handout" ? true : undefined,
      is_reception: purpose === "reception" ? true : undefined,
      // API ждёт вес в килограммах.
      weight_max: weightGrams ? Math.ceil(weightGrams / 1000) : undefined,
    },
    // Сутки — интервал, который рекомендует сам СДЭК: список офисов живой,
    // но не настолько, чтобы запрашивать его на каждое открытие формы.
    revalidate: 60 * 60 * 24,
  });

  return offices
    .filter((office) => office.location?.address)
    .map((office) => ({
      code: office.code,
      name: office.name,
      address: office.location?.address ?? "",
      addressFull: office.location?.address_full ?? "",
      workTime: office.work_time ?? "",
      comment: office.address_comment ?? "",
      hasDressingRoom: Boolean(office.is_dressing_room),
      hasCashless: Boolean(office.have_cashless),
      latitude: office.location?.latitude ?? null,
      longitude: office.location?.longitude ?? null,
    }));
}

/* ──────────────────────── Расчёт стоимости ───────────────────── */

type TariffResponse = {
  delivery_sum?: number;
  total_sum?: number;
  period_min?: number;
  period_max?: number;
  calendar_min?: number;
  calendar_max?: number;
  errors?: { code: string; message: string }[];
};

export type QuoteInput = {
  /** Куда: код города СДЭК. */
  cityCode: number;
  /** Режим доставки: до пункта выдачи или курьером до двери. */
  mode: "pvz" | "courier";
  /** Код ПВЗ назначения — только для mode = "pvz". */
  deliveryPoint?: string;
  /** Суммарный вес заказа в граммах. */
  weightGrams: number;
  dimensions?: { length: number; width: number; height: number };
};

/**
 * Стоимость и срок доставки. Возвращает `null`, если СДЭК не смог посчитать
 * маршрут (нет доставки в этот населённый пункт, недоступен тариф и т.п.) —
 * форма заказа в таком случае показывает понятное сообщение, а не падает.
 */
export async function quoteDelivery(
  input: QuoteInput,
): Promise<CdekQuote | null> {
  const dimensions = input.dimensions ?? FALLBACK_DIMENSIONS;
  // Откуда отправляем — из настроек логистики в админке.
  const logistics = getLogistics();

  const result = await cdekRequest<TariffResponse>("/v2/calculator/tariff", {
    body: {
      type: 1, // интернет-магазин
      tariff_code: input.mode === "pvz" ? TARIFF_TO_PVZ : TARIFF_TO_DOOR,
      from_location: { code: logistics.fromCityCode },
      to_location: { code: input.cityCode },
      shipment_point: logistics.shipmentPointCode || undefined,
      delivery_point: input.mode === "pvz" ? input.deliveryPoint : undefined,
      packages: [
        {
          weight: Math.max(input.weightGrams, 1),
          ...dimensions,
        },
      ],
    },
  });

  if (result.errors?.length || result.total_sum === undefined) return null;

  return {
    // total_sum — с НДС и доп. услугами, именно её платит покупатель.
    price: Math.ceil(result.total_sum),
    periodMin: result.calendar_min ?? result.period_min ?? null,
    periodMax: result.calendar_max ?? result.period_max ?? null,
  };
}

/* ─────────────────────── Заказы в СДЭК ───────────────────────── */

type CdekRequestState = {
  state?: string;
  errors?: { code?: string; message: string }[];
};

type OrderCreateResponse = {
  entity?: { uuid?: string };
  requests?: CdekRequestState[];
};

type OrderInfoResponse = {
  entity?: {
    uuid?: string;
    cdek_number?: string;
    statuses?: { code: string; name: string; date_time: string }[];
  };
  requests?: CdekRequestState[];
};

/** Понятные формулировки вместо английских кодов СДЭК. */
function describeCdekError(errors?: { code?: string; message: string }[]) {
  const first = errors?.[0];
  if (!first) return "СДЭК отклонил заказ";

  if (first.code?.includes("dep_number_has_already_had_integration")) {
    return "Заказ с таким номером уже заведён в СДЭК. Отмените прежнее отправление или обратитесь в поддержку.";
  }

  return `СДЭК отклонил заказ: ${first.message}`;
}

/**
 * Регистрация заказа в СДЭК. Возвращает uuid отправления — по нему потом
 * запрашиваются статус и этикетка.
 *
 * Деньги в этот момент не списываются: тарификация начинается, когда посылку
 * физически принимают в пункте. Поэтому регистрировать заказ сразу безопасно,
 * а неотправленный заказ можно бесплатно удалить.
 */
export type CreateOrderResult =
  | { ok: true; uuid: string }
  | { ok: false; error: string };

export async function createCdekOrder(
  order: Order,
): Promise<CreateOrderResult> {
  const logistics = getLogistics();
  const cod = order.paymentMethod === "on_delivery";

  const result = await cdekRequest<OrderCreateResponse>("/v2/orders", {
    body: {
      type: 1,
      number: order.number,
      tariff_code: order.delivery.mode === "pvz" ? TARIFF_TO_PVZ : TARIFF_TO_DOOR,
      comment: order.comment || undefined,
      /**
       * Откуда забирают посылку. СДЭК требует одно из двух — иначе
       * отклоняет заказ с «[shipment_point] is empty, [from_location] is
       * empty». Пункт приёма задаётся в админке; пока он не выбран,
       * подставляем город отправления, как это делает расчёт тарифа.
       */
      ...(logistics.shipmentPointCode
        ? { shipment_point: logistics.shipmentPointCode }
        : { from_location: { code: logistics.fromCityCode } }),
      // Для ПВЗ адрес не нужен — он определяется кодом пункта.
      delivery_point:
        order.delivery.mode === "pvz"
          ? (order.delivery.pointCode ?? undefined)
          : undefined,
      to_location:
        order.delivery.mode === "courier"
          ? { code: order.delivery.cityCode, address: order.delivery.address }
          : undefined,
      // При оплате при получении деньги за товар и доставку собирает
      // курьер или пункт выдачи. Для этого у СДЭК должен быть включён
      // наложенный платёж в договоре — иначе заказ отклонят.
      ...(cod
        ? { delivery_recipient_cost: { value: order.deliveryPrice } }
        : {}),
      recipient: {
        name: order.customer.name,
        email: order.customer.email,
        phones: [{ number: order.customer.phone.replace(/[^\d+]/g, "") }],
      },
      packages: [
        {
          number: order.number,
          weight: Math.max(order.packageWeight ?? 1, 1),
          items: settledLines(order).map((line) => ({
            name: sizeLabel(line.item.sizeEu)
              ? `${line.item.title}, размер ${line.item.sizeEu}`
              : line.item.title,
            // Разбитая скидкой позиция даёт две строки на один артикул —
            // ключи должны отличаться.
            ware_key: line.part > 1 ? `${line.item.variantId}-${line.part}` : line.item.variantId,
            cost: line.unitPrice,
            weight: Math.max(
              Math.round((order.packageWeight ?? 500) / order.items.length),
              1,
            ),
            amount: line.quantity,
            // Сколько взять с получателя за единицу: при оплате на сайте — ничего.
            payment: { value: cod ? line.unitPrice : 0 },
          })),
        },
      ],
    },
  });

  const state = result.requests?.[0];
  if (state?.state === "INVALID") {
    return { ok: false as const, error: describeCdekError(state.errors) };
  }
  if (!result.entity?.uuid) {
    return { ok: false as const, error: "СДЭК не вернул номер отправления" };
  }

  // СДЭК проверяет заказ асинхронно: сразу после создания приходит ACCEPTED,
  // а ошибки валидации всплывают через секунду-другую. Без этой проверки
  // забракованный заказ выглядел бы принятым.
  const uuid = result.entity.uuid;
  await new Promise((resolve) => setTimeout(resolve, 1500));

  const check = await cdekRequest<OrderInfoResponse>(`/v2/orders/${uuid}`);
  const createRequest = check.requests?.find(
    (request) => request.state === "INVALID",
  );
  if (createRequest) {
    return { ok: false as const, error: describeCdekError(createRequest.errors) };
  }

  return { ok: true as const, uuid };
}

/** Текущий статус отправления. */
export async function getCdekOrderStatus(uuid: string) {
  const result = await cdekRequest<OrderInfoResponse>(`/v2/orders/${uuid}`);
  const entity = result.entity;
  if (!entity) return null;

  // Порядок в массиве не хронологический — сортируем по времени сами.
  // Иначе «Принят» перекрывал бы более поздний статус, вплоть до ошибки.
  const latest = [...(entity.statuses ?? [])].sort(
    (a, b) => new Date(b.date_time).getTime() - new Date(a.date_time).getTime(),
  )[0];

  return {
    cdekNumber: entity.cdek_number ?? null,
    statusCode: latest?.code ?? "CREATED",
    statusName: latest?.name ?? "Создан",
  };
}

/**
 * Удаление заказа в СДЭК. Работает, пока посылку не приняли физически —
 * после приёмки СДЭК откажет, и отменять придётся через поддержку.
 */
export async function deleteCdekOrder(uuid: string): Promise<boolean> {
  try {
    await cdekRequest(`/v2/orders/${uuid}`, { method: "DELETE" });
    return true;
  } catch {
    return false;
  }
}

type BarcodeResponse = {
  entity?: { uuid?: string; url?: string; statuses?: { code: string }[] };
  requests?: { state?: string; errors?: { code: string; message: string }[] }[];
};

/**
 * Результат запроса этикетки. «invalid» — СДЭК отказал: так бывает, пока
 * заказ у них в статусе «Принят», а не «Создан» (на тестовом контуре он
 * из «Принят» не выходит никогда). «pending» — файл ещё формируется.
 */
export type CdekLabelResult =
  | { ok: true; url: string }
  | { ok: false; reason: "invalid" | "pending" };

/**
 * Ссылка на PDF с этикеткой-штрихкодом.
 *
 * СДЭК формирует файл не мгновенно: сначала запрос ставится в очередь, и
 * только через пару секунд появляется готовый PDF. Поэтому опрашиваем
 * готовность, а не возвращаем ссылку сразу.
 *
 * Формат — A6 (105×148 мм): свой размер листа API не принимает (проверено —
 * "75x120" отклоняется как v2_invalid_format, доступны только A4/A5/A6), а
 * A6 ближе всего к стандартной термоэтикетке СДЭК 100×150 мм.
 */
export async function getCdekBarcodeUrl(
  orderUuid: string,
): Promise<CdekLabelResult> {
  const created = await cdekRequest<BarcodeResponse>("/v2/print/barcodes", {
    body: { orders: [{ order_uuid: orderUuid }], format: "A6" },
  });

  const printUuid = created.entity?.uuid;
  if (!printUuid) return { ok: false, reason: "invalid" };

  for (let attempt = 0; attempt < 5; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 700));

    const status = await cdekRequest<BarcodeResponse>(
      `/v2/print/barcodes/${printUuid}`,
    );

    const codes = status.entity?.statuses?.map((item) => item.code) ?? [];
    if (codes.includes("READY") && status.entity?.url) {
      return { ok: true, url: status.entity.url };
    }
    // Отказ приходит окончательным — ждать дальше нечего.
    if (codes.includes("INVALID") || status.requests?.some((r) => r.state === "INVALID")) {
      return { ok: false, reason: "invalid" };
    }
  }

  return { ok: false, reason: "pending" };
}
