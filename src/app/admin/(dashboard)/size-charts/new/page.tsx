import Link from "next/link";

import { SizeChartForm } from "@/components/admin/SizeChartForm";

export default function AdminNewSizeChartPage() {
  return (
    <div>
      <Link href="/admin/size-charts" className="text-sm text-muted hover:text-accent">← Размерные сетки</Link>
      <h1 className="mt-2 text-2xl font-bold">Новая размерная сетка</h1>
      <div className="mt-6 max-w-3xl">
        <SizeChartForm chart={null} />
      </div>
    </div>
  );
}
