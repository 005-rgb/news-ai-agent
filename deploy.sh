#!/usr/bin/env bash
# =============================================================================
# deploy.sh — Jalankan di CPANEL (setelah SSH masuk)
#
# Langkah:
#   1. git pull dari GitHub
#   2. npm install --production  (hanya production deps, ringan)
#   3. Restart aplikasi (Passenger)
#
# Cara pakai (dari cPanel SSH):
#   cd ~/public_html/ai
#   bash deploy.sh
# =============================================================================
set -e

APP_DIR="$(cd "$(dirname "$0")" && pwd)"   # direktori tempat deploy.sh berada
GITHUB_BRANCH="main"
NODEVENV_PATH="$HOME/nodevenv/public_html/ai/22"

echo ""
echo "╔═══════════════════════════════════════════╗"
echo "║   News AI Agent — Deploy (cPanel)         ║"
echo "╚═══════════════════════════════════════════╝"
echo ""
echo "  Dir  : $APP_DIR"
echo "  Branch: $GITHUB_BRANCH"
echo ""

cd "$APP_DIR"

# ─── 1. Git pull ──────────────────────────────────────────────────────────────
echo "▶ [1/3] git pull..."
git pull origin "$GITHUB_BRANCH"
echo "   ✓ Kode terbaru sudah ditarik"

# ─── 2. npm install --production ─────────────────────────────────────────────
echo ""
echo "▶ [2/3] npm install --production..."

# Aktifkan Node.js virtual environment cPanel
if [ -f "$NODEVENV_PATH/bin/activate" ]; then
  source "$NODEVENV_PATH/bin/activate"
fi

npm install --production --prefer-offline
echo "   ✓ Production dependencies siap"

# ─── 3. Restart Passenger ────────────────────────────────────────────────────
echo ""
echo "▶ [3/3] Restart aplikasi..."
mkdir -p tmp
touch tmp/restart.txt
echo "   ✓ Restart signal dikirim (tmp/restart.txt)"

echo ""
echo "╔═══════════════════════════════════════════╗"
echo "║  ✅  Deploy selesai!                      ║"
echo "║  🌐  https://agentic.skansagiri.sch.id   ║"
echo "╚═══════════════════════════════════════════╝"
echo ""
echo "  Jika app belum merespons, klik RESTART"
echo "  di cPanel > Node.js Selector"
echo ""
