import type { Metadata } from "next";

import { InfoPage } from "@/components/shop/InfoPage";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { getContent } from "@/server/repositories/settings";
import { pageCrumbs } from "@/server/seo/breadcrumbs";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Контакты",
  description: `Контакты магазина ${SITE_NAME}: телефон, почта, реквизиты.`,
  alternates: { canonical: "/kontakty" },
};

export default function ContactsPage() {
  const contacts = getContent().contacts;
  const filled = contacts.phone || contacts.email || contacts.address;

  // Organization с адресом — для карточки организации в Яндексе.
  const organizationLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: SITE_URL,
    ...(contacts.phone ? { telephone: contacts.phone } : {}),
    ...(contacts.email ? { email: contacts.email } : {}),
    ...(contacts.address
      ? { address: { "@type": "PostalAddress", streetAddress: contacts.address, addressCountry: "RU" } }
      : {}),
  };

  return (
    <InfoPage crumbs={pageCrumbs("Контакты")} title="Контакты" extraLd={[organizationLd]}>
      {filled ? (
        <dl className="grid gap-4 sm:grid-cols-2">
          {contacts.phone && (
            <div>
              <dt className="text-xs text-muted">Телефон</dt>
              <dd className="text-lg"><a href={`tel:${contacts.phone.replace(/[^\d+]/g, "")}`}>{contacts.phone}</a></dd>
            </div>
          )}
          {contacts.email && (
            <div>
              <dt className="text-xs text-muted">Почта</dt>
              <dd className="text-lg"><a href={`mailto:${contacts.email}`}>{contacts.email}</a></dd>
            </div>
          )}
          {contacts.address && (
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted">Адрес</dt>
              <dd>{contacts.address}</dd>
            </div>
          )}
        </dl>
      ) : (
        <p className="text-muted">Контакты заполняются в панели управления, раздел «Тексты сайта».</p>
      )}

      {(contacts.legalName || contacts.inn) && (
        <>
          <h2>Реквизиты</h2>
          <dl className="grid gap-2 sm:grid-cols-2">
            {contacts.legalName && <div><dt className="text-xs text-muted">Продавец</dt><dd>{contacts.legalName}</dd></div>}
            {contacts.inn && <div><dt className="text-xs text-muted">ИНН</dt><dd>{contacts.inn}</dd></div>}
            {contacts.ogrn && <div><dt className="text-xs text-muted">ОГРН / ОГРНИП</dt><dd>{contacts.ogrn}</dd></div>}
          </dl>
        </>
      )}

      <h2>Как с нами связаться</h2>
      <p>
        По вопросам заказа, обмена и возврата пишите на почту или звоните — так
        быстрее всего. Номер заказа ускорит ответ.
      </p>
    </InfoPage>
  );
}
