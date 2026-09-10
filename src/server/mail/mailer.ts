import "server-only";

import dns from "node:dns/promises";

import nodemailer, { type Transporter } from "nodemailer";

/**
 * Отправка писем через SMTP Яндекс 360.
 *
 * Пароль — не от ящика, а «пароль приложения», выданный в Яндекс ID:
 * его можно отозвать отдельно, не меняя пароль почты. Порт 465 — это
 * SMTPS, соединение шифруется с первого байта.
 *
 * Про IPv6. На нашем сервере исходящий SMTP закрыт по IPv4 и открыт по
 * IPv6, а nodemailer перебирает адреса по порядку — сначала IPv4. По
 * умолчанию он ждёт на мёртвом адресе две минуты, и форма «Забыли
 * пароль?» всё это время висит. Поэтому таймауты укорочены, а
 * SMTP_IP_FAMILY=6 позволяет вовсе не ходить в закрытую сторону:
 * имя резолвится в AAAA один раз на процесс, а проверка сертификата
 * остаётся по имени (tls.servername).
 *
 * Пока SMTP не настроен, почта на сайте выключена: регистрация проходит
 * без подтверждения, письма о заказах не уходят. Это осознанный запасной
 * режим для разработки, а не тихий сбой — isMailEnabled() проверяют
 * все, кто шлёт письма.
 */
export function isMailEnabled(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
}

const globalForMail = globalThis as unknown as { __uggMailer?: Transporter };

/**
 * Адрес для подключения. Обычно это само имя сервера; при
 * SMTP_IP_FAMILY=6 — его IPv6-адрес, чтобы не тратить время на закрытый
 * IPv4. Не разрешилось — идём по имени, письмо важнее оптимизации.
 */
async function connectHost(host: string): Promise<string> {
  if (process.env.SMTP_IP_FAMILY !== "6") return host;
  try {
    const [address] = await dns.resolve6(host);
    return address ?? host;
  } catch {
    return host;
  }
}

async function transport(): Promise<Transporter> {
  if (!globalForMail.__uggMailer) {
    const host = process.env.SMTP_HOST!;
    const port = Number(process.env.SMTP_PORT ?? 465);
    globalForMail.__uggMailer = nodemailer.createTransport({
      host: await connectHost(host),
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
      // Имя для проверки сертификата: подключаться можем по адресу.
      tls: { servername: host },
      // Из коробки — две минуты на подключение и десять на молчание.
      // Столько ждать посетителя у формы нельзя.
      connectionTimeout: 8_000,
      greetingTimeout: 8_000,
      socketTimeout: 30_000,
    });
  }
  return globalForMail.__uggMailer;
}

export type Mail = {
  to: string;
  subject: string;
  html: string;
  /** Текстовая версия — для почтовых программ без HTML и для спам-фильтров. */
  text: string;
};

/**
 * Отправить письмо. Ошибка не глотается: вызывающий решает, критична
 * она (подтверждение почты — да) или нет (уведомление о заказе — нет).
 */
export async function sendMail(mail: Mail): Promise<void> {
  if (!isMailEnabled()) {
    throw new Error("SMTP не настроен: задайте SMTP_HOST, SMTP_USER и SMTP_PASSWORD.");
  }
  const mailer = await transport();
  await mailer.sendMail({
    from: process.env.MAIL_FROM ?? process.env.SMTP_USER,
    to: mail.to,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  });
}
