import type { Metadata } from "next";

import { CheckoutForm } from "@/components/shop/CheckoutForm";
import { getCurrentCustomer } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "Оформление заказа",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  const user = await getCurrentCustomer();

  return (
    <div className="container-page py-10">
      <h1 className="heading-section">Оформление заказа</h1>
      <CheckoutForm user={user} />
    </div>
  );
}
