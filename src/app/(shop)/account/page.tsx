import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AccountTabs } from "@/components/shop/AccountTabs";
import { getCurrentCustomer } from "@/server/auth/session";
import { getOrdersByUserId } from "@/server/repositories/orders";

export const metadata: Metadata = {
  title: "Личный кабинет",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const user = await getCurrentCustomer();
  if (!user) redirect("/account/login");

  return (
    <div className="container-page py-10">
      <h1 className="heading-section">Личный кабинет</h1>
      <p className="mt-1 text-sm text-muted">{user.name || user.email}</p>
      <AccountTabs user={user} orders={getOrdersByUserId(user.id)} />
    </div>
  );
}
