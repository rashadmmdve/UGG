"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  checkRateLimit,
  registerFailedAttempt,
  resetAttempts,
} from "@/server/auth/rateLimit";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { createSession, destroySession, getCurrentUser } from "@/server/auth/session";
import { issuePasswordReset, lookupResetToken } from "@/server/auth/passwordReset";
import { isVerificationRequired, issueVerification } from "@/server/auth/verification";
import { isMailEnabled } from "@/server/mail/mailer";
import {
  createUser,
  getUserByEmail,
  getUserById,
  resetPassword,
  updatePasswordHash,
  updateUser,
} from "@/server/repositories/users";
import { fieldErrorsFrom, type ActionState } from "@/server/validation/errors";
import {
  changePasswordSchema,
  emailSchema,
  loginSchema,
  profileSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/server/validation/schemas";

/**
 * Вход, регистрация и правка профиля.
 *
 * Серверные действия доступны прямым POST-запросом в обход интерфейса,
 * поэтому проверки здесь — не дублирование клиентской валидации, а
 * единственный реальный барьер.
 */

export type FormState = ActionState;

/**
 * Ключ для счётчика попыток входа.
 *
 * Адрес плюс почта: по одному адресу мог сидеть офис, а перебор идёт
 * обычно по конкретному аккаунту.
 */
async function rateLimitKey(email: string): Promise<string> {
  const store = await headers();
  const ip =
    store.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    store.get("x-real-ip") ??
    "unknown";
  return `${ip}:${email}`;
}

/**
 * Вход на сайт. Один для всех: владелец входит здесь же, а панель
 * управления открывается ему потому, что в базе у него роль
 * администратора, — отдельной страницы входа в панель нет.
 */
export async function loginAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const key = await rateLimitKey(parsed.data.email);
  const limit = checkRateLimit(key);

  if (!limit.allowed) {
    return {
      error: `Слишком много попыток входа. Повторите через ${limit.retryAfterMinutes} мин.`,
    };
  }

  const user = getUserByEmail(parsed.data.email);

  /**
   * Проверка пароля выполняется даже тогда, когда пользователя нет.
   * Иначе разное время ответа выдавало бы, какие адреса зарегистрированы.
   */
  const valid = user
    ? await verifyPassword(user.passwordHash, parsed.data.password)
    : await verifyPassword("$argon2id$v=19$m=19456,t=2,p=1$aaaa$aaaa", "dummy");

  // Формулировка одна на оба случая: неизвестная почта и неверный пароль
  // выглядят одинаково.
  if (!user || !valid) {
    registerFailedAttempt(key);
    return { error: "Неверная почта или пароль" };
  }

  resetAttempts(key);

  // Без подтверждённой почты входа нет: ссылка из письма — единственный
  // способ доказать, что адрес его.
  if (!user.emailVerifiedAt && isVerificationRequired()) {
    return {
      error: "Почта ещё не подтверждена — откройте ссылку из письма.",
      action: {
        href: `/account/verify?email=${encodeURIComponent(user.email)}`,
        label: "Отправить письмо ещё раз",
      },
    };
  }

  const remember = formData.get("remember") === "on";
  await createSession(user.id, remember);

  redirect("/account");
}

/** Выход. Панель управления закрывается вместе с сессией сайта. */
export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/");
}

export async function registerAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  if (getUserByEmail(parsed.data.email)) {
    return { fieldErrors: { email: "Такая почта уже зарегистрирована" } };
  }

  // Без настроенного SMTP письмо не уйдёт — тогда аккаунт активируется
  // сразу, иначе регистрация была бы заперта.
  const verify = isVerificationRequired();

  const user = createUser({
    email: parsed.data.email,
    passwordHash: await hashPassword(parsed.data.password),
    name: parsed.data.name,
    phone: parsed.data.phone,
    role: "customer",
    emailVerified: !verify,
  });

  if (!verify) {
    await createSession(user.id, true);
    redirect("/account");
  }

  try {
    await issueVerification(user);
  } catch (error) {
    console.error(`Не удалось отправить письмо подтверждения на ${user.email}:`, error);
    return {
      error: "Аккаунт создан, но письмо отправить не удалось. Попробуйте запросить его ещё раз.",
      action: {
        href: `/account/verify?email=${encodeURIComponent(user.email)}`,
        label: "Отправить письмо",
      },
    };
  }

  redirect(`/account/verify?email=${encodeURIComponent(user.email)}`);
}

/**
 * Письмо подтверждения ещё раз.
 *
 * Ответ одинаковый для любой почты: по нему нельзя узнать, есть ли такой
 * аккаунт. Счётчик попыток — тот же, что у входа: без него через форму
 * можно было бы заваливать чужой ящик письмами.
 */
export async function resendVerificationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { fieldErrors: { email: "Укажите почту" } };
  }

  const key = await rateLimitKey(`resend:${parsed.data}`);
  const limit = checkRateLimit(key);
  if (!limit.allowed) {
    return { error: `Слишком много запросов. Повторите через ${limit.retryAfterMinutes} мин.` };
  }
  registerFailedAttempt(key);

  const user = getUserByEmail(parsed.data);
  if (user && !user.emailVerifiedAt && isVerificationRequired()) {
    try {
      await issueVerification(user);
    } catch (error) {
      console.error(`Не удалось отправить письмо подтверждения на ${user.email}:`, error);
      return { error: "Не удалось отправить письмо. Попробуйте через минуту." };
    }
  }

  return { success: "Если такая почта зарегистрирована и ещё не подтверждена, письмо уже в пути." };
}

/**
 * «Забыли пароль?» — письмо со ссылкой на смену пароля.
 *
 * Незнакомой почте отвечаем прямо, что её нет в базе: так решил
 * владелец — понятный ответ вместо обтекаемого. Плата за это в том,
 * что через форму можно проверить, зарегистрирован ли адрес; перебор
 * сдерживает общий с входом счётчик попыток.
 */
export async function requestPasswordResetAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { fieldErrors: { email: "Укажите почту" } };
  }
  if (!isMailEnabled()) {
    return { error: "Восстановление по почте временно недоступно — напишите нам на info@uggrussia.shop." };
  }

  const key = await rateLimitKey(`reset:${parsed.data}`);
  const limit = checkRateLimit(key);
  if (!limit.allowed) {
    return { error: `Слишком много запросов. Повторите через ${limit.retryAfterMinutes} мин.` };
  }
  registerFailedAttempt(key);

  const user = getUserByEmail(parsed.data);
  if (!user) {
    return {
      error: `Извините, но почта ${parsed.data} не зарегистрирована на сайте.`,
      action: { href: "/account/register", label: "Зарегистрироваться" },
    };
  }

  try {
    await issuePasswordReset(user);
  } catch (error) {
    console.error(`Не удалось отправить письмо восстановления на ${user.email}:`, error);
    return { error: "Не удалось отправить письмо. Попробуйте через минуту." };
  }

  return { success: "Письмо со ссылкой уже в пути. Ссылка действует час." };
}

/** Новый пароль по ссылке из письма. После смены — сразу вход. */
export async function resetPasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const lookup = lookupResetToken(parsed.data.token);
  if (!lookup.ok) {
    return {
      error: lookup.reason === "expired" ? "Ссылка устарела." : "Ссылка не подошла.",
      action: { href: "/account/forgot", label: "Запросить новую" },
    };
  }

  resetPassword(lookup.user.id, await hashPassword(parsed.data.password));
  await createSession(lookup.user.id, true);
  redirect("/account");
}

export async function updateProfileAction(
  userId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
  });

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  updateUser(userId, parsed.data);
  return {};
}

/**
 * Смена пароля из кабинета.
 *
 * Кто меняет — берётся из сессии, а не из формы: чужой пароль этим
 * путём не сменить. Текущий пароль спрашивается обязательно — иначе
 * любой, кто сел за открытый браузер, отрезал бы владельца от аккаунта.
 * Сессия после смены не сбрасывается: человек и так здесь.
 */
export async function changePasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await getCurrentUser();
  if (!me) return { error: "Сессия истекла — войдите заново." };

  const parsed = changePasswordSchema.safeParse({
    current: formData.get("current"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const key = await rateLimitKey(`change:${me.email}`);
  const limit = checkRateLimit(key);
  if (!limit.allowed) {
    return { error: `Слишком много попыток. Повторите через ${limit.retryAfterMinutes} мин.` };
  }

  const user = getUserById(me.id);
  if (!user || !(await verifyPassword(user.passwordHash, parsed.data.current))) {
    registerFailedAttempt(key);
    return { fieldErrors: { current: "Текущий пароль не подошёл" } };
  }

  resetAttempts(key);
  updatePasswordHash(user.id, await hashPassword(parsed.data.password));
  return { success: "Пароль изменён." };
}
