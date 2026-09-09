import Link from "next/link";
import { notFound } from "next/navigation";

import { ColorForm } from "@/components/admin/ColorForm";
import { ConfirmForm } from "@/components/admin/ConfirmForm";
import { deleteColorAction } from "@/server/admin/actions/catalog";
import { getColorById, getColors } from "@/server/repositories/catalog";

export default async function AdminEditColorPage(
  props: PageProps<"/admin/colors/[id]">,
) {
  const { id } = await props.params;
  const color = getColorById(id);
  if (!color) notFound();

  const groups = [...new Set(getColors().map((item) => item.group))];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/colors" className="text-sm text-muted hover:text-accent">← Цвета</Link>
          <h1 className="mt-2 flex items-center gap-3 text-2xl font-bold">
            <span className="h-6 w-6 rounded-full border border-line" style={{ backgroundColor: color.hex }} aria-hidden />
            {color.title}
          </h1>
        </div>
        <ConfirmForm
          action={deleteColorAction}
          fields={{ id: color.id }}
          title="Удалить цвет?"
          description="Товары с этим оттенком останутся без цвета и выпадут из цветовых посадочных страниц."
          redirectTo="/admin/colors"
        />
      </div>
      <div className="mt-6 max-w-2xl">
        <ColorForm color={color} groups={groups} />
      </div>
    </div>
  );
}
