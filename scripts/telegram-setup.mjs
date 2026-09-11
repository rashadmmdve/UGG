/**
 * Наладка Телеграм-бота.
 *
 *   node scripts/telegram-setup.mjs chats    — показать группы, в которых
 *     бот уже состоит: их id нужно вписать в .env.local
 *   node scripts/telegram-setup.mjs webhook  — подписать бота на нажатия
 *     кнопок; адрес и секрет берутся из окружения
 *   node scripts/telegram-setup.mjs check    — что сейчас настроено
 *
 * Идентификаторы групп руками искать не нужно: добавьте бота в группу,
 * напишите там что-нибудь и запустите «chats». Телеграм отдаёт последние
 * сообщения, из них и берутся id.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

// .env.local читается вручную: скрипт запускается без Next.js.
for (const file of [".env.local", ".env"]) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) continue;
  for (const line of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^"(.*)"$/, "$1");
    }
  }
}

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("Нет TELEGRAM_BOT_TOKEN — впишите токен от @BotFather в .env.local");
  process.exit(1);
}

async function api(method, body) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const data = await response.json();
  if (!data.ok) throw new Error(`${method}: ${data.description ?? response.status}`);
  return data.result;
}

const command = process.argv[2] ?? "check";

if (command === "chats") {
  const updates = await api("getUpdates", { limit: 100 });
  const chats = new Map();
  for (const update of updates) {
    const chat = update.message?.chat ?? update.callback_query?.message?.chat;
    if (chat) chats.set(String(chat.id), chat.title ?? chat.username ?? chat.type);
  }

  if (chats.size === 0) {
    console.log(
      "Телеграм не показал ни одной группы.\n" +
        "Добавьте бота в группу, напишите там любое сообщение и запустите снова.\n" +
        "Если подписка на обновления уже включена, сначала: node scripts/telegram-setup.mjs unhook",
    );
  } else {
    console.log("Группы, которые видит бот:\n");
    for (const [id, title] of chats) console.log(`  ${title}\n  ${id}\n`);
    console.log("Впишите нужные id в .env.local:\n  TELEGRAM_CHAT_ORDERS=\n  TELEGRAM_CHAT_DELIVERY=\n  TELEGRAM_CHAT_PAYMENTS=");
  }
} else if (command === "webhook") {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!site || !secret) {
    console.error("Нужны NEXT_PUBLIC_SITE_URL и TELEGRAM_WEBHOOK_SECRET");
    process.exit(1);
  }
  const url = `${site.replace(/\/$/, "")}/api/telegram/webhook`;
  await api("setWebhook", {
    url,
    secret_token: secret,
    allowed_updates: ["callback_query"],
    drop_pending_updates: true,
  });
  console.log(`Подписка включена: ${url}`);
} else if (command === "unhook") {
  await api("deleteWebhook", { drop_pending_updates: false });
  console.log("Подписка снята — теперь работает getUpdates и команда chats");
} else {
  const me = await api("getMe");
  const hook = await api("getWebhookInfo");
  console.log(`Бот: @${me.username} (${me.first_name})`);
  console.log(`Подписка: ${hook.url || "нет"}`);
  if (hook.last_error_message) {
    console.log(`Последняя ошибка: ${hook.last_error_message} (${new Date(hook.last_error_date * 1000).toLocaleString("ru-RU")})`);
  }
  for (const [name, role] of [
    ["TELEGRAM_CHAT_ORDERS", "заказы"],
    ["TELEGRAM_CHAT_DELIVERY", "доставка"],
    ["TELEGRAM_CHAT_PAYMENTS", "оплата"],
  ]) {
    console.log(`${role}: ${process.env[name] || "не задана"}`);
  }
}
