import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AdminNav } from "@/components/admin/AdminNav";
import { Logo } from "@/components/Logo";
import { isOperatorPath, requireStaff } from "@/server/admin/guard";
import { logoutAction } from "@/server/auth/actions";

/**
 * Защищённая часть админки.
 *
 * Проверка прав здесь не даёт отрисовать страницу постороннему, но
 * серверные действия она не защищает — те доступны прямым POST-запросом,
 * поэтому каждое действие проверяет права само.
 */
export default async function AdminDashboardLayout({
  children,
}: LayoutProps<"/admin">) {
  const admin = await requireStaff();

  // Оператор ведёт заказы и курьеров; всё прочее в админке — владельцу.
  if (admin.role === "operator") {
    const pathname = (await headers()).get("x-pathname") ?? "";
    if (!isOperatorPath(pathname)) redirect("/admin/orders");
  }

  return (
    <div className="flex min-h-screen bg-sand">
      <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-bg px-3 py-5">
        <div className="px-3">
          <Logo width={96} href="/admin" eager />
          <span className="mt-1 block text-xs font-medium text-muted">
            Панель управления
          </span>
        </div>

        <div className="mt-6 flex-1 overflow-y-auto">
          <AdminNav role={admin.role} />
        </div>

        <div className="mt-6 border-t border-line px-3 pt-4 text-xs text-muted">
          <p className="truncate" title={admin.email}>
            {admin.email}
          </p>
          <div className="mt-2 flex gap-3">
            <Link href="/" className="hover:text-accent" target="_blank">
              Открыть сайт
            </Link>
            <form action={logoutAction}>
              <button type="submit" className="hover:text-accent">
                Выйти
              </button>
            </form>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-8 py-6">{children}</main>
    </div>
  );
}
