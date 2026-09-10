import { NextResponse } from "next/server";

import { pricingToCsv } from "@/server/admin/pricing-csv";
import { getCurrentAdmin } from "@/server/auth/session";
import { getPricingRows } from "@/server/repositories/pricing";

/**
 * Выгрузка цен в CSV — для правки в Excel и обратной загрузки.
 * Столбцы ID и Артикул в файле нужны, чтобы при загрузке найти товар;
 * их менять не надо.
 */
export async function GET() {
  if (!(await getCurrentAdmin())) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(pricingToCsv(getPricingRows()), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ceny-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
