import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { getArticleBySlug, getPublishedArticles } from "@/server/repositories/articles";
import { articleCrumbs } from "@/server/seo/breadcrumbs";
import { breadcrumbLd, faqLd } from "@/server/seo/jsonld";

export const revalidate = 3600;

export function generateStaticParams() {
  return getPublishedArticles().map((article) => ({ slug: article.slug }));
}

export async function generateMetadata(props: PageProps<"/articles/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const article = getArticleBySlug(slug);
  if (!article?.isPublished) return {};

  const title = article.seo.metaTitle || article.title;
  const description = article.seo.metaDescription || article.excerpt;

  return {
    title: { absolute: `${title} | ${SITE_NAME}` },
    description,
    alternates: { canonical: `/articles/${article.slug}` },
    openGraph: {
      type: "article",
      title,
      description,
      url: `${SITE_URL}/articles/${article.slug}`,
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      images: article.cover ? [article.cover] : undefined,
    },
    robots: article.seo.noindex ? { index: false, follow: true } : { index: true, follow: true },
  };
}

export default async function ArticlePage(props: PageProps<"/articles/[slug]">) {
  const { slug } = await props.params;
  const article = getArticleBySlug(slug);
  if (!article?.isPublished) notFound();

  const crumbs = articleCrumbs(article.title);
  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.excerpt,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    inLanguage: "ru-RU",
    mainEntityOfPage: `${SITE_URL}/articles/${article.slug}`,
    ...(article.cover ? { image: `${SITE_URL}${article.cover}` } : {}),
    publisher: { "@id": `${SITE_URL}/#organization` },
  };

  return (
    <div className="container-page py-8">
      <JsonLd data={[breadcrumbLd(crumbs), articleLd, ...(article.faq.length ? [faqLd(article.faq)] : [])]} />
      <Breadcrumbs items={crumbs} />

      <article className="mt-4 max-w-3xl">
        <p className="text-xs text-muted">{formatDate(article.publishedAt)}</p>
        <h1 className="heading-section mt-2">{article.title}</h1>
        {article.excerpt && <p className="mt-3 text-lg text-muted">{article.excerpt}</p>}

        {article.cover && (
          <div className="relative mt-6 aspect-[16/9] overflow-hidden rounded-lg bg-elevated">
            <Image src={article.cover} alt="" fill sizes="(min-width: 1024px) 768px, 100vw" className="object-cover" loading="eager" />
          </div>
        )}

        <div className="prose-seo mt-8 text-[0.9375rem] leading-relaxed" dangerouslySetInnerHTML={{ __html: article.body }} />

        {article.faq.length > 0 && (
          <section className="mt-12">
            <h2 className="text-xl font-bold">Вопросы и ответы</h2>
            <div className="mt-4 divide-y divide-line border-y border-line">
              {article.faq.map((item) => (
                <details key={item.question} className="py-3">
                  <summary className="cursor-pointer font-medium">{item.question}</summary>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{item.answer}</p>
                </details>
              ))}
            </div>
          </section>
        )}
      </article>
    </div>
  );
}
