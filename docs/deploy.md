# Развёртывание на сервере

Сайт живёт на одном облачном сервере в России: Next.js за Caddy, база
SQLite в файле, фотографии на диске. Всё в `deploy/`.

## Раскладка на сервере

```
/srv/ugg/releases/<sha>   версии кода, каждая в своей папке
/srv/ugg/current          ссылка на рабочую версию — её читает служба
/srv/ugg/shared           база (data/), фото (uploads/), .env.local
/srv/ugg/backups          ночные копии
```

Версия собирается в своей папке, пока старая продолжает работать. Ссылка
`current` переключается только после успешной сборки, служба
перезапускается за секунду; если сайт после этого не отвечает, ссылка
возвращается на прежнюю версию сама. Неудачная сборка сайт не трогает.

## Автовыкладка

Таймер `ugg-deploy.timer` раз в две минуты спрашивает GitHub, есть ли
новые коммиты в `master`, и при изменении запускает выкладку. Достаточно
сделать `git push` — через две-три минуты сайт обновится.

```bash
systemctl status ugg-deploy.timer      # включён ли
journalctl -u ugg-deploy -n 50          # что делала последняя выкладка
systemctl start ugg-deploy              # выложить прямо сейчас, не ждать
```

Выкладка вручную: `sudo -iu ugg /srv/ugg/current/deploy/deploy.sh`.

## Что нужно от хостинга

- Ubuntu 24.04, 2 vCPU, 4 ГБ памяти, 40–50 ГБ NVMe, площадка в России.
- SSH-ключ добавлен при создании сервера.
- A-записи `uggrussia.shop` и `www.uggrussia.shop` указывают на IP сервера.
  Без этого Caddy не получит сертификат — он будет пробовать раз в минуту
  и заработает сам, как только запись обновится.
- Открытый исходящий порт 465 — иначе письма с сайта не уйдут. Timeweb
  закрывает SMTP-порты новым серверам, открытие запрашивается в панели.

## Первый запуск

С рабочей машины, где лежит ключ:

```bash
ssh root@IP 'bash -s' < deploy/setup.sh
```

Дальше на сервере:

```bash
ssh root@IP
nano /srv/ugg/shared/.env.local      # образец — /srv/ugg/current/.env.example
```

В `.env.local` обязательно:

| Переменная | Значение |
|---|---|
| `DATA_DIR` | `/srv/ugg/shared/data` — база вне папки версии. Ссылка на неё внутри проекта роняет сборку (Turbopack не ходит за корень), поэтому только переменная. Та же переменная экспортирована в `.profile` пользователя `ugg`, чтобы `npm run seed` и прочие скрипты видели ту же базу |
| `AUTH_SECRET` | `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `NEXT_PUBLIC_SITE_URL` | `https://uggrussia.shop` — без слэша; в продакшене без неё сборка падает |
| `CDEK_API_URL` | `https://api.cdek.ru` — боевой, не тестовый |
| `CDEK_ACCOUNT`, `CDEK_PASSWORD` | из договора со СДЭК |
| `SMTP_*`, `MAIL_FROM` | как в локальном `.env.local` |
| `SMTP_IP_FAMILY` | `6` — на этом хостинге исходящий SMTP закрыт по IPv4 и открыт по IPv6. Без переменной письмо уходит на 20 секунд позже (nodemailer сначала стучится в закрытый IPv4), а при длинных таймаутах форма «Забыли пароль?» висит минутами. Проверить: `timeout 8 bash -c 'exec 3<>/dev/tcp/77.88.21.158/465'` — молчание значит, что IPv4 закрыт |
| `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY` | когда будут; пусто — оплата картой выключена |

Потом первая сборка и автовыкладка:

```bash
sudo -iu ugg /srv/ugg/current/deploy/deploy.sh
systemctl enable --now ugg-deploy.timer
```

## Перенос данных с рабочей машины

База и фотографии не в git. Базу нельзя копировать файлом: в режиме WAL
часть записей лежит в журнале рядом, и копия получается неполной. Снимок
делается так:

```bash
node -e "require('better-sqlite3')('data/shop.db',{readonly:true}).backup('/tmp/shop.db')"
scp /tmp/shop.db root@IP:/srv/ugg/shared/data/shop.db
scp -r public/uploads/. root@IP:/srv/ugg/shared/uploads/
ssh root@IP 'chown -R ugg:ugg /srv/ugg/shared && systemctl restart ugg'
```

Тестовые заказы из локальной базы на сервере не нужны — их удаляют
после переноса. Если база новая: `npm run seed`, `npm run seed:legal`,
`npm run create-admin` из `/srv/ugg/current`.

## Резервные копии

Каждую ночь в 03:30 — `/srv/ugg/backups/`: база через `sqlite3 .backup`
и архив фотографий. Хранятся две недели. Копии лежат на том же диске —
при потере сервера пропадут вместе с ним, поэтому раз в неделю стоит
забирать свежую на рабочую машину:

```bash
scp root@IP:/srv/ugg/backups/shop-$(date +%F).db ./
```

Снимки Timeweb (платная опция в панели) покрывают именно потерю сервера.

## Логи

```bash
journalctl -u ugg -f          # приложение
journalctl -u ugg-deploy -f   # автовыкладка
journalctl -u caddy -f        # прокси и сертификаты
```
