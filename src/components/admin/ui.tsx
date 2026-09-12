"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

import { cn } from "@/lib/utils";

/**
 * Элементы форм админки.
 *
 * Отличаются от витринных намеренно: там поля с одной нижней линией и
 * широкими отступами, здесь — плотные поля в рамках. В форме товара
 * два десятка полей, и подчёркивания в такой плотности перестают
 * читаться как отдельные элементы.
 */

const CONTROL =
  "w-full rounded border bg-bg px-3 py-2 text-sm text-fg outline-none transition-colors " +
  "placeholder:text-line-strong focus:border-accent disabled:bg-elevated disabled:text-muted";

function Label({ htmlFor, hidden, children }: { htmlFor?: string; hidden?: boolean; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className={hidden ? "sr-only" : "block text-xs font-medium text-muted"}>
      {children}
    </label>
  );
}

function Error({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1 text-xs text-danger">
      {message}
    </p>
  );
}

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
  /**
   * Подпись только для читалок, подсказка — внутри поля (placeholder).
   * Так выглядит оформление заказа: короткая форма, где подписи над
   * полями лишь удлиняют её.
   */
  labelHidden?: boolean;
  /** Классы самого поля — размер и отступы поверх стандартных. */
  inputClassName?: string;
};

/**
 * Глазок в поле пароля.
 *
 * Пароль набирают вслепую, и на телефоне опечатка в нём — обычное дело;
 * особенно там, где ошибиться дороже всего: при смене пароля по ссылке
 * из письма. Кнопка внутри поля, а не рядом: так она не сдвигает
 * разметку и не путается с кнопкой отправки.
 */
function RevealButton({ revealed, onToggle }: { revealed: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={revealed ? "Скрыть пароль" : "Показать пароль"}
      title={revealed ? "Скрыть пароль" : "Показать пароль"}
      className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted transition-colors hover:text-fg"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
        <circle cx="12" cy="12" r="2.8" />
        {revealed && <path d="m4 20 16-16" />}
      </svg>
    </button>
  );
}

/**
 * Телефон в виде «+7 900 000-00-00» по мере ввода.
 *
 * Российский номер узнаётся по первой цифре: 7 — как есть, 8 — старый
 * междугородний префикс, 9 — набрали без кода страны. Другие коды стран
 * не трогаем: оставляем «+» и цифры. Разделители добавляются только за
 * уже набранными цифрами, поэтому Backspace не упирается в них.
 */
export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const first = digits[0];
  if (first !== "7" && first !== "8" && first !== "9") return `+${digits.slice(0, 15)}`;

  const d = (first === "9" ? `7${digits}` : `7${digits.slice(1)}`).slice(0, 11);
  let out = "+7";
  if (d.length > 1) out += ` ${d.slice(1, 4)}`;
  if (d.length > 4) out += ` ${d.slice(4, 7)}`;
  if (d.length > 7) out += `-${d.slice(7, 9)}`;
  if (d.length > 9) out += `-${d.slice(9, 11)}`;
  return out;
}

export function AField({ label, error, hint, id, className, type, labelHidden, inputClassName, ...props }: FieldProps) {
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";
  const isTel = type === "tel";

  // Телефон — управляемое поле: значение форматируется на каждом
  // символе, а при фокусе в пустое поле подставляется «+7 ». Пустой
  // остаток «+7 » при уходе снимается, чтобы не уйти на сервер как номер.
  const { defaultValue: telDefault, ...rest } = props;
  const [tel, setTel] = useState(() => (isTel ? formatPhone(String(telDefault ?? "")) : ""));
  const telProps = isTel
    ? {
        value: tel,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => setTel(formatPhone(event.target.value)),
        onFocus: () => {
          if (tel === "") setTel("+7 ");
        },
        onBlur: () => {
          if (tel.replace(/\D/g, "") === "7") setTel("");
        },
        inputMode: "tel" as const,
      }
    : { defaultValue: telDefault };

  return (
    <div className={className}>
      <Label htmlFor={id} hidden={labelHidden}>{label}</Label>
      <div className={cn("relative", !labelHidden && "mt-1")}>
        <input
          id={id}
          type={isPassword && revealed ? "text" : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(CONTROL, error ? "border-danger" : "border-line", isPassword && "pr-10", inputClassName)}
          {...rest}
          {...telProps}
        />
        {isPassword && (
          <RevealButton revealed={revealed} onToggle={() => setRevealed((v) => !v)} />
        )}
      </div>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      <Error id={`${id}-error`} message={error} />
    </div>
  );
}

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string;
  hint?: string;
  labelHidden?: boolean;
  inputClassName?: string;
};

export function ATextarea({
  label,
  error,
  hint,
  id,
  className,
  rows = 4,
  labelHidden,
  inputClassName,
  ...props
}: TextareaProps) {
  return (
    <div className={className}>
      <Label htmlFor={id} hidden={labelHidden}>{label}</Label>
      <textarea
        id={id}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(
          CONTROL,
          "resize-y",
          !labelHidden && "mt-1",
          error ? "border-danger" : "border-line",
          inputClassName,
        )}
        {...props}
      />
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      <Error id={`${id}-error`} message={error} />
    </div>
  );
}

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
  hint?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
};

export function ASelect({
  label,
  error,
  hint,
  options,
  placeholder,
  id,
  className,
  ...props
}: SelectProps) {
  return (
    <div className={className}>
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        className={cn(CONTROL, "mt-1", error ? "border-danger" : "border-line")}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      <Error id={`${id}-error`} message={error} />
    </div>
  );
}

export function ACheckbox({
  label,
  id,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label
      htmlFor={id}
      className={cn("flex w-fit items-center gap-2 text-sm select-none", className)}
    >
      <input
        id={id}
        type="checkbox"
        className="h-4 w-4 accent-[var(--accent)]"
        {...props}
      />
      {label}
    </label>
  );
}

/**
 * Кнопка отправки формы.
 *
 * Состояние берётся из useFormStatus, а не из локального useState: при
 * серверных действиях форма может быть отправлена и без нажатия на
 * кнопку, а блокировать её нужно в любом случае — иначе двойной клик
 * создаст две записи.
 */
export function SubmitButton({
  children,
  className,
  variant = "primary",
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "primary" | "danger" | "outline";
}) {
  const { pending } = useFormStatus();

  const styles = {
    primary: "bg-accent text-white hover:bg-accent-hover",
    danger: "bg-danger text-white hover:opacity-90",
    outline: "border border-line text-fg hover:border-accent",
  }[variant];

  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "inline-flex h-9 items-center justify-center rounded px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        styles,
        className,
      )}
    >
      {pending ? "Сохраняем…" : children}
    </button>
  );
}

/** Сообщение об успехе или ошибке над формой. */
export function FormMessage({
  error,
  success,
}: {
  error?: string;
  success?: string;
}) {
  if (!error && !success) return null;

  return (
    <p
      role="status"
      className={cn(
        "rounded border px-3 py-2 text-sm",
        error
          ? "border-danger/30 bg-danger/5 text-danger"
          : "border-success/30 bg-success/5 text-success",
      )}
    >
      {error ?? success}
    </p>
  );
}
