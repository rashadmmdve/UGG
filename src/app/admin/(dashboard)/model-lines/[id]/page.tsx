import Link from "next/link";
import { notFound } from "next/navigation";

import { ConfirmForm } from "@/components/admin/ConfirmForm";
import { ModelLineForm } from "@/components/admin/ModelLineForm";
import { deleteModelLineAction } from "@/server/admin/actions/catalog";
import { getModelLineById, getSizeCharts } from "@/server/repositories/catalog";

export default async function AdminEditModelLinePage(
  props: PageProps<"/admin/model-lines/[id]">,
) {
  const { id } = await props.params;
  const line = getModelLineById(id);
  if (!line) notFound();

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/model-lines" className="text-sm text-muted hover:text-accent">← Модельные линии</Link>
          <h1 className="mt-2 text-2xl font-bold">{line.title}</h1>
        </div>
        <ConfirmForm
          action={deleteModelLineAction}
          fields={{ id: line.id }}
          title="Удалить модельную линию?"
          description="Товары этой линии останутся, но потеряют привязку к ней и к её размерной сетке."
          redirectTo="/admin/model-lines"
        />
      </div>
      <div className="mt-6">
        <ModelLineForm line={line} sizeCharts={getSizeCharts()} />
      </div>
    </div>
  );
}
