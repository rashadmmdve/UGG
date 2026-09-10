#!/usr/bin/env bash
#
# Выкладка новой версии без простоя.
#
#   /srv/ugg/current/deploy/deploy.sh               — выложить origin/master
#   /srv/ugg/current/deploy/deploy.sh --if-changed  — только если есть новые коммиты
#                                                     (так вызывает таймер автодеплоя)
#
# Устройство:
#   /srv/ugg/releases/<sha>   — каждая версия в своей папке
#   /srv/ugg/current          — ссылка на рабочую версию, её читает служба
#   /srv/ugg/shared           — база, фото, .env.local: одно на все версии
#
# Сборка идёт в новой папке, пока старая продолжает обслуживать сайт.
# Ссылка переключается только после успешной сборки, служба
# перезапускается за секунду, и если сайт после этого не отвечает —
# ссылка возвращается на прежнюю версию. Неудачная сборка сайт не трогает.
set -euo pipefail

ROOT=/srv/ugg
REPO="https://github.com/rashadmmdve/UGG.git"
BRANCH=master
KEEP=3

# Две выкладки одновременно — гарантированная каша. Ждём, пока закончится первая.
exec 9>"$ROOT/.deploy.lock"
flock 9

current_sha() {
  [[ -L $ROOT/current ]] && git -C "$ROOT/current" rev-parse HEAD 2>/dev/null || echo none
}

remote_sha=$(git ls-remote "$REPO" "refs/heads/$BRANCH" | cut -f1)
[[ -n $remote_sha ]] || { echo "GitHub не ответил"; exit 1; }

if [[ ${1:-} == --if-changed && $remote_sha == "$(current_sha)" ]]; then
  exit 0
fi

echo "── $(date '+%F %T') · выкладка ${remote_sha:0:8} (сейчас $(current_sha | cut -c1-8)) ──"

release="$ROOT/releases/$remote_sha"
mkdir -p "$ROOT/releases"

# Пересборка того же коммита не должна идти в папке, которую сейчас
# обслуживает служба: Next переписывает .next под работающим сервером,
# и сборка падает с внутренней ошибкой Turbopack. Берём свежую папку.
if [[ $(readlink -f "$ROOT/current" 2>/dev/null) == "$release" ]]; then
  release="$ROOT/releases/${remote_sha}-$(date +%s)"
fi

if [[ ! -d $release ]]; then
  echo "── Код ──"
  git clone --quiet --depth 1 --branch "$BRANCH" "$REPO" "$release"
  git -C "$release" log --oneline -1
fi

# Общее для всех версий подключается ссылками, а не копируется:
# база одна, фото одни, секреты одни.
ln -sfn "$ROOT/shared/data"    "$release/data"
ln -sfn "$ROOT/shared/uploads" "$release/public/uploads"
ln -sfn "$ROOT/shared/.env.local" "$release/.env.local"

echo "── Зависимости ──"
(cd "$release" && npm ci --no-audit --no-fund --loglevel=error)

echo "── Сборка ──"
# Полный вывод — в файл рядом с версией; на экран только итог, а при
# ошибке — её хвост, иначе причину не найти.
if (cd "$release" && NODE_OPTIONS=--max-old-space-size=3072 npm run build >"$release/build.log" 2>&1); then
  tail -3 "$release/build.log"
else
  echo "!! Сборка не удалась, сайт не тронут. Последние строки:"
  tail -30 "$release/build.log"
  exit 1
fi

previous=$(readlink -f "$ROOT/current" 2>/dev/null || true)

echo "── Переключение ──"
ln -sfn "$release" "$ROOT/current.new" && mv -Tf "$ROOT/current.new" "$ROOT/current"
sudo systemctl restart ugg

# Сайт должен ответить сам, локально, минуя Caddy.
ok=0
for _ in $(seq 1 20); do
  sleep 1
  if curl -sf -o /dev/null --max-time 5 http://127.0.0.1:3000/; then ok=1; break; fi
done

if [[ $ok == 1 ]]; then
  echo "Сайт отвечает, версия ${remote_sha:0:8} в работе."
else
  echo "!! Сайт не ответил за 20 секунд — откатываюсь."
  if [[ -n $previous && -d $previous ]]; then
    ln -sfn "$previous" "$ROOT/current.new" && mv -Tf "$ROOT/current.new" "$ROOT/current"
    sudo systemctl restart ugg
    echo "Возвращена версия $(basename "$previous" | cut -c1-8)."
  fi
  exit 1
fi

# Старые версии — под нож, кроме последних KEEP: место не резиновое,
# а откатиться дальше чем на пару версий назад обычно не нужно.
echo "── Уборка ──"
ls -1dt "$ROOT/releases"/*/ 2>/dev/null | tail -n +$((KEEP + 1)) | while read -r old; do
  [[ $(readlink -f "$old") == "$(readlink -f "$ROOT/current")" ]] && continue
  rm -rf "$old" && echo "удалена $(basename "$old" | cut -c1-8)"
done
