import Link from "next/link";

import { ProductForm } from "@/components/admin/ProductForm";
import {
  getCategories,
  getColors,
  getModelLines,
  getSizeCharts,
} from "@/server/repositories/catalog";

export default function AdminNewProductPage() {
  return (
    <div>
      <Link href="/admin/products" className="text-sm text-muted hover:text-accent">
        ← Товары
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Новый товар</h1>

      <div className="mt-6">
        <ProductForm
          product={null}
          categories={getCategories()}
          modelLines={getModelLines()}
          colors={getColors()}
          sizeCharts={getSizeCharts()}
        />
      </div>
    </div>
  );
}
