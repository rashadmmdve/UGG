/**
 * Наладка Телеграм-ботов. Их три — по одному на группу.
 *
 *   node scripts/telegram-setup.mjs chats    — показать группы, в которых
 *     боты уже состоят: их id нужно вписать в .env.local
 *   node scripts/telegram-setup.mjs webhook  — подписать ботов на нажатия
 *     кнопок; адрес и секрет берутся из окружения
 *   node scripts/telegram-setup.mjs pin      — закрепить в группе доставки
 *     сообщение с кнопкой «Меню»
 *   node scripts/telegram-setup.mjs keyboard — кнопка меню над полем ввода
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
      // Команды нужны только доставке — там меню; остальным хватает кнопок.
      allowed_updates: item.role === "delivery" ? ["callback_query", "message"] : ["callback_query"],
      drop_pending_updates: true,
    });
    // Кнопка «Меню» рядом с полем ввода — чтобы курьеру не печатать команду.
    await api(process.env[item.token], "setMyCommands", {
      commands: item.role === "delivery" ? [{ command: "menu", description: "Меню" }] : [],
    });
    console.log(`${item.title}: ${url}`);
  }
} else if (command === "pin") {
  // Кнопка меню в шапке группы: закреплённое сообщение с inline-кнопкой.
  // Нажатие не пишет ничего в чат и работает при включённой приватности.
  const item = configured.find((role) => role.role === "delivery");
  const chat = item && process.env[item.chat];
  if (!item || !chat) {
    console.error("Нужны TELEGRAM_BOT_DELIVERY и TELEGRAM_CHAT_DELIVERY");
    process.exit(1);
  }
  const sent = await api(process.env[item.token], "sendMessage", {
    chat_id: chat,
    text: "Меню курьера — заказы, вручение, запрос QR.",
    reply_markup: { inline_keyboard: [[{ text: "📋 Меню", callback_data: "open" }]] },
  });
  try {
    await api(process.env[item.token], "pinChatMessage", {
      chat_id: chat,
      message_id: sent.message_id,
      disable_notification: true,
    });
    console.log("Сообщение с кнопкой отправлено и закреплено");
  } catch (error) {
    console.log(`Сообщение отправлено, но закрепить не вышло: ${error.message}`);
    console.log("Сделайте бота администратором группы с правом закреплять сообщения и повторите.");
  }
} else if (command === "keyboard") {
  // Кнопка над полем ввода. Нажатие отправляет её подпись обычным
  // сообщением, а при включённой приватности бот слышит только то, что
  // начинается со слеша, — поэтому подпись выбирается по настройке бота.
  const item = configured.find((role) => role.role === "delivery");
  const chat = item && process.env[item.chat];
  if (!item || !chat) {
    console.error("Нужны TELEGRAM_BOT_DELIVERY и TELEGRAM_CHAT_DELIVERY");
    process.exit(1);
  }
  const me = await api(process.env[item.token], "getMe");
  const label = me.can_read_all_group_messages ? "📋 Меню" : "/menu";

  await api(process.env[item.token], "sendMessage", {
    chat_id: chat,
    text: "Кнопка меню закреплена над полем ввода.",
    reply_markup: {
      keyboard: [[{ text: label }]],
      resize_keyboard: true,
      is_persistent: true,
    },
  });

  console.log(`Кнопка добавлена, подпись: ${label}`);
  if (!me.can_read_all_group_messages) {
    console.log(
      "Чтобы подпись стала «📋 Меню» без слеша: @BotFather → /mybots → " +
        `@${me.username} → Bot Settings → Group Privacy → Turn off, ` +
        "затем удалить бота из группы и добавить заново, и повторить эту команду.",
    );
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
