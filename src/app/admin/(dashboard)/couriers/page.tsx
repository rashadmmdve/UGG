import { SubmitButton } from "@/components/admin/ui";
import { requireStaff } from "@/server/admin/guard";
import { deleteCourierAction, saveCourierAction } from "@/server/admin/actions/couriers";
import { getCouriers } from "@/server/repositories/couriers";
import { getOrders } from "@/server/repositories/orders";

/**
 * Курьеры своей доставки.
 *
 * Справочник ведёт владелец: курьеру открываются телефоны и адреса
 * покупателей, поэтому оператор его только видит в списке назначения,
 * а заводить и удалять не может.
 *
 * Идентификатор в Телеграме — то, по чему бот отличает «его» заказы от
 * чужих. Курьер узнаёт его командой /id в группе доставки.
 */
export default async function AdminCouriersPage() {
  const staff = await requireStaff();
  const canEdit = staff.role === "admin";

  const couriers = getCouriers();
  const orders = getOrders();

  const load = new Map<string, number>();
  for (const order of orders) {
    if (!order.courierId) continue;
    if (order.status === "cancelled" || order.status === "completed") continue;
    load.set(order.courierId, (load.get(order.courierId) ?? 0) + 1);
  }

  const field =
    "h-9 w-full rounded border border-line bg-bg px-3 text-sm text-fg outline-none focus:border-accent";

  return (
    <div>
      <h1 className="text-2xl font-bold">
        Курьеры <span className="text-base font-normal text-muted">{couriers.length}</span>
      </h1>
      <p className="mt-2 max-w-3xl text-sm text-muted">
        Возят заказы по своему городу. Чтобы курьер видел в Телеграме только свои
        заказы, попросите его написать <code>/id</code> в группе «Доставка» — бот
        ответит числом, его и впишите.
      </p>

      {canEdit && (
      <section className="mt-6 rounded-lg border border-line bg-bg p-5">
        <h2 className="font-semibold">Новый курьер</h2>
        <form action={saveCourierAction} className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <input name="name" placeholder="Имя" className={field} required />
          <input name="phone" placeholder="Телефон" className={field} />
          <input name="telegramId" placeholder="ID в Телеграме" inputMode="numeric" className={field} />
          <SubmitButton>Добавить</SubmitButton>
        </form>
      </section>
      )}

      {couriers.length === 0 ? (
        <p className="mt-8 text-sm text-muted">Курьеров пока нет.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-line bg-bg">
          <table className="w-full text-sm">
            <thead className="bg-elevated text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-2 font-normal">Имя</th>
                <th className="px-4 py-2 font-normal">Телефон</th>
                <th className="px-4 py-2 font-normal">ID в Телеграме</th>
                <th className="px-4 py-2 text-center font-normal">Работает</th>
                <th className="px-4 py-2 text-right font-normal">Заказов в работе</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {couriers.map((courier) => (
                <tr key={courier.id} className={courier.isActive ? "" : "opacity-60"}>
                  <td className="px-4 py-2">
                    <form action={saveCourierAction} id={`courier-${courier.id}`} className="contents">
                      <input type="hidden" name="id" value={courier.id} />
                      <input name="name" defaultValue={courier.name} className={field} />
                    </form>
                  </td>
                  <td className="px-4 py-2">
                    <input form={`courier-${courier.id}`} name="phone" defaultValue={courier.phone} className={field} />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      form={`courier-${courier.id}`}
                      name="telegramId"
                      defaultValue={courier.telegramId}
                      inputMode="numeric"
                      className={field}
                    />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <input
                      form={`courier-${courier.id}`}
                      type="checkbox"
                      name="isActive"
                      defaultChecked={courier.isActive}
                      className="h-4 w-4 accent-[var(--accent)]"
                    />
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{load.get(courier.id) ?? 0}</td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-2">
                      <button
                        form={`courier-${courier.id}`}
                        type="submit"
                        className="rounded border border-line px-3 py-1.5 text-sm hover:border-accent"
                      >
                        Сохранить
                      </button>
                      <form action={deleteCourierAction}>
                        <input type="hidden" name="id" value={courier.id} />
                        <button
                          type="submit"
                          className="rounded border border-danger/40 px-3 py-1.5 text-sm text-danger hover:bg-danger/5"
                        >
                          Удалить
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
