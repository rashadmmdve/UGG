import Link from "next/link";

import { AdminNav } from "@/components/admin/AdminNav";
import { SITE_NAME } from "@/lib/constants";
import { requireAdmin } from "@/server/admin/guard";
import { logoutAdminAction } from "@/server/auth/actions";

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
  const admin = await requireAdmin();

  return (
    <div className="flex min-h-screen bg-sand">
      <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-bg px-3 py-5">
        <Link href="/admin" className="px-3">
          <span className="label-caps">{SITE_NAME}</span>
          <span className="block text-sm font-semibold">Панель управления</span>
        </Link>

        <div className="mt-6 flex-1 overflow-y-auto">
          <AdminNav />
        </div>

        <div className="mt-6 border-t border-line px-3 pt-4 text-xs text-muted">
          <p className="truncate" title={admin.email}>
            {admin.email}
          </p>
          <div className="mt-2 flex gap-3">
            <Link href="/" className="hover:text-accent" target="_blank">
              Открыть сайт
            </Link>
            <form action={logoutAdminAction}>
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
