/**
 * Вывод разметки schema.org.
 *
 * Обычный тег script, а не next/script: это не исполняемый код, а данные,
 * и они должны попасть в исходный HTML — робот JavaScript выполнять не обязан.
 *
 * Символ `<` заменяется на юникодную запись: без этого строка вида
 * `</script>` внутри названия товара или текста отзыва закрыла бы тег
 * раньше времени и превратилась бы в исполняемую разметку на странице.
 */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
