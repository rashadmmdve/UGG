import type { Metadata } from "next";

import { InfoPage } from "@/components/shop/InfoPage";
import { getSizeCharts } from "@/server/repositories/catalog";
import { pageCrumbs } from "@/server/seo/breadcrumbs";
import { faqLd } from "@/server/seo/jsonld";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Размерная сетка UGG: как выбрать размер",
  description:
    "Таблица размеров UGG для женщин, мужчин и детей: соответствие EU, US, UK и длина стельки в сантиметрах. " +
    "Как измерить стопу и подобрать размер, чтобы угги сели как надо.",
  alternates: { canonical: "/razmery-ugg" },
};

const FAQ = [
  {
    question: "UGG большемерят или маломерят?",
    answer:
      "Классические модели на овчине садятся плотно и разнашиваются примерно на треть размера: овчина внутри приминается под стопу. Поэтому берите свой размер по длине стельки, а не на размер больше — иначе через месяц угги станут велики.",
  },
  {
    question: "Как измерить стопу?",
    answer:
      "Встаньте на лист бумаги, обведите стопу карандашом и измерьте расстояние от пятки до кончика самого длинного пальца. Мерьте вечером — к вечеру стопа немного увеличивается. Сравните с длиной стельки в таблице и выберите ближайшее значение.",
  },
  {
    question: "Что делать, если размер между двумя?",
    answer:
      "Для классических моделей на овчине берите меньший: они разносятся. Для кроссовок Lowmel и моделей на платформе с тонкой стелькой — больший.",
  },
];

const GENDER_TITLES: Record<string, string> = {
  women: "Женские",
  men: "Мужские",
  kids: "Детские",
  unisex: "Унисекс",
};

export default function SizesPage() {
  const charts = getSizeCharts().filter((chart) => chart.rows.length > 0);

  return (
    <InfoPage
      crumbs={pageCrumbs("Размерная сетка")}
      title="Размерная сетка UGG"
      lead="Главный ориентир — длина стельки в сантиметрах, а не привычный европейский номер."
      extraLd={[faqLd(FAQ)]}
    >
      <h2>Как подобрать размер</h2>
      <ol>
        <li>Измерьте длину стопы: от пятки до кончика самого длинного пальца, стоя, вечером.</li>
        <li>Найдите в таблице ближайшую длину стельки — это и есть ваш размер.</li>
        <li>
          Классические угги на овчине садятся плотно и разнашиваются на треть размера.
          Не берите «с запасом»: через месяц они станут велики.
        </li>
      </ol>

      {charts.map((chart) => (
        <section key={chart.id} className="mt-8">
          <h2>{GENDER_TITLES[chart.gender] ?? chart.title}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="pb-2 pr-4 font-normal">EU</th>
                  <th className="pb-2 pr-4 font-normal">US</th>
                  <th className="pb-2 pr-4 font-normal">UK</th>
                  <th className="pb-2 font-normal">Длина стельки, см</th>
                </tr>
              </thead>
              <tbody>
                {chart.rows.map((row) => (
                  <tr key={row.sizeEu} className="border-t border-line">
                    <td className="py-1.5 pr-4 font-medium">{row.sizeEu}</td>
                    <td className="py-1.5 pr-4">{row.sizeUs ?? "—"}</td>
                    <td className="py-1.5 pr-4">{row.sizeUk ?? "—"}</td>
                    <td className="py-1.5">{row.insoleCm}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <h2 className="mt-10">Частые вопросы</h2>
      {FAQ.map((item) => (
        <details key={item.question} className="border-t border-line py-3">
          <summary className="cursor-pointer font-medium">{item.question}</summary>
          <p className="mt-2 text-muted">{item.answer}</p>
        </details>
      ))}
    </InfoPage>
  );
}
