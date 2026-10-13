#!/bin/sh
# Serverni BIR MARTA tayyorlash (root). Takror ishga tushirilsa mavjud narsalarni buzmaydi.
# Maxfiy kalitlar shu yerda tasodifiy yaratiladi va faqat /opt/nybarber/.env da qoladi.
set -eu
DOMAIN=nybarber.bunyodmusayev.uz
SERVER_IP=31.220.81.174
cd /opt/nybarber

mkdir -p data/postgres uploads backups
chown 1654:1654 uploads   # konteynerdagi "app" foydalanuvchisi rasmlarni yoza olishi uchun

if [ ! -f .env ]; then
    umask 077
    printf 'POSTGRES_PASSWORD=%s\nJWT_KEY=%s\n' "$(openssl rand -hex 24)" "$(openssl rand -base64 48 | tr -d '\n')" > .env
    echo ".env yaratildi"
fi

if [ ! -f /etc/nginx/sites-available/nybarber ]; then
    if ! getent hosts "$DOMAIN" | grep -q "^$SERVER_IP "; then
        echo "DNS: $DOMAIN hali bu serverga yo'naltirilmagan - nginx/HTTPS keyinroq (setup'ni qayta ishga tushiring)."
    else
        cp src/deploy/nginx-site.conf /etc/nginx/sites-available/nybarber
        ln -s /etc/nginx/sites-available/nybarber /etc/nginx/sites-enabled/nybarber
        nginx -t && systemctl reload nginx
        certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --redirect --register-unsafely-without-email
    fi
fi

install -m 755 src/deploy/backup.sh /opt/nybarber/backup.sh
echo "30 3 * * * root /opt/nybarber/backup.sh" > /etc/cron.d/nybarber-backup
echo "Tayyor."
