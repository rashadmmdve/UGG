import Link from "next/link";

import { getArticles } from "@/server/repositories/articles";

export default function AdminArticlesPage() {
  const articles = getArticles();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">
          Статьи <span className="text-base font-normal text-muted">{articles.length}</span>
        </h1>
        <Link
          href="/admin/articles/new"
          className="inline-flex h-9 items-center rounded bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover"
        >
          + Новая статья
        </Link>
      </div>

      <p className="mt-2 max-w-3xl text-sm text-muted">
        Блог — главный источник трафика из регионов: информационные запросы
        вроде «как отличить оригинальные угги» ранжируются одинаково по всей
        стране, без привязки к городу.
      </p>

      {articles.length === 0 ? (
        <p className="mt-8 text-sm text-muted">Статей пока нет.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-line bg-bg">
          <table className="w-full text-sm">
            <thead className="bg-elevated text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-2 font-normal">Заголовок</th>
                <th className="px-4 py-2 font-normal">Дата</th>
                <th className="px-4 py-2 font-normal text-right">Знаков</th>
                <th className="px-4 py-2 font-normal text-right">FAQ</th>
                <th className="px-4 py-2 font-normal">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {articles.map((article) => (
                <tr key={article.id} className="hover:bg-sand">
                  <td className="px-4 py-2">
                    <Link href={`/admin/articles/${article.id}`} className="font-medium hover:text-accent">
                      {article.title}
                    </Link>
                    <span className="block text-xs text-muted">/articles/{article.slug}</span>
                  </td>
                  <td className="px-4 py-2 text-muted">{article.publishedAt.slice(0, 10)}</td>
                  <td className="px-4 py-2 text-right text-muted">
                    {article.body.replace(/<[^>]+>/g, "").length}
                  </td>
                  <td className="px-4 py-2 text-right text-muted">{article.faq.length}</td>
                  <td className="px-4 py-2">
                    {article.isPublished ? (
                      <span className="rounded bg-success/10 px-2 py-0.5 text-xs text-success">Опубликована</span>
                    ) : (
                      <span className="rounded bg-elevated px-2 py-0.5 text-xs text-muted">Черновик</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
