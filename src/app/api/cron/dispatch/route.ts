import { NextResponse } from "next/server";

import { getDispatchSettings } from "@/server/repositories/settings";
import { dispatchToCouriers } from "@/server/telegram/dispatch";

/**
 * Утренняя рассылка списков курьерам.
 *
 * Дёргается таймером на сервере раз в день (см. deploy/ugg-dispatch.timer)
 * и защищена секретом из настроек: адрес открыт наружу, и без секрета
 * любой мог бы рассылать курьерам списки когда вздумается. Ту же
 * рассылку владелец может запустить руками из админки — через действие,
 * а не через этот адрес.
 */
export async function POST(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Не наш запрос" }, { status: 401 });
  }

  // Таймер тикает каждое утро, но рассылает только с включённой
  // галочкой: решение — за человеком, а не за расписанием.
  if (!getDispatchSettings().daily) {
    return NextResponse.json({ skipped: true, reason: "ежедневная рассылка выключена" });
  }

  const result = await dispatchToCouriers();
  console.log(
    `Рассылка курьерам: ${result.couriers} курьерам, ${result.orders} заказов, без курьера ${result.unassigned}`,
  );
  return NextResponse.json(result);
}
