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

function Label({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block text-xs font-medium text-muted">
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

export function AField({ label, error, hint, id, className, type, ...props }: FieldProps) {
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";

  return (
    <div className={className}>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative mt-1">
        <input
          id={id}
          type={isPassword && revealed ? "text" : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(CONTROL, error ? "border-danger" : "border-line", isPassword && "pr-10")}
          {...props}
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
};

export function ATextarea({
  label,
  error,
  hint,
  id,
  className,
  rows = 4,
  ...props
}: TextareaProps) {
  return (
    <div className={className}>
      <Label htmlFor={id}>{label}</Label>
      <textarea
        id={id}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(
          CONTROL,
          "mt-1 resize-y",
          error ? "border-danger" : "border-line",
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
