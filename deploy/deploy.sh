#!/bin/sh
# Kodni serverga yuborib, konteynerlarni qayta yig'adi. Git Bash'da: ./deploy/deploy.sh
# Baza (data/), rasmlar (uploads/) va .env ga tegmaydi.
set -eu
HOST=${HOST:-root@31.220.81.174}
cd "$(dirname "$0")/.."

git ls-files -co --exclude-standard -z \
  | tar --null -czf - -T - \
  | ssh "$HOST" 'set -e
      mkdir -p /opt/nybarber && cd /opt/nybarber
      rm -rf src.new && mkdir src.new && tar -xzf - -C src.new
      rm -rf src && mv src.new src
      cp src/deploy/docker-compose.yml docker-compose.yml
      [ -f .env ] || sh src/deploy/server-setup.sh
      docker compose up -d --build
      docker image prune -f >/dev/null
      docker compose ps'
