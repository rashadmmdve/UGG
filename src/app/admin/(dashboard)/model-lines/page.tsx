import Link from "next/link";

import { getModelLines, getSizeChartById } from "@/server/repositories/catalog";

const GENDER_LABELS: Record<string, string> = {
  women: "жен.",
  men: "муж.",
  kids: "дет.",
  unisex: "унисекс",
};

export default function AdminModelLinesPage() {
  const lines = getModelLines();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">
          Модельные линии <span className="text-base font-normal text-muted">{lines.length}</span>
        </h1>
        <Link
          href="/admin/model-lines/new"
          className="inline-flex h-9 items-center rounded bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover"
        >
          + Новая линия
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-line bg-bg">
        <table className="w-full text-sm">
          <thead className="bg-elevated text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-2 font-normal">Название</th>
              <th className="px-4 py-2 font-normal">Код</th>
              <th className="px-4 py-2 font-normal">Для кого</th>
              <th className="px-4 py-2 font-normal">Размерная сетка</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {lines.map((line) => (
              <tr key={line.id} className="hover:bg-sand">
                <td className="px-4 py-2">
                  <Link href={`/admin/model-lines/${line.id}`} className="font-medium hover:text-accent">
                    {line.title}
                  </Link>
                </td>
                <td className="px-4 py-2 text-muted">{line.slug}</td>
                <td className="px-4 py-2 text-muted">
                  {line.genders.map((g) => GENDER_LABELS[g] ?? g).join(", ")}
                </td>
                <td className="px-4 py-2 text-muted">
                  {line.sizeChartId ? (getSizeChartById(line.sizeChartId)?.title ?? "—") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
