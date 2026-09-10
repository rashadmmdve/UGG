#!/usr/bin/env bash
#
# Выкладка новой версии. Запускается на сервере от пользователя ugg:
#
#   sudo -iu ugg /srv/ugg/app/deploy/deploy.sh
#
# Или с рабочей машины одной командой:
#
#   ssh root@IP 'sudo -iu ugg /srv/ugg/app/deploy/deploy.sh'
#
# Тянет код из GitHub, собирает и перезапускает службу. .env.local и
# data/ git не трогает — они не в репозитории.
set -euo pipefail

cd /srv/ugg/app

echo "── Код ──"
git fetch --quiet origin master
git reset --hard --quiet origin/master
git log --oneline -1

echo "── Зависимости ──"
npm ci --no-audit --no-fund

echo "── Сборка ──"
# Сборка идёт в тот же .next, из которого работает сайт: на пару секунд
# между концом сборки и перезапуском страницы могут отдать ошибку. Для
# магазина такого размера это приемлемо; когда трафик вырастет —
# собирать в соседнюю папку и переключать ссылкой.
NODE_OPTIONS=--max-old-space-size=3072 npm run build

echo "── Перезапуск ──"
sudo systemctl restart ugg
sleep 2
systemctl is-active ugg && echo "Сайт перезапущен."
