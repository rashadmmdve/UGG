import { SeoSettingsForm } from "@/components/admin/SeoSettingsForm";
import { getSeoSettings } from "@/server/repositories/seo";

export default function AdminSeoTemplatesPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Шаблоны метатегов</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted">
        Заголовки и описания собираются по этим шаблонам для всех страниц,
        у которых не заполнены свои. Это позволяет не заполнять метатеги у
        сотен товаров вручную, но у любой страницы их можно переопределить.
      </p>
      <div className="mt-6 max-w-3xl">
        <SeoSettingsForm settings={getSeoSettings()} />
      </div>
    </div>
  );
}
