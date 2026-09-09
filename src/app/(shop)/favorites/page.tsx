import type { Metadata } from "next";

import { FavoritesList } from "@/components/shop/FavoritesList";
import { getPublishedProducts } from "@/server/repositories/catalog";

export const metadata: Metadata = {
  title: "Избранное",
  robots: { index: false, follow: false },
};

export default function FavoritesPage() {
  return (
    <div className="container-page py-10">
      <h1 className="heading-section">Избранное</h1>
      <FavoritesList products={getPublishedProducts()} />
    </div>
  );
}
