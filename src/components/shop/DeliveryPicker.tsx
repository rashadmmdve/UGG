"use client";

import { useEffect, useState } from "react";
import { Loader2, MapPin, Truck } from "lucide-react";

import { AField } from "@/components/admin/ui";
import { isSelfDelivery } from "@/lib/delivery";
import { cn } from "@/lib/utils";
import {
  getDeliveryPointsAction,
  searchCitiesAction,
  type CartLine,
} from "@/server/cdek/actions";
import type { CdekCity, CdekDeliveryPoint, DeliveryMode } from "@/lib/types";

const SEARCH_DEBOUNCE_MS = 400;

/** С какой длины запроса показывать пункты выдачи. */
const MIN_POINT_SEARCH = 2;

/**
 * Выбор способа доставки: пункт выдачи СДЭК или курьер до двери.
 *
 * Компонент управляемый — состояние выбора живёт в форме заказа, ей оно
 * нужно и для расчёта суммы, и для отправки. Здесь только подсказки
 * городов и список пунктов.
 */
export function DeliveryPicker({
  items,
  mode,
  onModeChange,
  city,
  onCityChange,
  point,
  onPointChange,
  address,
  onAddressChange,
  fieldErrors,
}: {
  items: CartLine[];
  mode: DeliveryMode;
  onModeChange: (mode: DeliveryMode) => void;
  city: CdekCity | null;
  onCityChange: (city: CdekCity | null) => void;
  point: CdekDeliveryPoint | null;
  onPointChange: (point: CdekDeliveryPoint | null) => void;
  address: string;
  onAddressChange: (address: string) => void;
  fieldErrors: Record<string, string>;
}) {
  const [cityQuery, setCityQuery] = useState(city?.city ?? "");
  const [suggestions, setSuggestions] = useState<CdekCity[]>([]);
  const [searching, setSearching] = useState(false);
  const [points, setPoints] = useState<CdekDeliveryPoint[]>([]);
  const [loadingPoints, setLoadingPoints] = useState(false);
  const [pointQuery, setPointQuery] = useState("");

  // Подсказки городов — всё состояние меняется внутри таймера, не в теле эффекта.
  useEffect(() => {
    const query = cityQuery.trim();
    let cancelled = false;
    const id = setTimeout(async () => {
      if (query.length < 2 || query === city?.city) {
        setSuggestions([]);
        return;
      }
      setSearching(true);
      const found = await searchCitiesAction(query);
      if (cancelled) return;
      setSuggestions(found);
      setSearching(false);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [cityQuery, city]);

  // Пункты выдачи в выбранном городе. Вес считается на сервере — офисы с
  // меньшим ограничением по весу в список не попадут.
  const itemsKey = JSON.stringify(items);
  useEffect(() => {
    let cancelled = false;
    const id = setTimeout(async () => {
      if (mode !== "pvz" || !city) {
        setPoints([]);
        return;
      }
      setLoadingPoints(true);
      const found = await getDeliveryPointsAction(city.code, JSON.parse(itemsKey) as CartLine[]);
      if (cancelled) return;
      setPoints(found);
      setLoadingPoints(false);
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [mode, city, itemsKey]);

  function selectCity(next: CdekCity) {
    onCityChange(next);
    onPointChange(null);
    setCityQuery(next.city);
    setSuggestions([]);
    setPointQuery("");
  }

  function selectPoint(next: CdekDeliveryPoint) {
    onPointChange(next);
    setPointQuery(next.address);
  }

  function editPoint(value: string) {
    setPointQuery(value);
    if (point) onPointChange(null);
  }

  // В большом городе полторы сотни пунктов: вываливать их все, едва
  // выбран город, — это стена адресов. Список открывается после пары
  // введённых букв и ищет строго по адресу, который виден в списке.
  const search = pointQuery.trim().toLowerCase();
  const matched = points.filter((item) => item.address.toLowerCase().includes(search));
  const showPoints = Boolean(city) && !point && search.length >= MIN_POINT_SEARCH;

  const pointHint = !city
    ? "Сначала выберите город"
    : point
      ? [point.workTime, point.hasDressingRoom && "есть примерочная"].filter(Boolean).join(" · ")
      : "Введите улицу или номер дома — покажем подходящие пункты";

  const dropdown = "absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-line bg-bg shadow-lg";

  // Свой город: способ выбирать не из чего — привезём по адресу и
  // бесплатно. Поэтому карточки способов появляются только там, где
  // работает СДЭК, и уже после города: сначала «куда», потом «как».
  const self = city ? isSelfDelivery({ cityCode: city.code }) : false;

  return (
    <div className="flex flex-col gap-5">
      <div className="relative">
        <AField
          id="co-city"
          label="Город"
          value={cityQuery}
          onChange={(event) => {
            setCityQuery(event.target.value);
            if (city) {
              onCityChange(null);
              onPointChange(null);
            }
          }}
          autoComplete="off"
          placeholder="Начните вводить название"
          hint={city ? undefined : "Выберите город из списка"}
          error={fieldErrors.cityCode || fieldErrors.city}
        />
        {searching && <Loader2 className="absolute top-8 right-3 h-4 w-4 animate-spin text-muted" />}
        {suggestions.length > 0 && (
          <ul className={dropdown}>
            {suggestions.map((item) => (
              <li key={item.code}>
                <button type="button" onClick={() => selectCity(item)}
                  className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-sand">
                  <span className="text-sm">{item.city}</span>
                  {item.region && <span className="text-xs text-muted">{item.region}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {city && !self && (
        <div className="grid gap-3 sm:grid-cols-2">
          <ModeCard active={mode === "pvz"} icon={<MapPin className="h-4 w-4" strokeWidth={1.6} />}
            title="Пункт выдачи СДЭК" hint="Заберёте сами, дешевле" onClick={() => onModeChange("pvz")} />
          <ModeCard active={mode === "courier"} icon={<Truck className="h-4 w-4" strokeWidth={1.6} />}
            title="Курьером до двери" hint="Привезут по адресу" onClick={() => onModeChange("courier")} />
        </div>
      )}

      {!city ? null : self ? (
        <AField
          id="co-address"
          label="Адрес доставки"
          value={address}
          onChange={(event) => onAddressChange(event.target.value)}
          autoComplete="street-address"
          placeholder="Улица, дом, квартира"
          hint="Доставим сами и бесплатно — курьер позвонит и согласует время"
          error={fieldErrors.address}
        />
      ) : mode === "pvz" ? (
        <div className="relative">
          <AField
            id="co-point"
            label="Пункт выдачи"
            value={pointQuery}
            onChange={(event) => editPoint(event.target.value)}
            onFocus={(event) => event.currentTarget.select()}
            autoComplete="off"
            disabled={!city}
            placeholder={city ? "Начните вводить адрес" : "Сначала выберите город"}
            hint={pointHint}
            error={fieldErrors.pointCode}
          />
          {showPoints && (
            <ul className={dropdown}>
              {loadingPoints ? (
                <li className="flex items-center gap-2 px-3 py-3 text-sm text-muted">
                  <Loader2 className="h-4 w-4 animate-spin" /> Загружаем пункты выдачи
                </li>
              ) : matched.length === 0 ? (
                <li className="px-3 py-3 text-sm text-muted">Ничего не нашлось — попробуйте другую улицу</li>
              ) : (
                matched.map((item) => (
                  <li key={item.code}>
                    <button type="button" onClick={() => selectPoint(item)}
                      className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-sand">
                      <span className="text-sm">{item.address}</span>
                      {item.workTime && <span className="text-xs text-muted">{item.workTime}</span>}
                      {item.hasDressingRoom && <span className="text-xs text-muted">Есть примерочная</span>}
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      ) : (
        <AField
          id="co-address"
          label="Адрес доставки"
          value={address}
          onChange={(event) => onAddressChange(event.target.value)}
          autoComplete="street-address"
          placeholder="Улица, дом, квартира"
          error={fieldErrors.address}
        />
      )}
    </div>
  );
}

function ModeCard({ active, icon, title, hint, onClick }: {
  active: boolean; icon: React.ReactNode; title: string; hint: string; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={cn("flex items-start gap-3 rounded-md border p-4 text-left transition-colors",
        active ? "border-accent bg-accent-soft/40" : "border-line hover:border-line-strong")}>
      <span className={cn("mt-0.5", active ? "text-accent" : "text-fg")}>{icon}</span>
      <span>
        <span className="block text-sm font-medium">{title}</span>
        <span className="mt-0.5 block text-xs text-muted">{hint}</span>
      </span>
    </button>
  );
}
