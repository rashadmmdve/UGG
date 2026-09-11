import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Clock } from "lucide-react";

import { PayOrderButton } from "@/components/shop/PayOrderButton";
import { SelfDeliveryDialog } from "@/components/shop/SelfDeliveryDialog";
import { isSelfDelivery } from "@/lib/delivery";
import { canPayOnline } from "@/lib/payable";
import { getCurrentCustomer } from "@/server/auth/session";
import { syncOrderPayments } from "@/server/payments/flow";
import { getOrderById } from "@/server/repositories/orders";

export const metadata: Metadata = {
  title: "Заказ оформлен",
  robots: { index: false, follow: false },
};

/**
 * Страница после оформления — и сюда же ЮKassa возвращает покупателя
 * после оплаты. В адресе — идентификатор заказа, а не номер: он случайный,
 * и чужой заказ по нему не подсмотреть.
 *
 * Статус платежа сверяется с ЮKassa прямо здесь: вебхук идёт параллельно
 * и может опоздать на несколько секунд, а покупатель уже смотрит на
 * страницу и ждёт слова «оплачено».
 */
export default async function CheckoutSuccessPage(props: PageProps<"/checkout/success">) {
  const { order: param } = await props.searchParams;
  const id = typeof param === "string" ? param : null;
  const user = await getCurrentCustomer();

  let order = id ? getOrderById(id) : null;
  if (order?.paymentMethod === "online" && order.paymentStatus !== "paid") {
    order = await syncOrderPayments(order);
  }

  const online = order?.paymentMethod === "online";
  const paid = order?.paymentStatus === "paid";
  const awaitingPayment = online && !paid && order?.status !== "cancelled";
  // Заказ с оплатой при получении тоже можно оплатить картой, если
  // деньги не собирает СДЭК: ссылка на эту страницу уходит в письме.
  const payable = Boolean(order && canPayOnline(order));
  // Окно показываем, когда с заказом уже всё решено: висеть поверх
  // страницы «оплатите заказ» ему незачем.
  const selfDelivery = Boolean(order && isSelfDelivery(order.delivery)) && !awaitingPayment;

  const button =
    "inline-flex h-11 items-center rounded-md px-6 text-sm font-semibold";

  return (
    <div className="container-page flex flex-col items-center py-20 text-center">
      {selfDelivery && <SelfDeliveryDialog />}
      {awaitingPayment ? (
        <Clock className="h-12 w-12 text-muted" strokeWidth={1.4} />
      ) : (
        <CheckCircle2 className="h-12 w-12 text-success" strokeWidth={1.4} />
      )}

      <h1 className="heading-section mt-4">
        {awaitingPayment ? "Заказ ждёт оплаты" : paid ? "Оплата прошла, спасибо!" : "Спасибо за заказ!"}
      </h1>

      {order && (
        <p className="mt-2 text-muted">
          Номер вашего заказа — <span className="font-mono font-semibold text-fg">{order.number}</span>
        </p>
      )}

      <p className="mt-4 max-w-md text-sm text-muted">
        {awaitingPayment
          ? "Платёж не завершён. Товары зарезервированы — оплатите заказ, и мы сразу передадим его в доставку."
          : selfDelivery
            ? "Мы отправили подтверждение на почту. Заказ по вашему городу везём сами — свяжемся и согласуем доставку."
            : paid
              ? "Чек отправлен на почту. Соберём заказ и передадим в СДЭК — трек-номер появится в личном кабинете."
              : "Мы отправили подтверждение на почту. Оплатить заказ можно при получении — наличными или картой."}
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {payable && order && <PayOrderButton orderId={order.id} />}
        {user ? (
          <Link href="/account" className={`${button} ${awaitingPayment ? "border border-line hover:border-accent" : "bg-accent text-white hover:bg-accent-hover"}`}>
            Мои заказы
          </Link>
        ) : (
          <Link href="/account/register" className={`${button} ${awaitingPayment ? "border border-line hover:border-accent" : "bg-accent text-white hover:bg-accent-hover"}`}>
            Создать аккаунт, чтобы следить за доставкой
          </Link>
        )}
        <Link href="/catalog" className={`${button} border border-line font-medium hover:border-accent`}>
          В каталог
        </Link>
      </div>
    </div>
  );
}
