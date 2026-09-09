import Link from "next/link";

import { formatPrice } from "@/lib/utils";
import { getPromocodes } from "@/server/repositories/promocodes";

function describe(type: "percent" | "fixed", value: number): string {
  return type === "percent" ? `${value}%` : formatPrice(value);
}

export default function AdminPromocodesPage() {
  const promocodes = getPromocodes();
  const now = new Date();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">
          Промокоды <span className="text-base font-normal text-muted">{promocodes.length}</span>
        </h1>
        <Link
          href="/admin/promocodes/new"
          className="inline-flex h-9 items-center rounded bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover"
        >
          + Новый промокод
        </Link>
      </div>

      {promocodes.length === 0 ? (
        <p className="mt-8 text-sm text-muted">Промокодов пока нет.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-line bg-bg">
          <table className="w-full text-sm">
            <thead className="bg-elevated text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-2 font-normal">Код</th>
                <th className="px-4 py-2 font-normal">Скидка</th>
                <th className="px-4 py-2 font-normal">От суммы</th>
                <th className="px-4 py-2 font-normal">До</th>
                <th className="px-4 py-2 font-normal text-right">Использован</th>
                <th className="px-4 py-2 font-normal">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {promocodes.map((promo) => {
                const expired = promo.expiresAt ? new Date(promo.expiresAt) < now : false;
                const exhausted = promo.usageLimit !== null && promo.usedCount >= promo.usageLimit;
                const live = promo.isActive && !expired && !exhausted;

                return (
                  <tr key={promo.id} className="hover:bg-sand">
                    <td className="px-4 py-2">
                      <Link href={`/admin/promocodes/${promo.id}`} className="font-mono font-medium hover:text-accent">
                        {promo.code}
                      </Link>
                    </td>
                    <td className="px-4 py-2">{describe(promo.type, promo.value)}</td>
                    <td className="px-4 py-2 text-muted">
                      {promo.minOrderTotal > 0 ? formatPrice(promo.minOrderTotal) : "—"}
                    </td>
                    <td className="px-4 py-2 text-muted">
                      {promo.expiresAt ? promo.expiresAt.slice(0, 10) : "бессрочно"}
                    </td>
                    <td className="px-4 py-2 text-right text-muted">
                      {promo.usedCount}{promo.usageLimit !== null && ` / ${promo.usageLimit}`}
                    </td>
                    <td className="px-4 py-2">
                      {live ? (
                        <span className="rounded bg-success/10 px-2 py-0.5 text-xs text-success">Действует</span>
                      ) : (
                        <span className="rounded bg-elevated px-2 py-0.5 text-xs text-muted">
                          {!promo.isActive ? "Выключен" : expired ? "Истёк" : "Исчерпан"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
