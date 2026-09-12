"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import { AField, ATextarea } from "@/components/admin/ui";
import { DeliveryPicker } from "@/components/shop/DeliveryPicker";
import { useHydrated } from "@/lib/hooks/useHydrated";
import { isSelfDelivery } from "@/lib/delivery";
import { cartSubtotal, useCartStore } from "@/lib/store/cart";
import { cn, formatPrice, plural, sizeLabel } from "@/lib/utils";
import { quoteDeliveryAction } from "@/server/cdek/actions";
import { previewPromocode, submitOrder } from "@/server/orders/createOrder";
import type {
  CdekCity,
  CdekDeliveryPoint,
  CdekQuote,
  DeliveryMode,
  PaymentMethod,
  PublicUser,
} from "@/lib/types";

const PAYMENT_OPTIONS: { value: PaymentMethod; title: string; hint: string }[] = [
  {
    value: "online",
    title: "Картой онлайн",
    hint: "Банковская карта, СБП и другие способы через ЮKassa. Чек придёт на почту.",
  },
  {
    value: "on_delivery",
    title: "При получении",
    hint: "Наличными или картой в пункте выдачи или курьеру СДЭК.",
  },
];

export function CheckoutForm({
  user,
  onlinePayment,
}: {
  user: PublicUser | null;
  /** Подключена ли ЮKassa. Без неё остаётся только оплата при получении. */
  onlinePayment: boolean;
}) {
  const router = useRouter();
  const hydrated = useHydrated();
  const items = useCartStore((state) => state.items);
  const clear = useCartStore((state) => state.clear);
  const remove = useCartStore((state) => state.remove);

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [promocode, setPromocode] = useState("");
  const [discount, setDiscount] = useState(0);
  const [discountPercent, setDiscountPercent] = useState<number | null>(null);
  const [promoMessage, setPromoMessage] = useState<string | null>(null);
  const [promoChecking, setPromoChecking] = useState(false);

  const [mode, setMode] = useState<DeliveryMode>("pvz");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    onlinePayment ? "online" : "on_delivery",
  );
  const [city, setCity] = useState<CdekCity | null>(null);
  const [point, setPoint] = useState<CdekDeliveryPoint | null>(null);
  const [address, setAddress] = useState("");
  const [quote, setQuote] = useState<CdekQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);

  const cartLines = items.map((item) => ({
    productId: item.productId,
    variantId: item.variantId,
    quantity: item.quantity,
  }));

  // Строковый ключ вместо массива в зависимостях: новый массив создаётся
  // на каждый рендер и запускал бы эффект бесконечно.
  const cartKey = JSON.stringify(cartLines.map((line) => [line.productId, line.quantity]));

  // Свой город: пункта выдачи нет, нужен адрес — везём по нему сами.
  const self = city ? isSelfDelivery({ cityCode: city.code }) : false;
  const ready =
    Boolean(city) &&
    (self || mode === "courier" ? address.trim().length > 4 : Boolean(point));

  useEffect(() => {
    let cancelled = false;
    // Через таймер: адрес печатают посимвольно, без паузы запрос уходил бы
    // на каждый символ.
    const id = setTimeout(async () => {
      if (!city || !ready) {
        setQuote(null);
        setQuoteError(null);
        return;
      }
      setQuoting(true);
      const result = await quoteDeliveryAction({
        cityCode: city.code,
        mode: self ? "courier" : mode,
        pointCode: point?.code ?? null,
        items: (JSON.parse(cartKey) as [string, number][]).map(([productId, quantity]) => ({ productId, quantity })),
      });
      if (cancelled) return;
      if (result.ok) {
        setQuote(result.quote);
        setQuoteError(null);
      } else {
        setQuote(null);
        setQuoteError(result.error);
      }
      setQuoting(false);
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [city, mode, self, point, ready, address, cartKey]);

  if (!hydrated) return <div className="py-24" aria-hidden />;

  if (items.length === 0) {
    return (
      <div className="py-24 text-center">
        <p className="text-xl font-semibold">Корзина пуста</p>
        <p className="mt-2 text-sm text-muted">Оформлять пока нечего.</p>
        <Link href="/catalog" className="mt-6 inline-flex h-11 items-center rounded-md border border-line px-6 text-sm font-medium hover:border-accent">
          В каталог
        </Link>
      </div>
    );
  }

  const subtotal = cartSubtotal(items);
  const total = subtotal - discount + (quote?.price ?? 0);

  async function applyPromocode() {
    setPromoChecking(true);
    const result = await previewPromocode(promocode, subtotal);
    setPromoChecking(false);
    if (result.ok) {
      setDiscount(result.discount);
      setDiscountPercent(result.percent);
      setPromoMessage(
        result.percent
          ? `Скидка ${result.percent} % — минус ${formatPrice(result.discount)}`
          : `Скидка ${formatPrice(result.discount)}`,
      );
    } else {
      setDiscount(0);
      setDiscountPercent(null);
      setPromoMessage(result.error);
    }
  }

  // Через onSubmit, а не action={…}: форму с action React очищает после
  // каждой отправки, и покупатель, забывший телефон, заново вводил бы имя
  // и почту. Здесь поля живут, пока страница открыта.
  function handleSubmit(formData: FormData) {
    setError(null);
    setFieldErrors({});
    startTransition(async () => {
      const result = await submitOrder({
        name: formData.get("name"),
        email: formData.get("email"),
        phone: formData.get("phone"),
        deliveryMode: self ? "courier" : mode,
        cityCode: city?.code ?? 0,
        city: city?.city ?? "",
        // Для пункта выдачи адресом становится его собственный адрес.
        address: !self && mode === "pvz" ? (point?.address ?? "") : address,
        pointCode: !self && mode === "pvz" ? (point?.code ?? null) : null,
        comment: formData.get("comment") ?? "",
        promocode,
        paymentMethod,
        items: cartLines,
      });
      if (!result.ok) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      clear();
      // На оплату — полным переходом: страница ЮKassa живёт на другом
      // домене, и роутер Next туда не доведёт. Если платёж не создался,
      // страница «спасибо» предложит попробовать ещё раз.
      if (result.paymentUrl) {
        window.location.assign(result.paymentUrl);
        return;
      }
      router.push(`/checkout/success?order=${result.orderId}`);
    });
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        handleSubmit(new FormData(event.currentTarget));
      }}
      noValidate
      className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-12"
    >
      <div className="flex flex-col gap-10 lg:col-span-7">
        <fieldset>
          <legend className="mb-4 text-lg font-semibold">1. Контактные данные</legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <AField id="co-name" name="name" label="Имя" placeholder="Ваше имя *" labelHidden autoComplete="name" defaultValue={user?.name ?? ""} error={fieldErrors.name} />
            <AField id="co-phone" name="phone" type="tel" label="Телефон" placeholder="Контактный телефон *" labelHidden autoComplete="tel" defaultValue={user?.phone ?? ""} error={fieldErrors.phone} />
            <AField id="co-email" name="email" type="email" label="Почта" placeholder="Ваш e-mail *" labelHidden autoComplete="email" defaultValue={user?.email ?? ""} error={fieldErrors.email} className="sm:col-span-2" />
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-4 text-lg font-semibold">2. Способ оплаты</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {PAYMENT_OPTIONS.map((option) => {
              const disabled = option.value === "online" && !onlinePayment;
              const checked = paymentMethod === option.value;
              return (
                <label
                  key={option.value}
                  className={cn(
                    "flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors",
                    checked ? "border-accent" : "border-line hover:border-line-strong",
                    disabled && "cursor-not-allowed opacity-50",
                  )}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={option.value}
                    checked={checked}
                    disabled={disabled}
                    onChange={() => setPaymentMethod(option.value)}
                    className="mt-1 h-4 w-4 shrink-0 accent-accent"
                  />
                  <span>
                    <span className="block text-sm font-semibold">{option.title}</span>
                    <span className="mt-0.5 block text-xs text-muted">
                      {disabled ? "Подключается — пока недоступно." : option.hint}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          {fieldErrors.paymentMethod && (
            <p role="alert" className="mt-2 text-sm text-danger">{fieldErrors.paymentMethod}</p>
          )}
        </fieldset>

        <fieldset>
          <legend className="mb-4 text-lg font-semibold">3. Доставка</legend>
          <DeliveryPicker
            items={cartLines}
            mode={mode} onModeChange={setMode}
            city={city} onCityChange={setCity}
            point={point} onPointChange={setPoint}
            address={address} onAddressChange={setAddress}
            fieldErrors={fieldErrors}
          />
          {quoteError && <p role="alert" className="mt-3 text-sm text-danger">{quoteError}</p>}
          <div className="mt-5">
            <ATextarea id="co-comment" name="comment" label="Комментарий к заказу" placeholder="Комментарий к заказу (необязательно)" labelHidden rows={3} />
          </div>
        </fieldset>
      </div>

      <aside className="lg:col-span-5">
        <div className="rounded-lg border border-line p-6 lg:sticky lg:top-24">
          <h2 className="label-caps text-fg">Ваш заказ</h2>
          {/* Состав с фото и крестиком: передумать можно и здесь, не
              возвращаясь в корзину. Последний товар убрал — форма сменится
              на «корзина пуста». */}
          <ul className="mt-4 flex flex-col divide-y divide-line border-b border-line">
            {items.map((item) => (
              <li key={`${item.productId}-${item.variantId}`} className="flex items-center gap-3 py-3 text-sm">
                <Link href={`/product/${item.slug}`} className="relative block h-16 w-16 shrink-0 overflow-hidden rounded bg-elevated">
                  {item.image && <Image src={item.image} alt={item.title} fill sizes="64px" className="object-contain" />}
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/product/${item.slug}`} className="block text-fg hover:text-accent">{item.title}</Link>
                  <p className="mt-0.5 text-xs text-muted">
                    {sizeLabel(item.sizeEu) && `Размер ${sizeLabel(item.sizeEu)} · `}{item.quantity} шт.
                  </p>
                </div>
                <span className="shrink-0 tabular-nums">{formatPrice(item.price * item.quantity)}</span>
                <button type="button" aria-label={`Удалить ${item.title}`} title="Удалить из заказа"
                  onClick={() => remove(item.productId, item.variantId)}
                  className="shrink-0 text-muted transition-colors hover:text-fg">
                  <X className="h-4 w-4" strokeWidth={1.6} />
                </button>
              </li>
            ))}
          </ul>

          <div className="flex gap-2 border-b border-line py-4">
            <input
              type="text"
              value={promocode}
              onChange={(event) => {
                setPromocode(event.target.value);
                setPromoMessage(null);
                setDiscount(0);
                setDiscountPercent(null);
              }}
              placeholder="Промокод"
              aria-label="Промокод"
              className="h-10 min-w-0 flex-1 rounded border border-line bg-bg px-3 text-sm outline-none focus:border-accent"
            />
            <button type="button" onClick={applyPromocode} disabled={promoChecking}
              className="h-10 rounded border border-line px-4 text-sm font-medium hover:border-accent disabled:opacity-60">
              {promoChecking ? "…" : "Применить"}
            </button>
          </div>
          {promoMessage && (
            <p className={cn("pt-2 text-xs", discount > 0 ? "text-success" : "text-danger")}>{promoMessage}</p>
          )}

          <dl className="flex flex-col gap-1.5 py-4 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Товары</dt><dd className="tabular-nums">{formatPrice(subtotal)}</dd></div>
            {discount > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted">Скидка{discountPercent ? ` ${discountPercent} %` : ""}</dt>
                <dd className="tabular-nums text-success">−{formatPrice(discount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted">Доставка</dt>
              <dd className="tabular-nums">
                {quoting ? "Считаем…" : quote ? (quote.price === 0 ? "Бесплатно" : formatPrice(quote.price)) : "—"}
              </dd>
            </div>
            {quote?.periodMax != null && (
              <div className="flex justify-between">
                <dt className="text-muted">Срок</dt>
                <dd className="tabular-nums">
                  {quote.periodMin && quote.periodMin !== quote.periodMax ? `${quote.periodMin}–${quote.periodMax}` : quote.periodMax}{" "}
                  {plural(quote.periodMax, ["день", "дня", "дней"])}
                </dd>
              </div>
            )}
          </dl>

          <div className="flex items-baseline justify-between border-t border-line pt-4">
            <span className="label-caps">Итого</span>
            <span className="text-2xl font-bold tabular-nums">{formatPrice(total)}</span>
          </div>

          {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}

          {/* Без рассчитанной доставки заказ оформить нельзя: сервер всё
              равно пересчитает её и вернёт ошибку. */}
          <button type="submit" disabled={pending || !quote}
            className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-md bg-accent text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-line-strong">
            {pending ? "Оформляем…" : paymentMethod === "online" ? "Перейти к оплате" : "Подтвердить заказ"}
          </button>

          {!quote && !quoting && (
            <p className="mt-3 text-xs text-muted">
              {self
                ? "Укажите адрес — доставим бесплатно"
                : `Выберите город и ${mode === "pvz" ? "пункт выдачи" : "укажите адрес"} — рассчитаем доставку`}
            </p>
          )}
          <p className="mt-3 text-xs text-muted">
            {paymentMethod === "online"
              ? "После подтверждения откроется защищённая страница оплаты ЮKassa."
              : "Оплатите заказ при получении — наличными или картой."}
            {" "}Оформляя заказ, вы соглашаетесь с{" "}
            <Link href="/oferta" className="underline hover:text-accent">офертой</Link>.
          </p>
        </div>
      </aside>
    </form>
  );
}
