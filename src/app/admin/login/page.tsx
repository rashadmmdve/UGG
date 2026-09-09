import { redirect } from "next/navigation";

import { LoginForm } from "@/components/admin/LoginForm";
import { Logo } from "@/components/Logo";
import { getCurrentAdmin } from "@/server/auth/session";

/**
 * Вход в панель управления.
 *
 * Лежит вне защищённой группы маршрутов: иначе проверка прав отправляла
 * бы неавторизованного на эту же страницу и получился бы бесконечный
 * редирект.
 */
export default async function AdminLoginPage() {
  const admin = await getCurrentAdmin();
  if (admin) redirect("/admin");

  return (
    <main className="flex min-h-screen items-center justify-center bg-sand px-4">
      <div className="w-full max-w-sm rounded-lg border border-line bg-bg p-8">
        <Logo width={120} href={null} eager />
        <h1 className="mt-4 text-xl font-bold">Панель управления</h1>
        <p className="mt-1 text-sm text-muted">
          Вход только для сотрудников магазина.
        </p>

        <div className="mt-6">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
