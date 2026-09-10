import Link from "next/link";

import { getSizeCharts } from "@/server/repositories/catalog";

const GENDER_LABELS: Record<string, string> = {
  women: "Женская",
  men: "Мужская",
  kids: "Детская",
  unisex: "Унисекс",
};

export default function AdminSizeChartsPage() {
  const charts = getSizeCharts();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">
          Размерные сетки <span className="text-base font-normal text-muted">{charts.length}</span>
        </h1>
        <Link
          href="/admin/size-charts/new"
          className="inline-flex h-9 items-center rounded bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover"
        >
          + Новая сетка
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-line bg-bg">
        <table className="w-full text-sm">
          <thead className="bg-elevated text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-2 font-normal">Название</th>
              <th className="px-4 py-2 font-normal">Тип</th>
              <th className="px-4 py-2 font-normal">Диапазон EU</th>
              <th className="px-4 py-2 font-normal text-right">Строк</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {charts.map((chart) => {
              const sizes = chart.rows.map((row) => row.sizeEu);
              const range = sizes.length ? `${Math.min(...sizes)}–${Math.max(...sizes)}` : "—";
              return (
                <tr key={chart.id} className="hover:bg-sand">
                  <td className="px-4 py-2">
                    <Link href={`/admin/size-charts/${chart.id}`} className="font-medium hover:text-accent">
                      {chart.title}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-muted">{GENDER_LABELS[chart.gender] ?? chart.gender}</td>
                  <td className="px-4 py-2 text-muted">{range}</td>
                  <td className="px-4 py-2 text-right text-muted">{chart.rows.length}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
