import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { formatDate } from "@/lib/utils";
import { getPublishedArticles } from "@/server/repositories/articles";
import { pageCrumbs } from "@/server/seo/breadcrumbs";
import { breadcrumbLd } from "@/server/seo/jsonld";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Статьи об UGG: выбор размера и уход",
  description:
    "Как выбрать размер, ухаживать за замшей и овчиной, с чем носить — статьи об обуви UGG®.",
  alternates: { canonical: "/articles" },
};

export default function ArticlesPage() {
  const articles = getPublishedArticles();
  const crumbs = pageCrumbs("Статьи");

  return (
    <div className="container-page py-8">
      <JsonLd data={breadcrumbLd(crumbs)} />
      <Breadcrumbs items={crumbs} />
      <h1 className="heading-section mt-4">Статьи</h1>

      {articles.length === 0 ? (
        <p className="mt-8 text-muted">Первые статьи скоро появятся.</p>
      ) : (
        <ul className="mt-8 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <li key={article.id}>
              <Link href={`/articles/${article.slug}`} className="group block">
                <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-elevated">
                  {article.cover && (
                    <Image src={article.cover} alt="" fill sizes="(min-width: 1024px) 33vw, 100vw" className="object-cover transition-transform group-hover:scale-[1.02]" />
                  )}
                </div>
                <p className="mt-3 text-xs text-muted">{formatDate(article.publishedAt)}</p>
                <h2 className="mt-1 text-lg font-semibold leading-snug group-hover:text-accent">{article.title}</h2>
                {article.excerpt && <p className="mt-1 line-clamp-3 text-sm text-muted">{article.excerpt}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
