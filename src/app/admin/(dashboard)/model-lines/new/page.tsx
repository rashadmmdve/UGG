import Link from "next/link";

import { ModelLineForm } from "@/components/admin/ModelLineForm";
import { getSizeCharts } from "@/server/repositories/catalog";

export default function AdminNewModelLinePage() {
  return (
    <div>
      <Link href="/admin/model-lines" className="text-sm text-muted hover:text-accent">← Модельные линии</Link>
      <h1 className="mt-2 text-2xl font-bold">Новая модельная линия</h1>
      <div className="mt-6">
        <ModelLineForm line={null} sizeCharts={getSizeCharts()} />
      </div>
    </div>
  );
}
