/**
 * Наладка Телеграм-ботов. Их три — по одному на группу.
 *
 *   node scripts/telegram-setup.mjs chats    — показать группы, в которых
 *     боты уже состоят: их id нужно вписать в .env.local
 *   node scripts/telegram-setup.mjs webhook  — подписать ботов на нажатия
 *     кнопок; адрес и секрет берутся из окружения
 *   node scripts/telegram-setup.mjs check    — что сейчас настроено
 *
 * Идентификаторы групп руками искать не нужно: добавьте бота в группу и
 * запустите «chats» — само добавление Телеграм показывает как событие.
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

const ROLES = [
  { role: "orders", title: "заказы", token: "TELEGRAM_BOT_ORDERS", chat: "TELEGRAM_CHAT_ORDERS" },
  { role: "delivery", title: "доставка", token: "TELEGRAM_BOT_DELIVERY", chat: "TELEGRAM_CHAT_DELIVERY" },
  { role: "payments", title: "оплата", token: "TELEGRAM_BOT_PAYMENTS", chat: "TELEGRAM_CHAT_PAYMENTS" },
];

const configured = ROLES.filter((item) => process.env[item.token]);
if (configured.length === 0) {
  console.error("Нет ни одного токена — впишите TELEGRAM_BOT_ORDERS и остальные в .env.local");
  process.exit(1);
}

async function api(token, method, body) {
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
  for (const item of configured) {
    const token = process.env[item.token];
    const me = await api(token, "getMe");
    const updates = await api(token, "getUpdates", { limit: 100 });
    const chats = new Map();
    for (const update of updates) {
      const chat =
        update.message?.chat ??
        update.my_chat_member?.chat ??
        update.callback_query?.message?.chat;
      if (chat && chat.type !== "private") chats.set(String(chat.id), chat.title ?? chat.type);
    }

    console.log("");
    console.log(`${item.title} — @${me.username}`);
    if (chats.size === 0) {
      console.log("  групп не видно: добавьте бота в группу и запустите снова");
    } else {
      for (const [id, title] of chats) console.log(`  ${title} → ${item.chat}=${id}`);
    }
  }
} else if (command === "webhook") {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!site || !secret) {
    console.error("Нужны NEXT_PUBLIC_SITE_URL и TELEGRAM_WEBHOOK_SECRET");
    process.exit(1);
  }
  for (const item of configured) {
    const url = `${site.replace(/\/$/, "")}/api/telegram/webhook/${item.role}`;
    await api(process.env[item.token], "setWebhook", {
      url,
      secret_token: secret,
      allowed_updates: ["callback_query"],
      drop_pending_updates: true,
    });
    console.log(`${item.title}: ${url}`);
  }
} else if (command === "unhook") {
  for (const item of configured) {
    await api(process.env[item.token], "deleteWebhook", { drop_pending_updates: false });
    console.log(`${item.title}: подписка снята`);
  }
} else {
  for (const item of configured) {
    const token = process.env[item.token];
    const me = await api(token, "getMe");
    const hook = await api(token, "getWebhookInfo");
    console.log("");
    console.log(`${item.title} — @${me.username}`);
    console.log(`  группа: ${process.env[item.chat] || "не задана"}`);
    console.log(`  подписка: ${hook.url || "нет"}`);
    if (hook.last_error_message) {
      console.log(`  ошибка: ${hook.last_error_message} (${new Date(hook.last_error_date * 1000).toLocaleString("ru-RU")})`);
    }
  }
}
