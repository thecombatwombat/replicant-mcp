#!/bin/bash
# Build the MCPB Desktop Extension bundle.
#
# MCPB bundles must be SELF-CONTAINED: Claude Desktop unpacks the .mcpb and runs
# `node dist/index.js` directly. It never runs `npm install`. If node_modules is
# missing, the server dies on its first import and the user sees only
# "Server disconnected" with no diagnostics.
#
# The bundle is assembled in a staging directory rather than packed from the
# working tree. Packing the working tree meant relying on .mcpbignore to subtract
# everything unwanted, which was both fragile (any new top-level dir leaked in)
# and actively dangerous (an unanchored `src/` pattern also matched
# node_modules/tesseract.js/src, deleting that package's entry point). Staging
# inverts this: only what we explicitly copy ships.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

STAGE="$PROJECT_DIR/.mcpb-build"
OUTPUT="${1:-$PROJECT_DIR/replicant-mcp.mcpb}"
# Resolve to an absolute path. Packing happens after `cd "$STAGE"`, so a relative
# path would write the bundle inside the staging directory and lose it to the
# cleanup below.
[[ "$OUTPUT" == /* ]] || OUTPUT="$PROJECT_DIR/$OUTPUT"

# Platforms the bundle carries sharp binaries for. sharp ships its native code as
# per-platform optional dependencies, so a bundle built on one machine only has
# that machine's binary unless we ask for the others explicitly.
# Format: os:cpu:libc (libc empty for non-linux). linuxmusl is omitted — Alpine
# is not a Claude Desktop target and each variant costs ~15MB.
SHARP_PLATFORMS=(
  "darwin:arm64:"
  "darwin:x64:"
  "win32:x64:"
  "win32:arm64:"
  "linux:x64:glibc"
  "linux:arm64:glibc"
)

echo "🧹 Cleaning staging directory..."
rm -rf "$STAGE"
mkdir -p "$STAGE"

echo "🔨 Building TypeScript..."
npm run build

# Everything the server touches at runtime. docs/rtfm is required by the rtfm
# tool (src/tools/rtfm.ts resolves ../../docs/rtfm relative to dist/tools) —
# omitting it made rtfm throw ENOENT in every shipped bundle.
echo "📂 Staging bundle files..."
BUNDLE_PATHS=(
  "dist"
  "docs/rtfm"
  "docs/contracts"
  "manifest.json"
  "package.json"
  "package-lock.json"
  "icon.png"
  "eng.traineddata"
  "README.md"
  "LICENSE"
  "PRIVACY.md"
  "assets"
)
for path in "${BUNDLE_PATHS[@]}"; do
  if [[ ! -e "$path" ]]; then
    echo "❌ Required bundle path missing: $path"
    exit 1
  fi
  mkdir -p "$STAGE/$(dirname "$path")"
  cp -R "$path" "$STAGE/$(dirname "$path")/"
done

# Pin sharp to the version in the lockfile so the cross-platform installs below
# cannot drift to a newer release than the one this bundle was tested against.
SHARP_VERSION="$(node -p "require('./package-lock.json').packages['node_modules/sharp'].version")"
echo "   sharp pinned to $SHARP_VERSION"

echo "📦 Installing production dependencies..."
cd "$STAGE"
npm ci --omit=dev --ignore-scripts --no-audit --no-fund >/dev/null

echo "🌍 Adding sharp binaries for all target platforms..."
for entry in "${SHARP_PLATFORMS[@]}"; do
  IFS=':' read -r os cpu libc <<< "$entry"
  flags=(--os="$os" --cpu="$cpu")
  [[ -n "$libc" ]] && flags+=(--libc="$libc")
  npm install --omit=dev --ignore-scripts --no-audit --no-fund --no-save \
    "${flags[@]}" "sharp@$SHARP_VERSION" >/dev/null
  echo "   ✓ $os-$cpu${libc:+-$libc}"
done

# Fail loudly if a platform binary did not land — a silently missing binary means
# a broken install for every user on that platform.
for entry in "${SHARP_PLATFORMS[@]}"; do
  IFS=':' read -r os cpu libc <<< "$entry"
  if [[ ! -d "node_modules/@img/sharp-${os}-${cpu}" ]]; then
    echo "❌ Missing sharp binary: @img/sharp-${os}-${cpu}"
    exit 1
  fi
done

# npm resolves sharp's optional dependencies more broadly than requested — asking
# for linux/glibc also pulls the musl libvips builds (~16MB each). Prune anything
# outside the target list; each stray libvips variant is pure bundle weight.
echo "✂️  Pruning sharp binaries for untargeted platforms..."
KEEP=("colour")
for entry in "${SHARP_PLATFORMS[@]}"; do
  IFS=':' read -r os cpu libc <<< "$entry"
  KEEP+=("sharp-${os}-${cpu}" "sharp-libvips-${os}-${cpu}")
done
for dir in node_modules/@img/*/; do
  name="$(basename "$dir")"
  keep=false
  for k in "${KEEP[@]}"; do
    [[ "$name" == "$k" ]] && keep=true && break
  done
  if [[ "$keep" == false ]]; then
    echo "   − $name"
    rm -rf "$dir"
  fi
done

# tesseract.js in Node loads the split .js + .wasm pair (see
# tesseract.js/src/worker-script/node/getCore.js). The six *.wasm.js single-file
# browser builds are never required here and cost ~25MB.
echo "✂️  Trimming browser-only tesseract wasm builds..."
rm -f node_modules/tesseract.js-core/*.wasm.js

# package-lock.json was only needed for `npm ci` above; it is not a runtime file.
rm -f package-lock.json

echo "🗜️  Packing..."
npx --yes @anthropic-ai/mcpb pack . "$OUTPUT"

cd "$PROJECT_DIR"
rm -rf "$STAGE"

# Never exit 0 without the artifact actually being where the caller asked for it.
if [[ ! -f "$OUTPUT" ]]; then
  echo "❌ Pack reported success but no bundle at: $OUTPUT"
  exit 1
fi

echo ""
echo "✅ Bundle built: $OUTPUT ($(du -h "$OUTPUT" | cut -f1))"
