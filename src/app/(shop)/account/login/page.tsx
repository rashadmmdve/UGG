import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/shop/AuthForms";
import { getCurrentCustomer } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "Вход",
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  if (await getCurrentCustomer()) redirect("/account");

  return (
    <div className="container-page py-10">
      <div className="mx-auto max-w-sm">
        <h1 className="heading-section">Вход</h1>
        <p className="mt-1 text-sm text-muted">Чтобы следить за заказами и не вводить адрес заново.</p>
        <div className="mt-6"><LoginForm /></div>
      </div>
    </div>
  );
}
