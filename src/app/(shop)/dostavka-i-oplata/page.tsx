import type { Metadata } from "next";
import Link from "next/link";

import { InfoPage } from "@/components/shop/InfoPage";
import { getLogistics } from "@/server/repositories/settings";
import { pageCrumbs } from "@/server/seo/breadcrumbs";
import { faqLd } from "@/server/seo/jsonld";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Доставка и оплата",
  description:
    "Доставка обуви UGG® по России через СДЭК: пункты выдачи и курьер до двери. " +
    "Стоимость и срок считаются при оформлении по вашему адресу.",
  alternates: { canonical: "/dostavka-i-oplata" },
};

const FAQ = [
  {
    question: "Сколько стоит доставка?",
    answer:
      "Стоимость считается автоматически при оформлении заказа по тарифам СДЭК для вашего города и выбранного способа. Доставка в пункт выдачи обычно дешевле курьерской.",
  },
  {
    question: "Можно ли примерить перед покупкой?",
    answer:
      "В части пунктов выдачи СДЭК есть примерочные — такие пункты отмечены при выборе. Если размер не подошёл, обувь можно обменять или вернуть в течение 14 дней.",
  },
  {
    question: "Как оплатить заказ?",
    answer:
      "После оформления с вами свяжется менеджер и согласует удобный способ оплаты. Онлайн-оплата картой на сайте подключается.",
  },
];

export default function DeliveryPage() {
  const logistics = getLogistics();

  return (
    <InfoPage
      crumbs={pageCrumbs("Доставка и оплата")}
      title="Доставка и оплата"
      lead={`Отправляем заказы из города ${logistics.fromCity} транспортной компанией СДЭК по всей России.`}
      extraLd={[faqLd(FAQ)]}
    >
      <h2>Способы доставки</h2>
      <ul>
        <li>
          <strong>Пункт выдачи СДЭК.</strong> Заберёте заказ сами в удобном пункте —
          обычно это дешевле и быстрее. При оформлении покажем пункты вашего города,
          у части из них есть примерочная.
        </li>
        <li>
          <strong>Курьером до двери.</strong> Привезём по указанному адресу, курьер
          позвонит заранее.
        </li>
      </ul>

      <h2>Стоимость и сроки</h2>
      <p>
        Стоимость и срок доставки считаются при оформлении заказа — по тарифам СДЭК
        для вашего города, веса и габаритов посылки. Вы увидите точную сумму до
        подтверждения заказа, никаких доплат при получении.
      </p>
      <p>
        После передачи посылки в СДЭК в личном кабинете появится трек-номер: по нему
        видно, где сейчас заказ, а статус обновляется сам.
      </p>

      <h2>Оплата</h2>
      <p>
        После оформления с вами свяжется менеджер и согласует способ оплаты. Оплата
        картой на сайте подключается — как только она заработает, платить можно будет
        сразу при оформлении.
      </p>

      <h2>Часто спрашивают</h2>
      {FAQ.map((item) => (
        <details key={item.question} className="border-t border-line py-3">
          <summary className="cursor-pointer font-medium">{item.question}</summary>
          <p className="mt-2 text-muted">{item.answer}</p>
        </details>
      ))}

      <p className="mt-8">
        Не подошёл размер? Читайте про{" "}
        <Link href="/obmen-i-vozvrat">обмен и возврат</Link>.
      </p>
    </InfoPage>
  );
}
