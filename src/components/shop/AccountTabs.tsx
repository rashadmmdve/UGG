"use client";

import { useState } from "react";
import { Package, ShoppingBag, User } from "lucide-react";

import { OrderCard } from "@/components/shop/OrderCard";
import { ProfileForm } from "@/components/shop/ProfileForm";
import { cn, formatDate, formatPrice } from "@/lib/utils";
import type { Order, PublicUser } from "@/lib/types";

type Tab = "orders" | "purchases" | "profile";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "orders", label: "Заказы", icon: Package },
  { id: "purchases", label: "Покупки", icon: ShoppingBag },
  { id: "profile", label: "Профиль", icon: User },
];

/**
 * Личный кабинет. Заказ переезжает в «Покупки» сам, как только СДЭК
 * сообщит, что покупатель забрал посылку.
 */
export function AccountTabs({ user, orders }: { user: PublicUser; orders: Order[] }) {
  const [tab, setTab] = useState<Tab>("orders");
  const purchases = orders.filter((order) => order.status === "completed");
  const active = orders.filter((order) => order.status !== "completed");
  const counts: Record<Tab, number | null> = { orders: active.length, purchases: purchases.length, profile: null };

  return (
    <div className="mt-8 grid gap-8 md:grid-cols-12">
      <nav className="md:col-span-3">
        <ul className="flex gap-2 overflow-x-auto md:flex-col md:gap-1">
          {TABS.map((item) => {
            const Icon = item.icon;
            const isActive = tab === item.id;
            return (
              <li key={item.id} className="shrink-0">
                <button type="button" onClick={() => setTab(item.id)} aria-current={isActive ? "page" : undefined}
                  className={cn("flex w-full items-center gap-3 rounded-md px-4 py-2.5 text-left text-sm transition-colors",
                    isActive ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-elevated hover:text-fg")}>
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={1.6} />
                  {item.label}
                  {counts[item.id] !== null && counts[item.id]! > 0 && (
                    <span className="ml-auto text-xs tabular-nums">{counts[item.id]}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="md:col-span-9">
        {tab === "orders" && (
          <Section title="Заказы" empty={active.length === 0} emptyTitle="Заказов пока нет" emptyText="Как только оформите первый — он появится здесь.">
            <div className="flex flex-col gap-4">{active.map((order) => <OrderCard key={order.id} order={order} />)}</div>
          </Section>
        )}
        {tab === "purchases" && (
          <Section title="Покупки" empty={purchases.length === 0} emptyTitle="Покупок пока нет" emptyText="Заказ попадёт сюда, когда вы его получите.">
            <div className="flex flex-col gap-4">{purchases.map((order) => <PurchaseCard key={order.id} order={order} />)}</div>
          </Section>
        )}
        {tab === "profile" && (
          <Section title="Профиль" empty={false}><ProfileForm user={user} /></Section>
        )}
      </div>
    </div>
  );
}

function Section({ title, empty, emptyTitle, emptyText, children }: {
  title: string; empty: boolean; emptyTitle?: string; emptyText?: string; children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      {empty ? (
        <div className="rounded-lg border border-dashed border-line p-10 text-center">
          <p className="font-semibold">{emptyTitle}</p>
          <p className="mt-1 text-sm text-muted">{emptyText}</p>
        </div>
      ) : children}
    </section>
  );
}

function PurchaseCard({ order }: { order: Order }) {
  return (
    <article className="rounded-lg border border-line p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="font-mono text-lg font-semibold">{order.number}</p>
          <p className="mt-0.5 text-xs text-muted">Получен · {formatDate(order.updatedAt)}</p>
        </div>
        <p className="font-semibold tabular-nums">{formatPrice(order.total)}</p>
      </div>
      <ul className="mt-3 divide-y divide-line border-y border-line">
        {order.items.map((item) => (
          <li key={`${item.productId}-${item.variantId}`} className="flex justify-between gap-4 py-2 text-sm">
            <span>{item.title}<span className="text-muted"> · {item.sizeEu}</span>{item.quantity > 1 && <span className="text-muted"> × {item.quantity}</span>}</span>
            <span className="shrink-0 tabular-nums">{formatPrice(item.price * item.quantity)}</span>
          </li>
        ))}
      </ul>
      <dl className="mt-3 flex flex-col gap-1 text-sm">
        <div className="flex justify-between"><dt className="text-muted">Товары</dt><dd className="tabular-nums">{formatPrice(order.subtotal)}</dd></div>
        {order.discount > 0 && <div className="flex justify-between"><dt className="text-muted">Скидка{order.promocode && ` (${order.promocode})`}</dt><dd className="tabular-nums">−{formatPrice(order.discount)}</dd></div>}
        <div className="flex justify-between"><dt className="text-muted">Доставка</dt><dd className="tabular-nums">{formatPrice(order.deliveryPrice)}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-muted">Получено в {order.delivery.city}</dt><dd className="text-right text-muted">{order.delivery.address}</dd></div>
      </dl>
    </article>
  );
}
