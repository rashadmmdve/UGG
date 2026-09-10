# Развёртывание на сервере

Сайт живёт на одном облачном сервере в России: Next.js за Caddy, база
SQLite в файле, фотографии на диске. Всё в `deploy/`.

## Что нужно от хостинга

- Ubuntu 24.04, 2 vCPU, 4 ГБ памяти, 40 ГБ NVMe, площадка в России.
- SSH-ключ добавлен при создании сервера.
- A-записи `uggrussia.shop` и `www.uggrussia.shop` указывают на IP сервера.
  Без этого Caddy не получит сертификат — он будет пробовать раз в минуту
  и заработает сам, как только запись обновится.

## Первый запуск

С рабочей машины, где лежит ключ:

```bash
ssh root@IP 'bash -s' < deploy/setup.sh
```

Дальше на сервере:

```bash
ssh root@IP
sudo -iu ugg
cd /srv/ugg/app
cp .env.example .env.local
nano .env.local
```

В `.env.local` обязательно:

| Переменная | Значение |
|---|---|
| `AUTH_SECRET` | `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `NEXT_PUBLIC_SITE_URL` | `https://uggrussia.shop` — без слэша; в продакшене без неё сборка падает |
| `CDEK_API_URL` | `https://api.cdek.ru` — боевой, не тестовый |
| `CDEK_ACCOUNT`, `CDEK_PASSWORD` | из договора со СДЭК |
| `SMTP_*`, `MAIL_FROM` | как в локальном `.env.local` |
| `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY` | когда будут; пусто — оплата картой выключена |

Потом:

```bash
npm ci && npm run build
exit
systemctl start ugg
systemctl status ugg --no-pager
```

## Перенос данных с рабочей машины

База и фотографии не в git. Один раз — с рабочей машины:

```bash
scp data/shop.db root@IP:/srv/ugg/app/data/
scp -r public/uploads root@IP:/srv/ugg/app/public/
ssh root@IP 'chown -R ugg:ugg /srv/ugg/app/data /srv/ugg/app/public/uploads && systemctl restart ugg'
```

Тестовые заказы из локальной базы на сервере не нужны — их удаляют
после переноса.

Если база новая: `npm run seed`, `npm run seed:legal`, `npm run create-admin`.

## Обновление

После каждого push в GitHub:

```bash
ssh root@IP 'sudo -iu ugg /srv/ugg/app/deploy/deploy.sh'
```

Тянет код, собирает, перезапускает. Пара секунд простоя.

## Резервные копии

Каждую ночь в 03:30 — `/srv/ugg/backups/`: база через `sqlite3 .backup`
(простое копирование файла в режиме WAL даёт битую копию) и архив
фотографий. Хранятся две недели. Копии лежат на том же диске — при
потере сервера пропадут вместе с ним, поэтому раз в неделю стоит
забирать свежую на рабочую машину:

```bash
scp root@IP:/srv/ugg/backups/shop-$(date +%F).db ./
```

## Логи

```bash
journalctl -u ugg -f          # приложение
journalctl -u caddy -f        # прокси и сертификаты
```
