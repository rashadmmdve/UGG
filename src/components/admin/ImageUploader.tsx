"use client";

import Image from "next/image";
import { useRef, useState } from "react";

/**
 * Фотографии товара: список с порядком и массовая загрузка.
 *
 * Порядок важен — первое фото уходит в карточку каталога, в Open Graph
 * и в разметку, поэтому есть перемещение влево-вправо. Загрузка идёт
 * пачкой через /api/admin/upload: сервер сам сжимает и переводит в WebP.
 */

type UploadResponse = {
  results?: Array<
    | { name: string; ok: true; url: string }
    | { name: string; ok: false; error: string }
  >;
  error?: string;
};

export function ImageUploader({
  value,
  onChange,
}: {
  value: string[];
  onChange: (urls: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;

    setBusy(true);
    setErrors([]);

    const body = new FormData();
    for (const file of Array.from(files)) body.append("files", file);

    try {
      const response = await fetch("/api/admin/upload", { method: "POST", body });
      const data = (await response.json()) as UploadResponse;

      if (!response.ok || !data.results) {
        setErrors([data.error ?? "Не удалось загрузить файлы"]);
        return;
      }

      const uploaded = data.results
        .filter((item): item is { name: string; ok: true; url: string } => item.ok)
        .map((item) => item.url);
      const failed = data.results
        .filter((item): item is { name: string; ok: false; error: string } => !item.ok)
        .map((item) => `${item.name}: ${item.error}`);

      if (uploaded.length) onChange([...value, ...uploaded]);
      if (failed.length) setErrors(failed);
    } catch {
      setErrors(["Сеть недоступна, попробуйте ещё раз"]);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {value.map((url, index) => (
          <figure
            key={url}
            className="group relative h-28 w-28 overflow-hidden rounded border border-line bg-elevated"
          >
            <Image src={url} alt="" fill sizes="112px" className="object-cover" />
            {index === 0 && (
              <figcaption className="absolute top-1 left-1 rounded bg-accent px-1.5 py-0.5 text-[10px] font-medium text-white">
                Главное
              </figcaption>
            )}
            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-fg/70 px-1 py-0.5 text-xs text-white opacity-0 transition group-hover:opacity-100">
              <button type="button" onClick={() => move(index, -1)} title="Левее" aria-label="Переместить левее">
                ←
              </button>
              <button type="button" onClick={() => remove(index)} title="Удалить" aria-label="Удалить фото">
                ✕
              </button>
              <button type="button" onClick={() => move(index, 1)} title="Правее" aria-label="Переместить правее">
                →
              </button>
            </div>
          </figure>
        ))}

        <label
          className={`flex h-28 w-28 cursor-pointer flex-col items-center justify-center rounded border border-dashed text-center text-xs transition ${
            busy ? "border-line text-muted" : "border-line-strong text-muted hover:border-accent hover:text-accent"
          }`}
        >
          <span className="text-2xl leading-none">+</span>
          <span className="mt-1">{busy ? "Загрузка…" : "Добавить"}</span>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            multiple
            className="sr-only"
            disabled={busy}
            onChange={(event) => upload(event.target.files)}
          />
        </label>
      </div>

      <p className="mt-2 text-xs text-muted">
        До 12 файлов за раз, каждый до 12 МБ. Фото сжимаются автоматически.
      </p>

      {errors.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs text-danger">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
