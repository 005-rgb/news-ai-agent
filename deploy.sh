#!/usr/bin/env bash
# =============================================================================
# deploy.sh — Deploy News AI Agent ke cPanel / Shared Hosting
#
# Alur:
#   1. npm install + npm run build  (di Replit)
#   2. git add + commit + push      (ke GitHub)
#   3. SSH ke cPanel: git pull + npm install --production + restart app
#
# Cara pakai:
#   chmod +x deploy.sh
#   ./deploy.sh
#   atau dengan pesan commit kustom:
#   ./deploy.sh "feat: tambah fitur baru"
# =============================================================================
set -e  # Berhenti jika ada error

# ─── KONFIGURASI — SESUAIKAN SEBELUM DIJALANKAN ──────────────────────────────

CPANEL_SSH_USER="smknwon2"
CPANEL_SSH_HOST="tirtonirmolo.idweb.host"
CPANEL_SSH_PORT="2083"                    # Ganti ke port SSH cPanel (biasanya 22)
APP_DIR="public_html/ai"                  # Application root di cPanel
GITHUB_BRANCH="main"                      # Branch yang di-deploy
NODE_ENV_DIR="nodevenv/${APP_DIR}/22"     # Path nodevenv dari cPanel screenshot

# ─────────────────────────────────────────────────────────────────────────────

COMMIT_MSG="${1:-"deploy: $(date '+%Y-%m-%d %H:%M:%S')"}"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║         News AI Agent — Deploy ke cPanel             ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ─── STEP 1: Install dependencies ────────────────────────────────────────────
echo "▶ [1/4] npm install..."
npm install
echo "   ✓ Dependencies installed"

# ─── STEP 2: Build React frontend ────────────────────────────────────────────
echo ""
echo "▶ [2/4] npm run build (React frontend)..."
npm run build
echo "   ✓ Frontend built ke client/dist/"

# ─── STEP 3: Push ke GitHub ──────────────────────────────────────────────────
echo ""
echo "▶ [3/4] Push ke GitHub..."
git add -A
# Jika tidak ada perubahan, skip commit
if git diff --cached --quiet; then
  echo "   ℹ  Tidak ada perubahan baru — skip commit, tetap push"
else
  git commit -m "$COMMIT_MSG"
  echo "   ✓ Commit: $COMMIT_MSG"
fi
git push origin "$GITHUB_BRANCH"
echo "   ✓ Push ke branch '$GITHUB_BRANCH' selesai"

# ─── STEP 4: Deploy ke cPanel via SSH ────────────────────────────────────────
echo ""
echo "▶ [4/4] Deploy ke cPanel via SSH..."
echo "   Host : ${CPANEL_SSH_USER}@${CPANEL_SSH_HOST}:${CPANEL_SSH_PORT}"
echo "   Dir  : ~/${APP_DIR}"
echo ""

ssh -p "$CPANEL_SSH_PORT" "${CPANEL_SSH_USER}@${CPANEL_SSH_HOST}" bash << REMOTE_SCRIPT
set -e

echo "   [remote] Masuk ke direktori aplikasi..."
cd ~/${APP_DIR}

echo "   [remote] Git pull dari branch ${GITHUB_BRANCH}..."
git pull origin ${GITHUB_BRANCH}

echo "   [remote] Aktivasi Node.js virtual environment..."
source ~/\${NODE_ENV_DIR}/bin/activate 2>/dev/null || true

echo "   [remote] npm install --production..."
npm install --production --prefer-offline 2>&1 | tail -5

echo "   [remote] Restart aplikasi (Passenger)..."
mkdir -p tmp
touch tmp/restart.txt

echo ""
echo "   ✓ Deploy selesai!"
REMOTE_SCRIPT

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  ✅  Deploy berhasil!                                ║"
echo "║  🌐  https://agentic.skansagiri.sch.id              ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "  Catatan:"
echo "  • Jika app tidak restart otomatis, klik RESTART di cPanel > Node.js Selector"
echo "  • Pastikan env vars sudah diset di cPanel (lihat .env.cpanel.example)"
echo "  • Jalankan migrasi DB jika ada skema baru:"
echo "    ssh -p $CPANEL_SSH_PORT ${CPANEL_SSH_USER}@${CPANEL_SSH_HOST}"
echo "    cd ~/${APP_DIR} && node server/db.js migrate"
echo ""
