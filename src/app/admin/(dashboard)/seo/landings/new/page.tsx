import Link from "next/link";

import { LandingForm } from "@/components/admin/LandingForm";
import { getColors, getPublishedCategories } from "@/server/repositories/catalog";

export default function AdminNewLandingPage() {
  return (
    <div>
      <Link href="/admin/seo" className="text-sm text-muted hover:text-accent">← Посадочные страницы</Link>
      <h1 className="mt-2 text-2xl font-bold">Новая посадочная</h1>
      <div className="mt-6">
        <LandingForm
          landing={null}
          categories={getPublishedCategories()}
          colors={getColors()}
          productCount={null}
        />
      </div>
    </div>
  );
}
