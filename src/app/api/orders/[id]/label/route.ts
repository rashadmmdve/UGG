import { NextResponse } from "next/server";

import { getCurrentAdmin, getCurrentCustomer } from "@/server/auth/session";
import { cdekFetchBinary } from "@/server/cdek/client";
import { getShipmentLabel } from "@/server/orders/shipment";
import { getOrderById } from "@/server/repositories/orders";

/**
 * PDF с этикеткой заказа.
 *
 * Ссылку на файл СДЭК отдаёт только по Bearer-токену, которого у браузера
 * нет — поэтому клиент никогда не видит адрес СДЭК напрямую, а всегда идёт
 * сюда: обработчик проверяет права на заказ, забирает файл сам и пересылает
 * его байты как есть.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const order = getOrderById(id);

  if (!order) {
    return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });
  }

  const [customer, admin] = await Promise.all([
    getCurrentCustomer(),
    getCurrentAdmin(),
  ]);

  const isOwner = customer && order.userId === customer.id;
  if (!isOwner && !admin) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const label = await getShipmentLabel(id);
  if (!label.ok) {
    // Причина важнее вежливости: «попробуйте через минуту» на заказе,
    // который СДЭК ещё не зарегистрировал, отправляло бы по кругу.
    const message = {
      "no-shipment": "Заказ ещё не передан в СДЭК — этикетки пока нет.",
      invalid:
        "СДЭК не выдаёт этикетку: заказ у них ещё в статусе «Принят», а не «Создан». " +
        "На боевом контуре статус меняется за несколько минут; на тестовом (api.edu.cdek.ru) — никогда.",
      pending: "Этикетка ещё формируется. Попробуйте через минуту.",
    }[label.reason];
    return NextResponse.json({ error: message }, { status: label.reason === "pending" ? 404 : 409 });
  }

  const pdf = await cdekFetchBinary(label.url);
  const download = new URL(request.url).searchParams.get("download") === "1";

  return new NextResponse(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${order.number}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
