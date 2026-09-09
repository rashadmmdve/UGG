import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbLd } from "@/server/seo/jsonld";
import type { Crumb } from "@/server/seo/breadcrumbs";

/**
 * Каркас информационной страницы: крошки с разметкой, заголовок, узкая
 * колонка текста. Общий для доставки, возврата, гарантии и прочих.
 */
export function InfoPage({
  crumbs,
  title,
  lead,
  children,
  extraLd,
}: {
  crumbs: Crumb[];
  title: string;
  lead?: string;
  children: React.ReactNode;
  extraLd?: Record<string, unknown>[];
}) {
  return (
    <div className="container-page py-8">
      <JsonLd data={[breadcrumbLd(crumbs), ...(extraLd ?? [])]} />
      <Breadcrumbs items={crumbs} />
      <article className="mt-4 max-w-3xl">
        <h1 className="heading-section">{title}</h1>
        {lead && <p className="mt-3 text-lg text-muted">{lead}</p>}
        <div className="prose-seo mt-8 text-[0.9375rem] leading-relaxed">{children}</div>
      </article>
    </div>
  );
}
