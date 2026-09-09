import Link from "next/link";
import { notFound } from "next/navigation";

import { ConfirmForm } from "@/components/admin/ConfirmForm";
import { PromocodeForm } from "@/components/admin/PromocodeForm";
import { FormMessage } from "@/components/admin/ui";
import { deletePromocodeAction } from "@/server/admin/actions/promocodes";
import { getPromocodeById } from "@/server/repositories/promocodes";

export default async function AdminEditPromocodePage(
  props: PageProps<"/admin/promocodes/[id]">,
) {
  const { id } = await props.params;
  const { created } = await props.searchParams;

  const promocode = getPromocodeById(id);
  if (!promocode) notFound();

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/promocodes" className="text-sm text-muted hover:text-accent">← Промокоды</Link>
          <h1 className="mt-2 font-mono text-2xl font-bold">{promocode.code}</h1>
        </div>
        <ConfirmForm
          action={deletePromocodeAction}
          fields={{ id: promocode.id }}
          title="Удалить промокод?"
          description={
            promocode.usedCount > 0
              ? `Код использован ${promocode.usedCount} раз. В заказах он останется записан, но применить его больше нельзя. Чтобы сохранить историю, лучше просто выключить.`
              : "Код ещё не использовался."
          }
        />
      </div>

      {created && <div className="mt-4"><FormMessage success="Промокод создан." /></div>}

      <div className="mt-6 max-w-3xl">
        <PromocodeForm promocode={promocode} />
      </div>
    </div>
  );
}
