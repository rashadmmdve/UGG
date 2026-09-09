"use client";

import { useActionState, useEffect, useState, useTransition } from "react";

import { AField, FormMessage, SubmitButton } from "@/components/admin/ui";
import { saveLogisticsAction } from "@/server/admin/actions/settings";
import {
  getReceptionPointsAction,
  searchCitiesAction,
} from "@/server/cdek/actions";
import type { ActionState } from "@/server/validation/errors";
import type { CdekCity, CdekDeliveryPoint, LogisticsSettings } from "@/lib/types";

/**
 * Откуда отправляются посылки.
 *
 * Город берётся из справочника СДЭК (нужен его код, а не название), а пункт
 * приёма — из списка тех ПВЗ, что принимают отправления: не каждый пункт
 * выдачи это делает.
 */
export function LogisticsForm({ settings }: { settings: LogisticsSettings }) {
  const [state, action] = useActionState<ActionState, FormData>(saveLogisticsAction, {});
  const errors = state.fieldErrors ?? {};

  const [city, setCity] = useState({ code: settings.fromCityCode, name: settings.fromCity });
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<CdekCity[]>([]);
  const [points, setPoints] = useState<CdekDeliveryPoint[]>([]);
  const [point, setPoint] = useState({
    code: settings.shipmentPointCode,
    address: settings.shipmentPointAddress,
  });
  const [loading, startLoading] = useTransition();

  // Подсказки городов — с задержкой, чтобы не дёргать СДЭК на каждую букву.
  // Очистка списка при коротком запросе делается в обработчике ввода,
  // а не здесь: эффект только планирует запрос.
  useEffect(() => {
    if (query.trim().length < 2) return;
    const timer = setTimeout(() => {
      startLoading(async () => setSuggestions(await searchCitiesAction(query)));
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  function onQueryChange(value: string) {
    setQuery(value);
    if (value.trim().length < 2) setSuggestions([]);
  }

  // Пункты приёма подгружаются при смене города.
  useEffect(() => {
    if (!city.code) return;
    startLoading(async () => setPoints(await getReceptionPointsAction(city.code)));
  }, [city.code]);

  return (
    <form action={action} className="space-y-6" noValidate>
      <input type="hidden" name="fromCityCode" value={city.code} />
      <input type="hidden" name="fromCity" value={city.name} />
      <input type="hidden" name="shipmentPointCode" value={point.code} />
      <input type="hidden" name="shipmentPointAddress" value={point.address} />

      <FormMessage error={state.error} success={state.success} />

      <section className="rounded-lg border border-line bg-bg p-5">
        <h2 className="font-semibold">Город отправления</h2>
        <p className="mt-1 text-sm">
          Сейчас: <span className="font-medium">{city.name}</span>{" "}
          <span className="text-xs text-muted">(код СДЭК {city.code})</span>
        </p>
        {errors.fromCityCode && <p className="mt-1 text-xs text-danger">{errors.fromCityCode}</p>}

        <div className="relative mt-3 max-w-md">
          <AField
            id="citySearch"
            label="Сменить город"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Начните вводить название"
            autoComplete="off"
          />
          {suggestions.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full rounded border border-line bg-bg shadow-sm">
              {suggestions.map((item) => (
                <li key={item.code}>
                  <button
                    type="button"
                    onClick={() => {
                      setCity({ code: item.code, name: item.city });
                      setPoint({ code: "", address: "" });
                      setQuery("");
                      setSuggestions([]);
                    }}
                    className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-sand"
                  >
                    <span>{item.city}</span>
                    <span className="text-xs text-muted">{item.region}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-line bg-bg p-5">
        <h2 className="font-semibold">Пункт приёма посылок</h2>
        <p className="mt-1 text-xs text-muted">
          Куда вы сами привозите заказы. От него зависит тариф «склад-склад» и «склад-дверь».
        </p>
        {errors.shipmentPointCode && <p className="mt-1 text-xs text-danger">{errors.shipmentPointCode}</p>}

        {loading && points.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Загружаем пункты…</p>
        ) : points.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            В этом городе нет пунктов, принимающих отправления, либо СДЭК недоступен.
          </p>
        ) : (
          <ul className="mt-3 max-h-80 divide-y divide-line overflow-y-auto rounded border border-line">
            {points.map((item) => {
              const selected = item.code === point.code;
              return (
                <li key={item.code}>
                  <button
                    type="button"
                    onClick={() => setPoint({ code: item.code, address: item.address })}
                    className={`flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-sand ${selected ? "bg-accent-soft" : ""}`}
                  >
                    <span className="font-medium">{item.address}</span>
                    <span className="text-xs text-muted">
                      {item.code} · {item.workTime}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {point.code && (
          <p className="mt-3 text-sm">
            Выбран: <span className="font-medium">{point.address}</span>{" "}
            <span className="text-xs text-muted">({point.code})</span>
          </p>
        )}
      </section>

      <div className="flex justify-end">
        <SubmitButton>Сохранить</SubmitButton>
      </div>
    </form>
  );
}
