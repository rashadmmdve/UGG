import Link from "next/link";

import { PromocodeForm } from "@/components/admin/PromocodeForm";

export default function AdminNewPromocodePage() {
  return (
    <div>
      <Link href="/admin/promocodes" className="text-sm text-muted hover:text-accent">← Промокоды</Link>
      <h1 className="mt-2 text-2xl font-bold">Новый промокод</h1>
      <div className="mt-6 max-w-3xl">
        <PromocodeForm promocode={null} />
      </div>
    </div>
  );
}
