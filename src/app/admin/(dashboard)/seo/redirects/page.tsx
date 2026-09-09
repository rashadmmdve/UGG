import { ConfirmForm } from "@/components/admin/ConfirmForm";
import { RedirectForm } from "@/components/admin/RedirectForm";
import { deleteRedirectAction } from "@/server/admin/actions/seo";
import { getCategories } from "@/server/repositories/catalog";
import { getRedirects } from "@/server/repositories/seo";

export default function AdminRedirectsPage() {
  const redirects = getRedirects();
  const aliasCount = getCategories().reduce((sum, c) => sum + c.aliases.length, 0);

  return (
    <div>
      <h1 className="text-2xl font-bold">
        Редиректы <span className="text-base font-normal text-muted">{redirects.length}</span>
      </h1>
      <p className="mt-2 max-w-3xl text-sm text-muted">
        Ручные редиректы для переезда со старых адресов и снятых с продажи
        товаров. Синонимы категорий ({aliasCount}) сюда не входят — они
        задаются в самой категории и работают автоматически.
      </p>

      <div className="mt-6 max-w-4xl rounded-lg border border-line bg-bg p-5">
        <RedirectForm />
      </div>

      {redirects.length > 0 && (
        <div className="mt-6 max-w-4xl overflow-x-auto rounded-lg border border-line bg-bg">
          <table className="w-full text-sm">
            <thead className="bg-elevated text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-2 font-normal">Откуда</th>
                <th className="px-4 py-2 font-normal">Куда</th>
                <th className="px-4 py-2 font-normal">Код</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {redirects.map((redirect) => (
                <tr key={redirect.id} className="hover:bg-sand">
                  <td className="px-4 py-2 font-mono text-xs">{redirect.from}</td>
                  <td className="px-4 py-2 font-mono text-xs">{redirect.to || "—"}</td>
                  <td className="px-4 py-2 text-muted">{redirect.code}</td>
                  <td className="px-4 py-2 text-right">
                    <ConfirmForm
                      action={deleteRedirectAction}
                      fields={{ id: redirect.id }}
                      title="Удалить редирект?"
                      description={`${redirect.from} снова начнёт отдавать 404.`}
                      className="text-xs text-muted hover:text-danger"
                    />
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
