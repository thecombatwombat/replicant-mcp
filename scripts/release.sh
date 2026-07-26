#!/bin/bash
set -e

# Usage: ./scripts/release.sh [patch|minor|major] [--dry-run]
# Default: patch

DRY_RUN=false
VERSION_TYPE="patch"

for arg in "$@"; do
  case $arg in
    --dry-run) DRY_RUN=true ;;
    patch|minor|major) VERSION_TYPE=$arg ;;
    *)
      echo "Usage: $0 [patch|minor|major] [--dry-run]"
      exit 1
      ;;
  esac
done

# Pre-flight checks
echo "🔍 Pre-flight checks..."

# Check we're on master
CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" != "master" ]]; then
  echo "❌ Must be on master branch (currently on $CURRENT_BRANCH)"
  exit 1
fi

# Check no uncommitted changes to tracked files
if [[ -n $(git status --porcelain | grep -v '^??') ]]; then
  echo "❌ Uncommitted changes to tracked files. Commit or stash first."
  git status --short | grep -v '^??'
  exit 1
fi

# Check we're up to date with origin
git fetch origin master --quiet
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/master)
if [[ "$LOCAL" != "$REMOTE" ]]; then
  echo "❌ Local master differs from origin. Pull or push first."
  exit 1
fi

# Calculate new version and check npm
CURRENT_VERSION=$(node -p "require('./package.json').version")
case $VERSION_TYPE in
  patch)
    NEW_VERSION=$(echo $CURRENT_VERSION | awk -F. '{print $1"."$2"."$3+1}')
    ;;
  minor)
    NEW_VERSION=$(echo $CURRENT_VERSION | awk -F. '{print $1"."$2+1".0"}')
    ;;
  major)
    NEW_VERSION=$(echo $CURRENT_VERSION | awk -F. '{print $1+1".0.0"}')
    ;;
esac

echo "   Current: $CURRENT_VERSION → New: $NEW_VERSION"

# Check if version already exists on npm
if npm view "replicant-mcp@$NEW_VERSION" version &>/dev/null; then
  echo "❌ Version $NEW_VERSION already exists on npm!"
  echo "   Run 'npm view replicant-mcp versions' to see published versions."
  exit 1
fi

# Check if git tag already exists
if git rev-parse "v$NEW_VERSION" &>/dev/null; then
  echo "❌ Git tag v$NEW_VERSION already exists!"
  exit 1
fi

echo "✅ Pre-flight checks passed"

if [[ "$DRY_RUN" == "true" ]]; then
  echo ""
  echo "🏃 Dry run - would release v$NEW_VERSION"
  echo "   Run without --dry-run to execute"
  exit 0
fi

echo "📋 Running tests..."
npm test

echo "📦 Bumping to $NEW_VERSION..."
npm version $NEW_VERSION --no-git-tag-version >/dev/null

# Sync version in .mcp/server.json (MCP Registry manifest)
if [[ -f .mcp/server.json ]]; then
  node -e "
    const fs = require('fs');
    const s = JSON.parse(fs.readFileSync('.mcp/server.json', 'utf8'));
    s.version = '$NEW_VERSION';
    if (s.packages) s.packages.forEach(p => p.version = '$NEW_VERSION');
    fs.writeFileSync('.mcp/server.json', JSON.stringify(s, null, 2) + '\n');
  "
  echo "   Synced .mcp/server.json → $NEW_VERSION"

  # Soft pre-flight: validate the manifest if mcp-publisher is installed locally.
  # CI runs this same check (pinned) and is the source of truth — this just catches
  # schema breakage before we tag, so we don't ship a tag CI will reject.
  if command -v mcp-publisher >/dev/null 2>&1; then
    echo "   Validating .mcp/server.json with mcp-publisher..."
    if ! mcp-publisher validate .mcp/server.json; then
      echo "❌ mcp-publisher validate failed — fix .mcp/server.json before releasing"
      exit 1
    fi
  else
    echo "   ℹ️  mcp-publisher not installed locally — skipping pre-flight validate (CI will validate)"
  fi
fi

# Sync version in manifest.json (MCPB Desktop Extensions manifest)
if [[ -f manifest.json ]]; then
  node -e "
    const fs = require('fs');
    const m = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
    m.version = '$NEW_VERSION';
    fs.writeFileSync('manifest.json', JSON.stringify(m, null, 2) + '\n');
  "
  echo "   Synced manifest.json → $NEW_VERSION"
fi

# Sync version in .cursor-plugin/plugin.json (Cursor marketplace manifest)
if [[ -f .cursor-plugin/plugin.json ]]; then
  node -e "
    const fs = require('fs');
    const p = JSON.parse(fs.readFileSync('.cursor-plugin/plugin.json', 'utf8'));
    p.version = '$NEW_VERSION';
    fs.writeFileSync('.cursor-plugin/plugin.json', JSON.stringify(p, null, 2) + '\n');
  "
  echo "   Synced .cursor-plugin/plugin.json → $NEW_VERSION"
fi

echo "🔨 Building..."
npm run build

# Rebuild MCPB Desktop Extensions bundle (includes fresh dist/ + updated manifest)
if [[ -f manifest.json ]]; then
  echo "📦 Rebuilding MCPB bundle..."
  bash scripts/build-bundle.sh replicant-mcp.mcpb
  # Verify bundle version matches
  BUNDLE_VERSION=$(unzip -p replicant-mcp.mcpb package.json | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>process.stdout.write(JSON.parse(d).version))")
  if [[ "$BUNDLE_VERSION" != "$NEW_VERSION" ]]; then
    echo "❌ Bundle version mismatch: bundle=$BUNDLE_VERSION, expected=$NEW_VERSION"
    exit 1
  fi
  echo "   ✅ Bundle version matches v$NEW_VERSION"

  # Boot the packed bundle before it can be released. A version string inside a
  # bundle that cannot start is what shipped v1.6.1–v1.6.7.
  echo "🔍 Verifying bundle runs..."
  node scripts/verify-bundle.mjs replicant-mcp.mcpb
fi

echo "📝 Committing..."
git add package.json package-lock.json
[[ -f .mcp/server.json ]] && git add .mcp/server.json
[[ -f manifest.json ]] && git add manifest.json
[[ -f .cursor-plugin/plugin.json ]] && git add .cursor-plugin/plugin.json
# replicant-mcp.mcpb is deliberately NOT committed — it is a ~60MB build artifact,
# rebuilt by CI and attached to the GitHub Release (see .github/workflows/release.yml).
git commit -m "chore: release v$NEW_VERSION"

echo "🏷️  Tagging v$NEW_VERSION..."
git tag -a "v$NEW_VERSION" -m "v$NEW_VERSION"

echo "🚀 Pushing to origin..."
git push origin master
git push origin "v$NEW_VERSION"

echo "✅ v$NEW_VERSION tagged and pushed. CI will publish to npm and create the GitHub Release."
