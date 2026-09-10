#!/usr/bin/env bash
#
# Первичная настройка сервера под магазин. Запускается один раз на чистом
# Ubuntu 24.04 от root:
#
#   ssh root@IP 'bash -s' < deploy/setup.sh
#
# Ставит Node, Caddy, файрвол, заводит пользователя и службу. Сборку и
# запуск не делает: для них нужен .env.local с секретами, а его кладут
# руками после этого скрипта — см. docs/deploy.md.
set -euo pipefail

REPO="https://github.com/rashadmmdve/UGG.git"
APP_USER="ugg"
APP_DIR="/srv/ugg/app"
DOMAIN="uggrussia.shop"

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

echo "── Пользователь и код ──"
# Сайт работает от отдельного пользователя без прав root: если в
# приложении найдут дыру, до системы через неё не доберутся.
if ! id "$APP_USER" >/dev/null 2>&1; then
  useradd --system --create-home --home-dir /srv/ugg --shell /bin/bash "$APP_USER"
fi
mkdir -p /srv/ugg/backups
if [[ ! -d "$APP_DIR/.git" ]]; then
  git clone "$REPO" "$APP_DIR"
fi
chown -R "$APP_USER:$APP_USER" /srv/ugg

echo "── Служба ──"
install -m 644 "$APP_DIR/deploy/ugg.service" /etc/systemd/system/ugg.service
systemctl daemon-reload
systemctl enable ugg
# Пользователю сайта разрешено только перезапускать свою службу — этого
# достаточно для выкладки, и root ему для этого не нужен.
echo "$APP_USER ALL=(root) NOPASSWD: /usr/bin/systemctl restart ugg, /usr/bin/systemctl status ugg" \
  > /etc/sudoers.d/ugg
chmod 440 /etc/sudoers.d/ugg

echo "── Caddy: домен ──"
sed "s/{DOMAIN}/$DOMAIN/g" "$APP_DIR/deploy/Caddyfile" > /etc/caddy/Caddyfile
systemctl reload caddy || systemctl restart caddy

echo "── Резервные копии ──"
install -m 755 "$APP_DIR/deploy/backup.sh" /usr/local/bin/ugg-backup
# Каждую ночь в 03:30 по времени сервера.
echo "30 3 * * * $APP_USER /usr/local/bin/ugg-backup" > /etc/cron.d/ugg-backup

cat <<EOF

Сервер готов. Дальше — от пользователя $APP_USER:

  sudo -iu $APP_USER
  cd $APP_DIR
  cp .env.example .env.local && nano .env.local    # секреты
  npm ci && npm run build
  npm run create-admin                              # если база новая
  exit
  systemctl start ugg

Подробности — docs/deploy.md.
EOF
