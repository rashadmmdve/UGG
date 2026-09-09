import { ContentForm } from "@/components/admin/ContentForm";
import { getContent } from "@/server/repositories/settings";

export default function AdminContentPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Тексты сайта</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted">
        Главная, контакты, страница о магазине и частые вопросы.
      </p>
      <div className="mt-6 max-w-4xl">
        <ContentForm content={getContent()} />
      </div>
    </div>
  );
}
