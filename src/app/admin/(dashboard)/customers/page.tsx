import { formatPrice } from "@/lib/utils";
import { requireAdmin } from "@/server/admin/guard";
import { RolePicker } from "@/components/admin/RolePicker";
import { getOrders } from "@/server/repositories/orders";
import { getUsers } from "@/server/repositories/users";

/**
 * Клиенты — только чтение. Персональные данные здесь показываются
 * сотруднику магазина для обработки заказов; править их из админки
 * нельзя, покупатель делает это сам в личном кабинете.
 */
export default async function AdminCustomersPage() {
  const admin = await requireAdmin();

  // Показываем всех, включая сотрудников: роль выдаётся здесь же, и
  // искать оператора в отдельном списке было бы странно.
  const customers = getUsers();
  const orders = getOrders();

  const stats = new Map<string, { count: number; total: number }>();
  let guestOrders = 0;
  for (const order of orders) {
    if (!order.userId) {
      guestOrders += 1;
      continue;
    }
    const entry = stats.get(order.userId) ?? { count: 0, total: 0 };
    entry.count += 1;
    if (order.status !== "cancelled") entry.total += order.total;
    stats.set(order.userId, entry);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">
        Клиенты <span className="text-base font-normal text-muted">{customers.length}</span>
      </h1>
      <p className="mt-2 text-sm text-muted">
        Зарегистрированные покупатели и сотрудники. Заказов без регистрации:{" "}
        {guestOrders}. Оператору открыты только заказы и курьеры — ни товаров,
        ни цен, ни финансов он не видит.
      </p>

      {customers.length === 0 ? (
        <p className="mt-8 text-sm text-muted">Пока никто не зарегистрировался.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-line bg-bg">
          <table className="w-full text-sm">
            <thead className="bg-elevated text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-2 font-normal">Имя</th>
                <th className="px-4 py-2 font-normal">Почта</th>
                <th className="px-4 py-2 font-normal">Телефон</th>
                <th className="px-4 py-2 font-normal">Регистрация</th>
                <th className="px-4 py-2 font-normal">Роль</th>
                <th className="px-4 py-2 font-normal text-right">Заказов</th>
                <th className="px-4 py-2 font-normal text-right">Сумма</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {customers.map((customer) => {
                const entry = stats.get(customer.id) ?? { count: 0, total: 0 };
                return (
                  <tr key={customer.id} className="hover:bg-sand">
                    <td className="px-4 py-2 font-medium">{customer.name || "—"}</td>
                    <td className="px-4 py-2 text-muted">{customer.email}</td>
                    <td className="px-4 py-2 text-muted">{customer.phone || "—"}</td>
                    <td className="px-4 py-2 text-muted">{customer.createdAt.slice(0, 10)}</td>
                    <td className="px-4 py-2">
                      {customer.id === admin.id ? (
                        <span className="text-xs text-muted">это вы</span>
                      ) : (
                        <RolePicker id={customer.id} role={customer.role} email={customer.email} />
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">{entry.count}</td>
                    <td className="px-4 py-2 text-right">{formatPrice(entry.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
