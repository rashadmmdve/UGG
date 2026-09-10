#!/usr/bin/env bash
#
# Первичная настройка сервера под магазин. Запускается один раз на чистом
# Ubuntu 24.04 от root:
#
#   ssh root@IP 'bash -s' < deploy/setup.sh
#
# Ставит Node, Caddy, файрвол, заводит пользователя, службу и автовыкладку.
# Первую сборку не делает: для неё нужен .env.local с секретами — см.
# docs/deploy.md.
#
# Раскладка на сервере:
#   /srv/ugg/releases/<sha>   версии кода, каждая в своей папке
#   /srv/ugg/current          ссылка на рабочую версию (её читает служба)
#   /srv/ugg/shared           база, фото, .env.local — одно на все версии
#   /srv/ugg/backups          ночные копии
set -euo pipefail

REPO="https://github.com/rashadmmdve/UGG.git"
APP_USER="ugg"
ROOT="/srv/ugg"
DOMAIN="uggrussia.shop"

echo "── Зеркало пакетов ──"
# В образах Timeweb прописано их зеркало, и оно бывает недоступно —
# тогда apt падает на первом же шаге. Переводим на официальное.
if grep -qs "mirror.timeweb.ru" /etc/apt/sources.list.d/ubuntu.sources; then
  sed -i "s|http://mirror.timeweb.ru/ubuntu/|http://ru.archive.ubuntu.com/ubuntu/|" /etc/apt/sources.list.d/ubuntu.sources
fi

echo "── Пакеты ──"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get upgrade -yq
# build-essential и python3 нужны better-sqlite3 и sharp: они собирают
# нативные модули при установке. sqlite3 — для резервных копий.
apt-get install -yq curl git ufw build-essential python3 sqlite3 \
  debian-keyring debian-archive-keyring apt-transport-https ca-certificates

echo "── Подкачка 2 ГБ ──"
# Сборка Next съедает больше памяти, чем работа сайта. Без подкачки на
# небольшом сервере сборка падает молча, с «Killed».
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "── Файрвол ──"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "── Node 22 ──"
if ! command -v node >/dev/null || [[ "$(node -v)" != v22* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -yq nodejs
fi
node -v

echo "── Caddy ──"
# Обратный прокси с автоматическим HTTPS: сертификат Let's Encrypt
# получает и продлевает сам, ничего настраивать не нужно.
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    | tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  apt-get update -q
  apt-get install -yq caddy
fi

echo "── Пользователь и раскладка ──"
# Сайт работает от отдельного пользователя без прав root: если в
# приложении найдут дыру, до системы через неё не доберутся.
if ! id "$APP_USER" >/dev/null 2>&1; then
  useradd --system --create-home --home-dir "$ROOT" --shell /bin/bash "$APP_USER"
fi
mkdir -p "$ROOT/releases" "$ROOT/shared/data" "$ROOT/shared/uploads" "$ROOT/backups"
touch "$ROOT/shared/.env.local"
chmod 600 "$ROOT/shared/.env.local"
# База лежит вне папки версии и находится через DATA_DIR: и приложение
# (через .env.local), и служебные скрипты, которые запускают от ugg.
grep -q "^DATA_DIR=" "$ROOT/shared/.env.local" || echo "DATA_DIR=$ROOT/shared/data" >> "$ROOT/shared/.env.local"
grep -qs "DATA_DIR" "$ROOT/.profile" || echo "export DATA_DIR=$ROOT/shared/data" >> "$ROOT/.profile"

# Первая версия — просто клон; собирать её будет deploy.sh, когда
# появится .env.local.
if [[ ! -L $ROOT/current ]]; then
  sha=$(git ls-remote "$REPO" refs/heads/master | cut -f1)
  git clone --quiet --depth 1 "$REPO" "$ROOT/releases/$sha"
  ln -sfn "$ROOT/releases/$sha" "$ROOT/current"
fi
chown -R "$APP_USER:$APP_USER" "$ROOT"

echo "── Службы ──"
install -m 644 "$ROOT/current/deploy/ugg.service"        /etc/systemd/system/ugg.service
install -m 644 "$ROOT/current/deploy/ugg-deploy.service" /etc/systemd/system/ugg-deploy.service
install -m 644 "$ROOT/current/deploy/ugg-deploy.timer"   /etc/systemd/system/ugg-deploy.timer
systemctl daemon-reload
systemctl enable ugg
# Пользователю сайта разрешено только перезапускать свою службу — этого
# достаточно для выкладки, и root ему для этого не нужен.
echo "$APP_USER ALL=(root) NOPASSWD: /usr/bin/systemctl restart ugg, /usr/bin/systemctl status ugg" \
  > /etc/sudoers.d/ugg
chmod 440 /etc/sudoers.d/ugg

echo "── Caddy: домен ──"
sed "s/{DOMAIN}/$DOMAIN/g" "$ROOT/current/deploy/Caddyfile" > /etc/caddy/Caddyfile
systemctl reload caddy || systemctl restart caddy

echo "── Резервные копии ──"
install -m 755 "$ROOT/current/deploy/backup.sh" /usr/local/bin/ugg-backup
# Каждую ночь в 03:30 по времени сервера.
echo "30 3 * * * $APP_USER /usr/local/bin/ugg-backup" > /etc/cron.d/ugg-backup

cat <<EOF

Сервер готов. Дальше:

  1. Секреты:      nano $ROOT/shared/.env.local     (образец — $ROOT/current/.env.example)
  2. Первая сборка: sudo -iu $APP_USER $ROOT/current/deploy/deploy.sh
  3. Автовыкладка:  systemctl enable --now ugg-deploy.timer

Подробности — docs/deploy.md.
EOF
