"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  checkRateLimit,
  registerFailedAttempt,
  resetAttempts,
} from "@/server/auth/rateLimit";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { createSession, destroySession } from "@/server/auth/session";
import { issuePasswordReset, lookupResetToken } from "@/server/auth/passwordReset";
import { isVerificationRequired, issueVerification } from "@/server/auth/verification";
import { isMailEnabled } from "@/server/mail/mailer";
import {
  createUser,
  getUserByEmail,
  resetPassword,
  updateUser,
} from "@/server/repositories/users";
import { fieldErrorsFrom, type ActionState } from "@/server/validation/errors";
import {
  emailSchema,
  loginSchema,
  profileSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/server/validation/schemas";
import type { UserRole } from "@/lib/types";

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

export async function loginAction(
  role: UserRole,
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

  // Формулировка одна на все случаи: неизвестная почта, неверный пароль и
  // попытка войти в админку под обычной учётной записью выглядят одинаково.
  if (!user || !valid || user.role !== role) {
    registerFailedAttempt(key);
    return { error: "Неверная почта или пароль" };
  }

  resetAttempts(key);

  // Покупатель без подтверждённой почты не входит: ссылка из письма —
  // единственный способ доказать, что адрес его. Администраторов это
  // не касается — их заводят вручную.
  if (role === "customer" && !user.emailVerifiedAt && isVerificationRequired()) {
    return {
      error: "Почта ещё не подтверждена — откройте ссылку из письма.",
      action: {
        href: `/account/verify?email=${encodeURIComponent(user.email)}`,
        label: "Отправить письмо ещё раз",
      },
    };
  }

  const remember = formData.get("remember") === "on";
  await createSession(user.id, user.role, remember);

  redirect(role === "admin" ? "/admin" : "/account");
}

export async function loginAdminAction(
  prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return loginAction("admin", prev, formData);
}

export async function loginCustomerAction(
  prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return loginAction("customer", prev, formData);
}

export async function logoutAction(role: UserRole): Promise<void> {
  await destroySession(role);
  redirect(role === "admin" ? "/admin/login" : "/");
}

export async function logoutAdminAction(): Promise<void> {
  return logoutAction("admin");
}

export async function logoutCustomerAction(): Promise<void> {
  return logoutAction("customer");
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
    await createSession(user.id, "customer", true);
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
 * Ответ один для любой почты, чтобы по нему нельзя было проверить,
 * есть ли аккаунт. Счётчик попыток — общий с входом.
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
  if (user && user.role === "customer") {
    try {
      await issuePasswordReset(user);
    } catch (error) {
      console.error(`Не удалось отправить письмо восстановления на ${user.email}:`, error);
      return { error: "Не удалось отправить письмо. Попробуйте через минуту." };
    }
  }

  return {
    success: `Если ${parsed.data} зарегистрирована, письмо со ссылкой уже в пути. Ссылка действует час.`,
  };
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
  await createSession(lookup.user.id, "customer", true);
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
