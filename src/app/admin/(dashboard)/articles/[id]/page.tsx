import Link from "next/link";
import { notFound } from "next/navigation";

import { ArticleForm } from "@/components/admin/ArticleForm";
import { ConfirmForm } from "@/components/admin/ConfirmForm";
import { FormMessage } from "@/components/admin/ui";
import { deleteArticleAction } from "@/server/admin/actions/articles";
import { getArticles } from "@/server/repositories/articles";

export default async function AdminEditArticlePage(
  props: PageProps<"/admin/articles/[id]">,
) {
  const { id } = await props.params;
  const { created } = await props.searchParams;

  const article = getArticles().find((item) => item.id === id);
  if (!article) notFound();

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/articles" className="text-sm text-muted hover:text-accent">← Статьи</Link>
          <h1 className="mt-2 text-2xl font-bold">{article.title}</h1>
          {article.isPublished && (
            <Link href={`/articles/${article.slug}`} target="_blank"
              className="mt-1 inline-block text-sm text-accent hover:underline">
              Открыть на сайте ↗
            </Link>
          )}
        </div>
        <ConfirmForm
          action={deleteArticleAction}
          fields={{ id: article.id }}
          title="Удалить статью?"
          description="Адрес начнёт отдавать 404. Если статья уже в индексе — лучше снять с публикации и добавить редирект."
        />
      </div>

      {created && <div className="mt-4"><FormMessage success="Статья создана." /></div>}

      <div className="mt-6 max-w-4xl">
        <ArticleForm article={article} />
      </div>
    </div>
  );
}
