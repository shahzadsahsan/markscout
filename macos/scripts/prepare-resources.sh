#!/bin/bash
# prepare-resources.sh — Create a lean staging directory for Electron packaging.
# Strips dev dependencies and Turbopack dev cache before bundling.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
STAGING="$SCRIPT_DIR/../.staging"

echo "[prepare] Cleaning previous staging..."
rm -rf "$STAGING"
mkdir -p "$STAGING"

# 1. Copy .next — but exclude the massive dev/ directory and cache
echo "[prepare] Copying .next (excluding dev cache)..."
rsync -a --exclude='dev' --exclude='cache' "$PROJECT_ROOT/.next/" "$STAGING/.next/"

# 2. Copy public, config, package files
echo "[prepare] Copying public + config..."
cp -R "$PROJECT_ROOT/public" "$STAGING/public"
cp "$PROJECT_ROOT/next.config.ts" "$STAGING/next.config.ts"
cp "$PROJECT_ROOT/package.json" "$STAGING/package.json"
cp "$PROJECT_ROOT/package-lock.json" "$STAGING/package-lock.json"

# 3. Install production-only node_modules
echo "[prepare] Installing production dependencies only..."
cd "$STAGING"
npm ci --omit=dev --ignore-scripts 2>/dev/null || npm install --omit=dev --ignore-scripts 2>/dev/null

# 4. Strip unnecessary files from node_modules
echo "[prepare] Pruning node_modules bloat..."
cd "$STAGING/node_modules"

# Remove sharp/@img entirely (not used — no next/image in this app)
rm -rf @img sharp 2>/dev/null || true

# Remove non-darwin-arm64 platform binaries from @next
find . -path "*/@next/*" -type d \( \
  -name "*-linux-*" -o -name "*-win32-*" -o \
  -name "*-darwin-x64*" -o -name "*-freebsd-*" -o \
  -name "*-android-*" \
\) -exec rm -rf {} + 2>/dev/null || true

# Remove lightningcss non-darwin binaries
find . -name "lightningcss-linux-*" -type d -exec rm -rf {} + 2>/dev/null || true
find . -name "lightningcss-win32-*" -type d -exec rm -rf {} + 2>/dev/null || true

# Remove caniuse-lite data (Next.js works without it at runtime)
rm -rf caniuse-lite 2>/dev/null || true

# Remove TypeScript source maps and declaration files from deps
find . -name "*.d.ts" -delete 2>/dev/null || true
find . -name "*.d.ts.map" -delete 2>/dev/null || true
find . -name "*.map" -not -path "*/highlight.js/*" -delete 2>/dev/null || true

# Remove markdown docs, readmes, changelogs from deps
find . -maxdepth 3 -name "README.md" -delete 2>/dev/null || true
find . -maxdepth 3 -name "CHANGELOG.md" -delete 2>/dev/null || true
find . -maxdepth 3 -name "LICENSE" -delete 2>/dev/null || true
find . -maxdepth 3 -name "LICENSE.md" -delete 2>/dev/null || true

# Remove test directories
find . -type d -name "__tests__" -exec rm -rf {} + 2>/dev/null || true
find . -type d -name "test" -maxdepth 3 -exec rm -rf {} + 2>/dev/null || true
find . -type d -name "tests" -maxdepth 3 -exec rm -rf {} + 2>/dev/null || true

# Remove highlight.js languages we don't need (keep common ones)
HLJS_LANG="$STAGING/node_modules/highlight.js/lib/languages"
if [ -d "$HLJS_LANG" ]; then
  echo "[prepare] Pruning highlight.js languages..."
  KEEP="bash.js c.js cpp.js css.js diff.js go.js graphql.js ini.js java.js javascript.js json.js kotlin.js lua.js makefile.js markdown.js objectivec.js perl.js php.js plaintext.js python.js ruby.js rust.js scss.js shell.js sql.js swift.js typescript.js xml.js yaml.js"
  for f in "$HLJS_LANG"/*.js; do
    base=$(basename "$f")
    keep=false
    for k in $KEEP; do
      if [ "$base" = "$k" ]; then keep=true; break; fi
    done
    if [ "$keep" = "false" ]; then rm "$f"; fi
  done
fi

cd "$SCRIPT_DIR/.."

STAGING_SIZE=$(du -sh "$STAGING" | cut -f1)
echo "[prepare] Staging complete: $STAGING_SIZE"
echo "[prepare] Breakdown:"
du -sh "$STAGING/.next" "$STAGING/node_modules" "$STAGING/public" 2>/dev/null
