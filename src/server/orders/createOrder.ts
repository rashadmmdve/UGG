"use server";

import { getCurrentCustomer } from "@/server/auth/session";
import {
  createCdekOrder,
  FALLBACK_WEIGHT,
  getCdekOrderStatus,
  quoteDelivery,
} from "@/server/cdek/api";
import { decreaseStock, getProductById } from "@/server/repositories/catalog";
import { isMailEnabled, sendMail } from "@/server/mail/mailer";
import { orderMail } from "@/server/mail/templates";
import { paymentReturnUrl, startPayment } from "@/server/payments/flow";
import { isYookassaEnabled } from "@/server/payments/yookassa";
import { createOrder, getOrderById, patchOrder } from "@/server/repositories/orders";
import {
  checkPromocode,
  getPromocodeByCode,
  incrementPromocodeUsage,
} from "@/server/repositories/promocodes";
import { revalidateProduct } from "@/server/seo/revalidate";
import { checkoutSchema } from "@/server/validation/schemas";
import type { OrderItem, Product } from "@/lib/types";

/**
 * Проверка промокода до оформления — чтобы показать скидку в форме.
 * Итоговая скидка всё равно пересчитывается в submitOrder.
 */
export async function previewPromocode(
  code: string,
  subtotal: number,
): Promise<
  | { ok: true; discount: number; /** Процент — для процентного промокода, иначе null. */ percent: number | null }
  | { ok: false; error: string }
> {
  if (!code.trim()) return { ok: false, error: "Введите промокод" };

  const promocode = getPromocodeByCode(code);
  const check = checkPromocode(promocode, subtotal);
  return check.ok
    ? { ok: true, discount: check.discount, percent: promocode?.type === "percent" ? promocode.value : null }
    : { ok: false, error: check.error };
}

export type CheckoutResult =
  | {
      ok: true;
      orderId: string;
      orderNumber: string;
      /** Адрес страницы оплаты ЮKassa — только при оплате картой. */
      paymentUrl: string | null;
    }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Оформление заказа.
 *
 * Клиент присылает только идентификаторы товаров и количество. Цены,
 * скидка и доставка считаются здесь по данным каталога — присланным с
 * клиента суммам не доверяем.
 */
export async function submitOrder(input: unknown): Promise<CheckoutResult> {
  const parsed = checkoutSchema.safeParse(input);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, error: "Проверьте заполнение формы", fieldErrors };
  }

  const data = parsed.data;

  // Онлайн-оплату можно выбрать, только когда она подключена: форма
  // такой вариант не показывает, но прямой запрос — не форма.
  if (data.paymentMethod === "online" && !isYookassaEnabled()) {
    return {
      ok: false,
      error: "Оплата картой на сайте временно недоступна — выберите оплату при получении.",
      fieldErrors: { paymentMethod: "Способ недоступен" },
    };
  }

  // ── Позиции по актуальному каталогу ──
  const items: OrderItem[] = [];
  const productsById = new Map<string, Product>();

  for (const line of data.items) {
    const product = getProductById(line.productId);

    if (!product || !product.isPublished) {
      return { ok: false, error: "Один из товаров больше не доступен" };
    }

    const variant = product.variants.find((candidate) => candidate.id === line.variantId);
    if (!variant) {
      return { ok: false, error: `Размер товара «${product.title}» недоступен` };
    }

    if (variant.stock < line.quantity) {
      return {
        ok: false,
        error: `«${product.title}», размер ${variant.sizeEu}: в наличии ${variant.stock} шт.`,
      };
    }

    productsById.set(product.id, product);
    items.push({
      productId: product.id,
      variantId: variant.id,
      title: product.title,
      slug: product.slug,
      sizeEu: variant.sizeEu,
      image: product.images[0] ?? null,
      price: product.price,
      quantity: line.quantity,
    });
  }

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // ── Промокод ──
  let discount = 0;
  let promocodeId: string | null = null;
  let promocodeLabel: string | null = null;

  if (data.promocode) {
    const check = checkPromocode(getPromocodeByCode(data.promocode), subtotal);
    if (!check.ok) {
      return { ok: false, error: check.error, fieldErrors: { promocode: check.error } };
    }
    discount = check.discount;
    promocodeId = check.promocode.id;
    promocodeLabel = check.promocode.code;
  }

  // ── Доставка ──
  // Пересчитывается здесь, а не берётся с клиента: цену в форме легко
  // подменить. Габариты — как в расчёте на форме: коробки с обувью ставятся
  // друг на друга, поэтому высота складывается, а длина и ширина — максимум.
  let weight = 0;
  const box = { length: 0, width: 0, height: 0 };
  for (const item of items) {
    const product = productsById.get(item.productId);
    weight += (product?.weight ?? FALLBACK_WEIGHT) * item.quantity;
    box.length = Math.max(box.length, product?.length ?? 0);
    box.width = Math.max(box.width, product?.width ?? 0);
    box.height += (product?.height ?? 0) * item.quantity;
  }

  const quote = await quoteDelivery({
    cityCode: data.cityCode,
    mode: data.deliveryMode,
    deliveryPoint: data.pointCode ?? undefined,
    weightGrams: Math.max(weight, 1),
    dimensions: box.length && box.width && box.height ? box : undefined,
  }).catch(() => null);

  if (!quote) {
    return {
      ok: false,
      error:
        "Не удалось рассчитать доставку по выбранному адресу. Выберите другой пункт выдачи или город.",
    };
  }

  const deliveryPrice = quote.price;
  const total = subtotal - discount + deliveryPrice;

  // ── Списание остатков ──
  // До создания заказа и одной транзакцией: если последнюю пару уже
  // разобрали, заказ не появится.
  try {
    decreaseStock(items.map((item) => ({ variantId: item.variantId, quantity: item.quantity })));
  } catch {
    return {
      ok: false,
      error: "Пока вы оформляли заказ, часть товаров разобрали. Обновите корзину.",
    };
  }

  const user = await getCurrentCustomer();

  const order = createOrder({
    userId: user?.id ?? null,
    customer: { name: data.name, email: data.email, phone: data.phone },
    delivery: {
      mode: data.deliveryMode,
      cityCode: data.cityCode,
      city: data.city,
      address: data.address,
      pointCode: data.pointCode,
      periodMin: quote.periodMin,
      periodMax: quote.periodMax,
    },
    comment: data.comment,
    items,
    subtotal,
    discount,
    deliveryPrice,
    packageWeight: Math.max(weight, 1),
    total,
    promocode: promocodeLabel,
    status: "new",
    paymentMethod: data.paymentMethod,
    // Картой — заказ ждёт платежа; при получении — деньги соберёт СДЭК.
    paymentStatus: data.paymentMethod === "online" ? "pending" : "unpaid",
    cdek: null,
  });

  if (promocodeId) incrementPromocodeUsage(promocodeId);

  // Отправление регистрируется сразу: покупателю нужны трек-номер и
  // этикетка в личном кабинете. Списания у СДЭК в этот момент нет —
  // тарификация начинается при физической приёмке посылки.
  //
  // Сбой регистрации не роняет оформление: заказ уже создан, а передать
  // его в СДЭК менеджер сможет вручную из админки.
  try {
    const created = await createCdekOrder(order);
    if (created.ok) {
      const status = await getCdekOrderStatus(created.uuid).catch(() => null);
      patchOrder(order.id, {
        cdek: {
          uuid: created.uuid,
          cdekNumber: status?.cdekNumber ?? null,
          statusCode: status?.statusCode ?? "CREATED",
          statusName: status?.statusName ?? "Создан",
          syncedAt: new Date().toISOString(),
        },
      });
    } else {
      // Причину пишем в лог: заказ в этом случае выглядит обычным, и без
      // записи непонятно, почему у него нет отправления.
      console.error(`СДЭК отклонил заказ ${order.number}: ${created.error}`);
    }
  } catch (error) {
    console.error(`Не удалось передать заказ ${order.number} в СДЭК:`, error);
    // cdek остаётся null — в админке появится кнопка «Передать в СДЭК».
  }

  // Остатки изменились — наличие в карточках и на посадочных тоже.
  for (const product of productsById.values()) {
    const fresh = getProductById(product.id);
    if (fresh) revalidateProduct(fresh);
  }

  // ── Оплата ──
  // Сбой ЮKassa не роняет оформление: заказ уже есть, и оплатить его
  // можно со страницы «спасибо» или из личного кабинета.
  let paymentUrl: string | null = null;
  if (data.paymentMethod === "online") {
    const payment = await startPayment(order);
    if (payment.ok) paymentUrl = payment.url;
  }

  // Письмо покупателю — не критично: заказ уже есть, а сбой почты не
  // должен показывать покупателю ошибку оформления.
  //
  // При оплате на сайте письмо здесь не уходит: покупатель сейчас на
  // странице ЮKassa и через минуту получит «оплачен» (см. applyPayment).
  // Письмо «ожидает оплаты» с кнопкой придёт, только если оплата
  // сорвётся. Исключение — ЮKassa не ответила и платёж не создан: тогда
  // пишем сразу, чтобы покупатель знал, что заказ есть и его можно
  // оплатить из кабинета.
  if (isMailEnabled() && (data.paymentMethod !== "online" || !paymentUrl)) {
    const fresh = getOrderById(order.id) ?? order;
    sendMail(orderMail(fresh, paymentUrl ?? (data.paymentMethod === "online" ? paymentReturnUrl(order) : null))).catch(
      (error) => console.error(`Не удалось отправить письмо о заказе ${order.number}:`, error),
    );
  }

  return { ok: true, orderId: order.id, orderNumber: order.number, paymentUrl };
}
