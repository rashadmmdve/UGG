import type { Metadata } from "next";

import { CartView } from "@/components/shop/CartView";

export const metadata: Metadata = {
  title: "Корзина",
  robots: { index: false, follow: false },
};

export default function CartPage() {
  return (
    <div className="container-page py-10">
      <h1 className="heading-section">Корзина</h1>
      <CartView />
    </div>
  );
}
