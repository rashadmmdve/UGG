import { PricingImport } from "@/components/admin/PricingImport";
import { PricingTable } from "@/components/admin/PricingTable";
import { genderSections } from "@/server/catalog/sections";
import { getPricingRows } from "@/server/repositories/pricing";
import { SECTIONS } from "@/lib/constants";

/**
 * Блок «Цены»: весь каталог одной таблицей — цена, старая цена,
 * себестоимость, распродажа. Правка по одному и пачкой через CSV.
 *
 * Фильтры считаются на сервере из адреса: таблица большая, и держать
 * её целиком в браузере ради поиска незачем. «Сохранить» пишет только
 * строки, которые сейчас видны.
 */
export default async function AdminPricesPage(props: PageProps<"/admin/prices">) {
  const params = await props.searchParams;
  const query = typeof params.q === "string" ? params.q.trim().toLowerCase() : "";
  const section = typeof params.section === "string" ? params.section : "";
  const onlySale = params.sale === "1";

  const gender = SECTIONS.find((s) => s.slug === section)?.gender ?? null;
  const all = getPricingRows();
  const rows = all.filter((row) => {
    if (gender && row.gender !== gender) return false;
    if (onlySale && !row.isSale) return false;
    if (query) {
      return (
        row.title.toLowerCase().includes(query) ||
        (row.sku ?? "").toLowerCase().includes(query) ||
        row.slug.includes(query)
      );
    }
    return true;
  });

  const inSale = all.filter((row) => row.isSale).length;
  const inHits = all.filter((row) => row.isBestseller).length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">
          Цены <span className="text-base font-normal text-muted">{rows.length} из {all.length}</span>
        </h1>
        <a
          href="/api/admin/prices/export"
          className="inline-flex h-9 items-center rounded border border-line px-4 text-sm font-medium hover:border-accent"
        >
          Скачать CSV
        </a>
      </div>
      <p className="mt-2 max-w-3xl text-sm text-muted">
        «Цена» действует, пока не заполнена «Со скидкой»; если заполнена — продаём по
        ней, а обычная показывается перечёркнутой. Себестоимость на сайте не
        показывается. Галочки те же, что в карточке товара: в распродаже сейчас {inSale},
        в хитах на главной — {inHits}.
      </p>

      <section className="mt-6 rounded-lg border border-line bg-bg p-5">
        <h2 className="font-semibold">Загрузить из файла</h2>
        <p className="mt-1 text-xs text-muted">
          Скачайте CSV, поправьте цены в Excel и загрузите обратно. Товар ищется по
          столбцу ID, затем по артикулу. Пустая ячейка в «Цене со скидкой» или
          «Себестоимости» очищает значение; столбец, которого нет в файле, не трогается.
          Файл с ошибками не применяется целиком — сначала исправьте, что покажет.
        </p>
        <div className="mt-3">
          <PricingImport />
        </div>
      </section>

      <form className="mt-6 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Поиск
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Название, артикул, адрес"
            className="h-9 w-64 rounded border border-line bg-bg px-3 text-sm text-fg outline-none focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Раздел
          <select
            name="section"
            defaultValue={section}
            className="h-9 rounded border border-line bg-bg px-2 text-sm text-fg"
          >
            <option value="">Все</option>
            {genderSections().map((s) => (
              <option key={s.slug} value={s.slug}>{s.title}</option>
            ))}
          </select>
        </label>
        <label className="flex h-9 items-center gap-2 text-sm">
          <input type="checkbox" name="sale" value="1" defaultChecked={onlySale} className="h-4 w-4 accent-[var(--accent)]" />
          Только в распродаже
        </label>
        <button type="submit" className="h-9 rounded border border-line px-4 text-sm hover:border-accent">
          Показать
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="mt-8 text-sm text-muted">По этим условиям товаров нет.</p>
      ) : (
        <div className="mt-4">
          <PricingTable rows={rows} />
        </div>
      )}
    </div>
  );
}
