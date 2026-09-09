import Link from "next/link";

import { CategoryForm } from "@/components/admin/CategoryForm";

export default function AdminNewCategoryPage() {
  return (
    <div>
      <Link href="/admin/categories" className="text-sm text-muted hover:text-accent">← Категории</Link>
      <h1 className="mt-2 text-2xl font-bold">Новая категория</h1>
      <div className="mt-6">
        <CategoryForm category={null} />
      </div>
    </div>
  );
}
