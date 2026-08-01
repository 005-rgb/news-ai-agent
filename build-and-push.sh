#!/usr/bin/env bash
# =============================================================================
# build-and-push.sh — Jalankan di REPLIT
#
# Langkah:
#   1. npm install
#   2. npm run build  (React → client/dist/)
#   3. git push ke GitHub  (termasuk hasil build)
#
# Cara pakai:
#   ./build-and-push.sh
#   ./build-and-push.sh "feat: tambah fitur baru"
# =============================================================================
set -e

GITHUB_REPO="005-rgb/news-ai-agent"
GITHUB_BRANCH="main"
COMMIT_MSG="${1:-"build: $(date '+%Y-%m-%d %H:%M:%S')"}"

echo ""
echo "╔═══════════════════════════════════════════╗"
echo "║   News AI Agent — Build & Push (Replit)   ║"
echo "╚═══════════════════════════════════════════╝"
echo ""

# Cek token
if [ -z "$GITHUB_PERSONAL_ACCESS_TOKEN" ]; then
  echo "✗ GITHUB_PERSONAL_ACCESS_TOKEN tidak ditemukan di Replit Secrets."
  exit 1
fi

# ─── 1. Install ───────────────────────────────────────────────────────────────
echo "▶ [1/3] npm install..."
npm install --prefer-offline
echo "   ✓ Done"

# ─── 2. Build ─────────────────────────────────────────────────────────────────
echo ""
echo "▶ [2/3] npm run build..."
npm run build
echo "   ✓ Build selesai → client/dist/"

# ─── 3. Push ke GitHub ────────────────────────────────────────────────────────
echo ""
echo "▶ [3/3] Push ke GitHub..."

git remote set-url origin "https://${GITHUB_PERSONAL_ACCESS_TOKEN}@github.com/${GITHUB_REPO}.git"

git add -A
if git diff --cached --quiet; then
  echo "   ℹ  Tidak ada perubahan — skip commit, tetap push"
else
  git commit -m "$COMMIT_MSG"
  echo "   ✓ Commit: $COMMIT_MSG"
fi

git push origin "$GITHUB_BRANCH"

# Reset remote (jangan simpan token di config git)
git remote set-url origin "https://github.com/${GITHUB_REPO}.git"

echo "   ✓ Push ke branch '$GITHUB_BRANCH' selesai"
echo ""
echo "╔═══════════════════════════════════════════╗"
echo "║  ✅  Build & push berhasil!               ║"
echo "║  Sekarang SSH ke cPanel, jalankan:        ║"
echo "║    bash ~/public_html/ai/deploy.sh        ║"
echo "╚═══════════════════════════════════════════╝"
echo ""
