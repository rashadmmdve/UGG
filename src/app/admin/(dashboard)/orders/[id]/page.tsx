import Link from "next/link";
import { notFound } from "next/navigation";

import { ShipmentPanel } from "@/components/admin/ShipmentPanel";
import { SubmitButton } from "@/components/admin/ui";
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/constants";
import { isSelfDelivery } from "@/lib/delivery";
import { paymentLabel } from "@/lib/payment-kind";
import { formatPrice } from "@/lib/utils";
import {
  updateOrderStatusAction,
  updatePaymentStatusAction,
} from "@/server/admin/actions/orders";
import { canCancel } from "@/server/orders/shipment";
import { getOrderById } from "@/server/repositories/orders";
import { getPaymentsByOrderId } from "@/server/repositories/payments";
import type { OrderStatus, PaymentStatus } from "@/lib/types";

/** Ручной перевод возможен между рабочими статусами; отмена — отдельной кнопкой. */
const MANUAL_STATUSES: OrderStatus[] = ["new", "confirmed", "shipped", "completed"];
const PAYMENT_STATUSES: PaymentStatus[] = ["unpaid", "pending", "paid", "refunded"];

export default async function AdminOrderPage(props: PageProps<"/admin/orders/[id]">) {
  const { id } = await props.params;
  const order = getOrderById(id);
  if (!order) notFound();

  const isCancelled = order.status === "cancelled";
  const payments = order.paymentMethod === "online" ? getPaymentsByOrderId(order.id) : [];

  return (
    <div>
      <Link href="/admin/orders" className="text-sm text-muted hover:text-accent">← Заказы</Link>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="font-mono text-2xl font-bold">{order.number}</h1>
        <span className="text-sm text-muted">
          {new Date(order.createdAt).toLocaleString("ru-RU")}
        </span>
        <span className="rounded bg-elevated px-2 py-0.5 text-xs">
          {ORDER_STATUS_LABELS[order.status]}
        </span>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          {/* Позиции */}
          <section className="rounded-lg border border-line bg-bg">
            <table className="w-full text-sm">
              <thead className="bg-elevated text-left text-xs text-muted">
                <tr>
                  <th className="px-4 py-2 font-normal">Товар</th>
                  <th className="px-4 py-2 font-normal">Размер</th>
                  <th className="px-4 py-2 font-normal text-right">Цена</th>
                  <th className="px-4 py-2 font-normal text-right">Кол-во</th>
                  <th className="px-4 py-2 font-normal text-right">Сумма</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {order.items.map((item) => (
                  <tr key={item.variantId}>
                    <td className="px-4 py-2">
                      <Link href={`/admin/products/${item.productId}`} className="hover:text-accent">
                        {item.title}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-muted">EU {item.sizeEu}</td>
                    <td className="px-4 py-2 text-right">{formatPrice(item.price)}</td>
                    <td className="px-4 py-2 text-right">{item.quantity}</td>
                    <td className="px-4 py-2 text-right font-medium">{formatPrice(item.price * item.quantity)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="text-sm">
                <tr className="border-t border-line">
                  <td colSpan={4} className="px-4 py-1.5 text-right text-muted">Товары</td>
                  <td className="px-4 py-1.5 text-right">{formatPrice(order.subtotal)}</td>
                </tr>
                {order.discount > 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-1.5 text-right text-muted">
                      Скидка{order.promocode && <span className="ml-1 font-mono">({order.promocode})</span>}
                    </td>
                    <td className="px-4 py-1.5 text-right text-success">−{formatPrice(order.discount)}</td>
                  </tr>
                )}
                <tr>
                  <td colSpan={4} className="px-4 py-1.5 text-right text-muted">Доставка</td>
                  <td className="px-4 py-1.5 text-right">{formatPrice(order.deliveryPrice)}</td>
                </tr>
                <tr className="border-t border-line font-semibold">
                  <td colSpan={4} className="px-4 py-2 text-right">Итого</td>
                  <td className="px-4 py-2 text-right">{formatPrice(order.total)}</td>
                </tr>
              </tfoot>
            </table>
          </section>

          <ShipmentPanel
            orderId={order.id}
            orderNumber={order.number}
            shipment={order.cdek}
            selfDelivery={isSelfDelivery(order.delivery)}
            deliveryPrice={order.deliveryPrice}
            canCancel={canCancel(order)}
            isCancelled={isCancelled}
          />

          {order.comment && (
            <section className="rounded-lg border border-line bg-bg p-5">
              <h2 className="font-semibold">Комментарий покупателя</h2>
              <p className="mt-2 text-sm leading-relaxed">{order.comment}</p>
            </section>
          )}
        </div>

        <div className="space-y-6">
          <section className="rounded-lg border border-line bg-bg p-5">
            <h2 className="font-semibold">Покупатель</h2>
            <dl className="mt-3 space-y-1 text-sm">
              <dd className="font-medium">{order.customer.name}</dd>
              <dd><a href={`tel:${order.customer.phone}`} className="hover:text-accent">{order.customer.phone}</a></dd>
              <dd><a href={`mailto:${order.customer.email}`} className="hover:text-accent">{order.customer.email}</a></dd>
              {!order.userId && <dd className="text-xs text-muted">Без регистрации</dd>}
            </dl>
          </section>

          <section className="rounded-lg border border-line bg-bg p-5">
            <h2 className="font-semibold">Адрес</h2>
            <dl className="mt-3 space-y-1 text-sm">
              <dd>{order.delivery.mode === "pvz" ? "Пункт выдачи СДЭК" : "Курьером до двери"}</dd>
              <dd className="font-medium">{order.delivery.city}</dd>
              <dd>{order.delivery.address}</dd>
              {order.delivery.pointCode && (
                <dd className="text-xs text-muted">Код ПВЗ: {order.delivery.pointCode}</dd>
              )}
              {order.delivery.periodMin !== null && (
                <dd className="text-xs text-muted">
                  Срок: {order.delivery.periodMin}–{order.delivery.periodMax} дн.
                </dd>
              )}
              <dd className="text-xs text-muted">Вес посылки: {order.packageWeight} г</dd>
            </dl>
          </section>

          <section className="rounded-lg border border-line bg-bg p-5">
            <h2 className="font-semibold">Оплата</h2>
            <p className="mt-2 text-sm">
              {paymentLabel(order)}
              {order.paymentMethod === "on_delivery" && (
                <span className="block text-xs text-muted">
                  {order.cdek
                    ? "Деньги собирает СДЭК при выдаче — отметка об оплате появится сама, когда посылку вручат."
                    : "Деньги берёт наш курьер при вручении. Отметка об оплате ставится сама, когда переводите заказ в «Выполнен»."}
                </span>
              )}
            </p>
            {payments.length > 0 && (
              <ul className="mt-3 space-y-1 border-t border-line pt-3 text-xs">
                {payments.map((payment) => (
                  <li key={payment.id} className="flex justify-between gap-2">
                    <span className="truncate font-mono text-muted" title={payment.externalId}>
                      {payment.externalId.slice(0, 8)}…
                    </span>
                    <span className={payment.status === "paid" ? "text-success" : "text-muted"}>
                      {PAYMENT_STATUS_LABELS[payment.status]} · {new Date(payment.updatedAt).toLocaleString("ru-RU")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <form action={updatePaymentStatusAction} className="mt-3 flex gap-2">
              <input type="hidden" name="id" value={order.id} />
              {/*
                Ключ по текущему значению: после серверного действия React
                сбрасывает форму к defaultValue, а defaultValue при обновлении
                не переприменяется. Без ключа список показывал бы старый статус.
              */}
              <select
                key={order.paymentStatus}
                name="paymentStatus"
                defaultValue={order.paymentStatus}
                className="w-full rounded border border-line bg-bg px-3 py-2 text-sm"
                aria-label="Статус оплаты"
              >
                {PAYMENT_STATUSES.map((status) => (
                  <option key={status} value={status}>{PAYMENT_STATUS_LABELS[status]}</option>
                ))}
              </select>
              <SubmitButton variant="outline">OK</SubmitButton>
            </form>
          </section>

          <section className="rounded-lg border border-line bg-bg p-5">
            <h2 className="font-semibold">Статус заказа</h2>
            {isCancelled ? (
              <p className="mt-3 text-sm text-muted">
                Заказ отменён: остатки возвращены в каталог, обратно не переводится.
              </p>
            ) : (
              <form action={updateOrderStatusAction} className="mt-3 flex gap-2">
                <input type="hidden" name="id" value={order.id} />
                <select
                  key={order.status}
                  name="status"
                  defaultValue={order.status}
                  className="w-full rounded border border-line bg-bg px-3 py-2 text-sm"
                  aria-label="Статус заказа"
                >
                  {MANUAL_STATUSES.map((status) => (
                    <option key={status} value={status}>{ORDER_STATUS_LABELS[status]}</option>
                  ))}
                </select>
                <SubmitButton variant="outline">OK</SubmitButton>
              </form>
            )}
            <p className="mt-2 text-xs text-muted">
              Статусы «отправлен» и «выполнен» проставляются сами по данным СДЭК.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
