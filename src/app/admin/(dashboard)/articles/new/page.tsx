import Link from "next/link";

import { ArticleForm } from "@/components/admin/ArticleForm";

export default function AdminNewArticlePage() {
  return (
    <div>
      <Link href="/admin/articles" className="text-sm text-muted hover:text-accent">← Статьи</Link>
      <h1 className="mt-2 text-2xl font-bold">Новая статья</h1>
      <div className="mt-6 max-w-4xl">
        <ArticleForm article={null} />
      </div>
    </div>
  );
}
