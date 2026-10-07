#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build
release="/var/www/parada-obrigatoria/releases/$(date -u +%Y%m%dT%H%M%S)-$$"
sudo install -d -m 755 "$release"
sudo cp -a dist/parada-obrigatoria/browser/. "$release/"
sudo chmod -R a+rX "$release"
sudo ln -s "$release" /var/www/parada-obrigatoria/current-next
sudo mv -Tf /var/www/parada-obrigatoria/current-next /var/www/parada-obrigatoria/current
