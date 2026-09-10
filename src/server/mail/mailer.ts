import "server-only";

import nodemailer, { type Transporter } from "nodemailer";

/**
 * Отправка писем через SMTP Яндекс 360.
 *
 * Пароль — не от ящика, а «пароль приложения», выданный в Яндекс ID:
 * его можно отозвать отдельно, не меняя пароль почты. Порт 465 — это
 * SMTPS, соединение шифруется с первого байта.
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

function transport(): Transporter {
  if (!globalForMail.__uggMailer) {
    const port = Number(process.env.SMTP_PORT ?? 465);
    globalForMail.__uggMailer = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
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
  await transport().sendMail({
    from: process.env.MAIL_FROM ?? process.env.SMTP_USER,
    to: mail.to,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  });
}
