import { LogisticsForm } from "@/components/admin/LogisticsForm";
import { getLogistics } from "@/server/repositories/settings";

export default function AdminLogisticsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Логистика</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted">
        Откуда отправляются заказы. По этим настройкам СДЭК считает стоимость
        доставки на витрине и регистрирует отправления.
      </p>
      <div className="mt-6 max-w-3xl">
        <LogisticsForm settings={getLogistics()} />
      </div>
    </div>
  );
}
