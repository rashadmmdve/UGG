import { cn } from "@/lib/utils";

/**
 * Поле ввода в стилистике витрины: без рамки-коробки, только нижняя линия,
 * как в макетах. Ошибка выводится под полем и связывается с input через
 * aria-describedby.
 */
export function Field({
  label,
  error,
  hint,
  id,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
}) {
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="label-caps text-muted">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={cn(
          "h-11 w-full border-b bg-transparent text-[0.9375rem] text-fg outline-none transition-colors placeholder:text-line-strong focus:border-fg",
          error ? "border-danger" : "border-line",
        )}
        {...props}
      />
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function CheckboxField({
  label,
  id,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex w-fit items-center gap-2 text-sm text-muted select-none",
        className,
      )}
    >
      <input
        id={id}
        type="checkbox"
        className="h-4 w-4 accent-fg"
        {...props}
      />
      {label}
    </label>
  );
}

export function TextareaField({
  label,
  error,
  id,
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="label-caps text-muted">
        {label}
      </label>
      <textarea
        id={id}
        rows={3}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(
          "w-full resize-y border-b bg-transparent py-2 text-[0.9375rem] text-fg outline-none transition-colors placeholder:text-line-strong focus:border-fg",
          error ? "border-danger" : "border-line",
        )}
        {...props}
      />
      {error && (
        <p id={`${id}-error`} className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
