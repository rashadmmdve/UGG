import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { RegisterForm } from "@/components/shop/AuthForms";
import { getCurrentCustomer } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "Регистрация",
  robots: { index: false, follow: false },
};

export default async function RegisterPage() {
  if (await getCurrentCustomer()) redirect("/account");

  return (
    <div className="container-page py-10">
      <div className="mx-auto max-w-sm">
        <h1 className="heading-section">Регистрация</h1>
        <p className="mt-1 text-sm text-muted">Заказы, трек-номера и этикетки — в одном месте.</p>
        <div className="mt-6"><RegisterForm /></div>
      </div>
    </div>
  );
}
