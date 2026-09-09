import Link from "next/link";
import { notFound } from "next/navigation";

import { ConfirmForm } from "@/components/admin/ConfirmForm";
import { SizeChartForm } from "@/components/admin/SizeChartForm";
import { deleteSizeChartAction } from "@/server/admin/actions/catalog";
import { getModelLines, getSizeChartById } from "@/server/repositories/catalog";

export default async function AdminEditSizeChartPage(
  props: PageProps<"/admin/size-charts/[id]">,
) {
  const { id } = await props.params;
  const chart = getSizeChartById(id);
  if (!chart) notFound();

  const usedBy = getModelLines().filter((line) => line.sizeChartId === chart.id);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/size-charts" className="text-sm text-muted hover:text-accent">← Размерные сетки</Link>
          <h1 className="mt-2 text-2xl font-bold">{chart.title}</h1>
          {usedBy.length > 0 && (
            <p className="mt-1 text-sm text-muted">
              Используется: {usedBy.map((line) => line.title).join(", ")}
            </p>
          )}
        </div>
        <ConfirmForm
          action={deleteSizeChartAction}
          fields={{ id: chart.id }}
          title="Удалить размерную сетку?"
          description={
            usedBy.length > 0
              ? `Сетка привязана к ${usedBy.length} модельным линиям — у них исчезнет автозаполнение размеров.`
              : "Сетка не привязана ни к одной линии."
          }
          redirectTo="/admin/size-charts"
        />
      </div>
      <div className="mt-6 max-w-3xl">
        <SizeChartForm chart={chart} />
      </div>
    </div>
  );
}
