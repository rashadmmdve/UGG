import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { getCurrentCustomer } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "Заказ оформлен",
  robots: { index: false, follow: false },
};

export default async function CheckoutSuccessPage(props: PageProps<"/checkout/success">) {
  const { order } = await props.searchParams;
  const number = typeof order === "string" ? order : null;
  const user = await getCurrentCustomer();

  return (
    <div className="container-page flex flex-col items-center py-20 text-center">
      <CheckCircle2 className="h-12 w-12 text-success" strokeWidth={1.4} />
      <h1 className="heading-section mt-4">Спасибо за заказ!</h1>
      {number && (
        <p className="mt-2 text-muted">
          Номер вашего заказа — <span className="font-mono font-semibold text-fg">{number}</span>
        </p>
      )}
      <p className="mt-4 max-w-md text-sm text-muted">
        Мы отправили подтверждение на почту. Менеджер свяжется с вами, чтобы
        согласовать оплату и передать заказ в доставку.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {user ? (
          <Link href="/account" className="inline-flex h-11 items-center rounded-md bg-accent px-6 text-sm font-semibold text-white hover:bg-accent-hover">
            Мои заказы
          </Link>
        ) : (
          <Link href="/account/register" className="inline-flex h-11 items-center rounded-md bg-accent px-6 text-sm font-semibold text-white hover:bg-accent-hover">
            Создать аккаунт, чтобы следить за доставкой
          </Link>
        )}
        <Link href="/catalog" className="inline-flex h-11 items-center rounded-md border border-line px-6 text-sm font-medium hover:border-accent">
          В каталог
        </Link>
      </div>
    </div>
  );
}
