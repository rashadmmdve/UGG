import { DispatchBoard } from "@/components/admin/DispatchBoard";
import { isSelfDelivery } from "@/lib/delivery";
import { requireStaff } from "@/server/admin/guard";
import { getCouriers } from "@/server/repositories/couriers";
import { getOrders } from "@/server/repositories/orders";
import { getDispatchSettings } from "@/server/repositories/settings";

/**
 * Распределение — рабочее место оператора.
 *
 * Здесь только то, что требует решения: заказы своей доставки без
 * курьера. Оператор отдаёт каждый курьеру (заказ при этом
 * подтверждается) или отменяет с причиной. Курьерам списки уходят
 * только по кнопке «Отправить сейчас» — или утром, если включена
 * галочка ежедневной рассылки.
 */
export default async function AdminDispatchPage() {
  await requireStaff();
  const { daily } = getDispatchSettings();

  const orders = getOrders().filter(
    (order) =>
      isSelfDelivery(order.delivery) &&
      !order.courierId &&
      order.status !== "cancelled" &&
      order.status !== "completed",
  );
  const couriers = getCouriers().filter((courier) => courier.isActive);

  return (
    <div>
      <h1 className="text-2xl font-bold">
        Распределение{" "}
        <span className="text-base font-normal text-muted">{orders.length}</span>
      </h1>
      <p className="mt-2 max-w-3xl text-sm text-muted">
        Заказы своей доставки, которые ещё никому не отданы. Выберите курьера —
        заказ подтвердится и закрепится за ним. Отмена — с причиной, она
        сохранится в заказе. Когда всё роздано, нажмите «Отправить сейчас» —
        каждый курьер получит в Телеграм свой список.
      </p>

      {couriers.length === 0 && (
        <p className="mt-4 rounded border border-line bg-elevated px-4 py-3 text-sm text-muted">
          Курьеров пока нет — раздавать некому. Владелец заводит их в разделе «Курьеры».
        </p>
      )}

      <div className="mt-6">
        <DispatchBoard orders={orders} couriers={couriers} daily={daily} />
      </div>
    </div>
  );
}
