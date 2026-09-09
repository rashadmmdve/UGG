import Link from "next/link";

import { ColorForm } from "@/components/admin/ColorForm";
import { getColors } from "@/server/repositories/catalog";

export default function AdminNewColorPage() {
  const groups = [...new Set(getColors().map((color) => color.group))];

  return (
    <div>
      <Link href="/admin/colors" className="text-sm text-muted hover:text-accent">← Цвета</Link>
      <h1 className="mt-2 text-2xl font-bold">Новый цвет</h1>
      <div className="mt-6 max-w-2xl">
        <ColorForm color={null} groups={groups} />
      </div>
    </div>
  );
}
