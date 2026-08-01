#!/usr/bin/env bash
# =============================================================================
# deploy.sh — Deploy News AI Agent ke cPanel / Shared Hosting via SSH
#
# Alur:
#   1. npm install + npm run build  (di Replit)
#   2. git add + commit + push      (ke GitHub, pakai GITHUB_PERSONAL_ACCESS_TOKEN)
#   3. SSH ke cPanel: git pull + npm install --production + restart app
#
# Cara pakai:
#   ./deploy.sh
#   ./deploy.sh "feat: tambah fitur baru"   ← pesan commit kustom
#
# Syarat:
#   - Env var GITHUB_PERSONAL_ACCESS_TOKEN harus di-set (sudah ada di Replit Secrets)
#   - SSH key sudah ditambahkan ke cPanel (Tools > SSH Access > Manage SSH Keys)
#     atau siapkan password saat diminta
# =============================================================================
set -e

# ─── KONFIGURASI ─────────────────────────────────────────────────────────────

CPANEL_SSH_USER="smknwon2"
CPANEL_SSH_HOST="tirtonirmolo.idweb.host"
CPANEL_SSH_PORT="22"                          # Port SSH standar (cek di cPanel > SSH Access jika beda)
APP_DIR="public_html/ai"                      # Application root di cPanel
GITHUB_REPO="005-rgb/news-ai-agent"           # owner/repo
GITHUB_BRANCH="main"
NODEVENV_PATH="nodevenv/public_html/ai/22"    # Path nodevenv di cPanel (sesuai screenshot)

# ─────────────────────────────────────────────────────────────────────────────

COMMIT_MSG="${1:-"deploy: $(date '+%Y-%m-%d %H:%M:%S')"}"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║         News AI Agent — Deploy ke cPanel             ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ─── Cek token tersedia ───────────────────────────────────────────────────────
if [ -z "$GITHUB_PERSONAL_ACCESS_TOKEN" ]; then
  echo "✗ GITHUB_PERSONAL_ACCESS_TOKEN tidak ditemukan."
  echo "  Set dulu di Replit Secrets lalu jalankan ulang."
  exit 1
fi

# ─── STEP 1: Install dependencies ────────────────────────────────────────────
echo "▶ [1/4] npm install..."
npm install --prefer-offline
echo "   ✓ Dependencies installed"

# ─── STEP 2: Build React frontend ────────────────────────────────────────────
echo ""
echo "▶ [2/4] npm run build..."
npm run build
echo "   ✓ Frontend built ke client/dist/"

# ─── STEP 3: Push ke GitHub ──────────────────────────────────────────────────
echo ""
echo "▶ [3/4] Push ke GitHub (${GITHUB_REPO})..."

# Set remote pakai token untuk push, lalu reset ke URL publik
git remote set-url origin "https://${GITHUB_PERSONAL_ACCESS_TOKEN}@github.com/${GITHUB_REPO}.git"

git add -A
if git diff --cached --quiet; then
  echo "   ℹ  Tidak ada perubahan baru — skip commit, tetap push"
else
  git commit -m "$COMMIT_MSG"
  echo "   ✓ Commit: $COMMIT_MSG"
fi

git push origin "$GITHUB_BRANCH"

# Reset remote ke URL publik (jangan simpan token di config git)
git remote set-url origin "https://github.com/${GITHUB_REPO}.git"

echo "   ✓ Push ke branch '$GITHUB_BRANCH' selesai"

# ─── STEP 4: Deploy ke cPanel via SSH ────────────────────────────────────────
echo ""
echo "▶ [4/4] Deploy ke cPanel via SSH..."
echo "   Host: ${CPANEL_SSH_USER}@${CPANEL_SSH_HOST}:${CPANEL_SSH_PORT}"
echo "   Dir : ~/${APP_DIR}"
echo ""

# Variabel lokal di-expand sebelum dikirim ke remote (heredoc tanpa quote)
ssh -p "$CPANEL_SSH_PORT" "${CPANEL_SSH_USER}@${CPANEL_SSH_HOST}" bash << ENDSSH
set -e

echo "   [remote] Masuk ke direktori aplikasi..."
cd ~/${APP_DIR}

echo "   [remote] Git pull branch ${GITHUB_BRANCH}..."
git pull origin ${GITHUB_BRANCH}

echo "   [remote] Aktivasi Node.js virtual environment..."
source ~/${NODEVENV_PATH}/bin/activate 2>/dev/null || true

echo "   [remote] npm install --production..."
npm install --production --prefer-offline 2>&1 | tail -10

echo "   [remote] Restart aplikasi (Passenger touch restart)..."
mkdir -p tmp
touch tmp/restart.txt

echo ""
echo "   ✓ Remote deploy selesai!"
ENDSSH

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  ✅  Deploy berhasil!                                ║"
echo "║  🌐  https://agentic.skansagiri.sch.id              ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "  Tips:"
echo "  • Jika app tidak merespons, klik RESTART di cPanel > Node.js Selector"
echo "  • Migrasi DB (jika ada skema baru):"
echo "    ssh -p ${CPANEL_SSH_PORT} ${CPANEL_SSH_USER}@${CPANEL_SSH_HOST}"
echo "    cd ~/${APP_DIR} && node server/db.js migrate"
echo ""
