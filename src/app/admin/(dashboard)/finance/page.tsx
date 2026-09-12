import { CourierSettlement } from "@/components/admin/CourierSettlement";
import { paymentLabel } from "@/lib/payment-kind";
import { getCouriers } from "@/server/repositories/couriers";
import { formatPrice } from "@/lib/utils";
import { requireAdmin } from "@/server/admin/guard";
import { getOrders } from "@/server/repositories/orders";
import { getPricingRows } from "@/server/repositories/pricing";
import type { Order } from "@/lib/types";

/**
 * Финансы: сколько денег пришло, чем заплатили и сколько пар продано.
 *
 * Считаем только по оплаченным заказам: выставленный счёт деньгами не
 * является, а отменённый заказ — тем более. Разрез по способу оплаты
 * берётся из самого заказа (см. paymentLabel), чтобы в отчёте и в
 * карточке заказа было написано одно и то же.
 *
 * Себестоимость знает не каждый товар, поэтому прибыль показывается как
 * «по тем позициям, где себестоимость указана» — иначе цифра выглядела
 * бы точной, не будучи такой.
 */

const PERIODS = [
  { key: "month", label: "Месяц", days: 30 },
  { key: "quarter", label: "Квартал", days: 92 },
  { key: "year", label: "Год", days: 365 },
  { key: "all", label: "Всё время", days: 0 },
] as const;

type Bucket = { orders: number; units: number; revenue: number };

const empty = (): Bucket => ({ orders: 0, units: 0, revenue: 0 });

/**
 * Начало периода. Вынесено из компонента: часы — внешний мир, и
 * дёргать их прямо при отрисовке нельзя.
 */
function periodStart(days: number): string {
  if (!days) return "";
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function units(order: Order): number {
  return order.items.reduce((sum, item) => sum + item.quantity, 0);
}

export default async function AdminFinancePage(props: PageProps<"/admin/finance">) {
  await requireAdmin();

  const params = await props.searchParams;
  const periodKey = typeof params.period === "string" ? params.period : "month";
  const period = PERIODS.find((item) => item.key === periodKey) ?? PERIODS[0];

  const since = periodStart(period.days);

  // Расчёт с курьером: свой курьер и свой период, не зависящий от общего.
  const courierId = typeof params.courier === "string" ? params.courier : "";
  const from = typeof params.from === "string" ? params.from : "";
  const to = typeof params.to === "string" ? params.to : "";
  const couriers = getCouriers();

  const all = getOrders().filter((order) => order.createdAt >= since);
  const paid = all.filter((order) => order.paymentStatus === "paid" && order.status !== "cancelled");

  // Разрез по способу оплаты: карта, наличные, наложенный платёж.
  const byMethod = new Map<string, Bucket>();
  for (const order of paid) {
    const key = paymentLabel(order);
    const bucket = byMethod.get(key) ?? empty();
    bucket.orders += 1;
    bucket.units += units(order);
    bucket.revenue += order.total;
    byMethod.set(key, bucket);
  }

  const total = paid.reduce(
    (sum, order) => {
      sum.orders += 1;
      sum.units += units(order);
      sum.revenue += order.total;
      return sum;
    },
    empty(),
  );

  const delivery = paid.reduce((sum, order) => sum + order.deliveryPrice, 0);
  const discount = paid.reduce((sum, order) => sum + order.discount, 0);
  const awaiting = all.filter(
    (order) => order.paymentStatus !== "paid" && order.status !== "cancelled",
  );

  // Себестоимость по текущим карточкам: цена закупки в заказе не
  // хранится, поэтому берём её из каталога на сегодня.
  const cost = new Map(getPricingRows().map((row) => [row.id, row.costPrice]));
  let costKnown = 0;
  let revenueKnown = 0;
  for (const order of paid) {
    for (const item of order.items) {
      const unitCost = cost.get(item.productId);
      if (unitCost == null) continue;
      costKnown += unitCost * item.quantity;
      revenueKnown += item.price * item.quantity;
    }
  }
  const profit = revenueKnown - costKnown;

  const courierOrders = courierId
    ? getOrders()
        .filter((order) => order.courierId === courierId && order.status === "completed" && order.deliveredAt)
        .filter((order) => {
          const day = order.deliveredAt!.slice(0, 10);
          return (!from || day >= from) && (!to || day <= to);
        })
        .sort((a, b) => (a.deliveredAt! < b.deliveredAt! ? 1 : -1))
    : [];

  const card = "rounded-lg border border-line bg-bg p-5";
  const tab =
    "inline-flex h-9 items-center rounded border px-4 text-sm transition-colors";

  return (
    <div>
      <h1 className="text-2xl font-bold">Финансы</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted">
        Деньги по оплаченным заказам. Выставленный счёт и отменённые заказы сюда
        не попадают, средний чек считается по ним же.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {PERIODS.map((item) => (
          <a
            key={item.key}
            href={`/admin/finance?period=${item.key}`}
            className={`${tab} ${item.key === period.key ? "border-accent text-accent" : "border-line hover:border-accent"}`}
          >
            {item.label}
          </a>
        ))}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className={card}>
          <p className="label-caps">Выручка</p>
          <p className="mt-2 text-2xl font-bold tabular-nums">{formatPrice(total.revenue)}</p>
          <p className="mt-1 text-xs text-muted">заказов: {total.orders}</p>
        </div>
        <div className={card}>
          <p className="label-caps">Продано пар</p>
          <p className="mt-2 text-2xl font-bold tabular-nums">{total.units}</p>
          <p className="mt-1 text-xs text-muted">
            средний чек: {total.orders ? formatPrice(Math.round(total.revenue / total.orders)) : "—"}
          </p>
        </div>
        <div className={card}>
          <p className="label-caps">Доставка в выручке</p>
          <p className="mt-2 text-2xl font-bold tabular-nums">{formatPrice(delivery)}</p>
          <p className="mt-1 text-xs text-muted">скидки: −{formatPrice(discount)}</p>
        </div>
        <div className={card}>
          <p className="label-caps">Ждут оплаты</p>
          <p className="mt-2 text-2xl font-bold tabular-nums">
            {formatPrice(awaiting.reduce((sum, order) => sum + order.total, 0))}
          </p>
          <p className="mt-1 text-xs text-muted">заказов: {awaiting.length}</p>
        </div>
      </div>

      <section className="mt-6 overflow-x-auto rounded-lg border border-line bg-bg">
        <table className="w-full text-sm">
          <thead className="bg-elevated text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-2 font-normal">Чем заплатили</th>
              <th className="px-4 py-2 text-right font-normal">Заказов</th>
              <th className="px-4 py-2 text-right font-normal">Пар</th>
              <th className="px-4 py-2 text-right font-normal">Сумма</th>
              <th className="px-4 py-2 text-right font-normal">Доля</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {byMethod.size === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-muted">
                  За этот период оплат не было.
                </td>
              </tr>
            ) : (
              [...byMethod.entries()]
                .sort((a, b) => b[1].revenue - a[1].revenue)
                .map(([label, bucket]) => (
                  <tr key={label}>
                    <td className="px-4 py-2">{label}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{bucket.orders}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{bucket.units}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatPrice(bucket.revenue)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted">
                      {total.revenue ? Math.round((bucket.revenue / total.revenue) * 100) : 0}%
                    </td>
                  </tr>
                ))
            )}
          </tbody>
        </table>
      </section>

      <section className={`mt-6 ${card}`}>
        <h2 className="font-semibold">Прибыль по товарам</h2>
        <p className="mt-1 text-xs text-muted">
          Только по позициям, у которых в каталоге указана себестоимость: по
          остальным считать нечего, и в общую цифру они не входят.
        </p>
        <dl className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted">Продано на</dt>
            <dd className="text-lg font-semibold tabular-nums">{formatPrice(revenueKnown)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Себестоимость</dt>
            <dd className="text-lg font-semibold tabular-nums">{formatPrice(costKnown)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Разница</dt>
            <dd className={`text-lg font-semibold tabular-nums ${profit < 0 ? "text-danger" : "text-success"}`}>
              {formatPrice(profit)}
              {revenueKnown > 0 && (
                <span className="ml-2 text-xs font-normal text-muted">
                  {Math.round((profit / revenueKnown) * 100)}%
                </span>
              )}
            </dd>
          </div>
        </dl>
      </section>

      <CourierSettlement
        couriers={couriers}
        courierId={courierId}
        from={from}
        to={to}
        orders={courierOrders}
      />
    </div>
  );
}
