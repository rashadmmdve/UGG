import Link from "next/link";

import { formatPrice } from "@/lib/utils";
import { requireAdmin } from "@/server/admin/guard";
import { RolePicker } from "@/components/admin/RolePicker";
import { getOrders } from "@/server/repositories/orders";
import { getUsers } from "@/server/repositories/users";

/**
 * Клиенты — только чтение. Персональные данные здесь показываются
 * сотруднику магазина для обработки заказов; править их из админки
 * нельзя, покупатель делает это сам в личном кабинете.
 *
 * Поиск отдельный по каждому полю и считается на сервере: список растёт
 * вместе с магазином, и держать его целиком в браузере ради фильтра
 * незачем. У телефона сравниваются только цифры — записан он может быть
 * с любыми скобками и пробелами.
 */
const digits = (value: string) => value.replace(/\D/g, "");

export default async function AdminCustomersPage(props: PageProps<"/admin/customers">) {
  const admin = await requireAdmin();

  const params = await props.searchParams;
  const text = (key: string) =>
    typeof params[key] === "string" ? params[key].trim().toLowerCase() : "";
  const nameQuery = text("name");
  const emailQuery = text("email");
  const phoneQuery = digits(text("phone"));
  const filtered = Boolean(nameQuery || emailQuery || phoneQuery);

  // Показываем всех, включая сотрудников: роль выдаётся здесь же, и
  // искать оператора в отдельном списке было бы странно.
  const all = getUsers();
  const customers = all.filter(
    (user) =>
      (!nameQuery || user.name.toLowerCase().includes(nameQuery)) &&
      (!emailQuery || user.email.toLowerCase().includes(emailQuery)) &&
      (!phoneQuery || digits(user.phone).includes(phoneQuery)),
  );
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
        Клиенты{" "}
        <span className="text-base font-normal text-muted">
          {filtered ? `${customers.length} из ${all.length}` : all.length}
        </span>
      </h1>
      <p className="mt-2 text-sm text-muted">
        Зарегистрированные покупатели и сотрудники. Заказов без регистрации:{" "}
        {guestOrders}. Оператору открыты только заказы и курьеры — ни товаров,
        ни цен, ни финансов он не видит.
      </p>

      <form className="mt-6 flex flex-wrap items-end gap-3">
        {[
          { name: "name", label: "Имя", placeholder: "Иван" },
          { name: "email", label: "Почта", placeholder: "mail@example.com" },
          { name: "phone", label: "Телефон", placeholder: "909" },
        ].map((field) => (
          <label key={field.name} className="flex flex-col gap-1 text-xs text-muted">
            {field.label}
            <input
              type="search"
              name={field.name}
              defaultValue={typeof params[field.name] === "string" ? params[field.name] : ""}
              placeholder={field.placeholder}
              className="h-9 w-56 rounded border border-line bg-bg px-3 text-sm text-fg outline-none focus:border-accent"
            />
          </label>
        ))}
        <button type="submit" className="h-9 rounded border border-line px-4 text-sm hover:border-accent">
          Найти
        </button>
        {filtered && (
          <Link href="/admin/customers" className="h-9 self-end px-1 text-sm leading-9 text-muted hover:text-accent">
            Сбросить
          </Link>
        )}
      </form>

      {customers.length === 0 ? (
        <p className="mt-8 text-sm text-muted">
          {filtered ? "По этим условиям никого нет." : "Пока никто не зарегистрировался."}
        </p>
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
