#!/bin/bash
set -e

# Usage: ./scripts/release.sh [patch|minor|major]
# Default: patch

VERSION_TYPE=${1:-patch}

if [[ ! "$VERSION_TYPE" =~ ^(patch|minor|major)$ ]]; then
  echo "Usage: $0 [patch|minor|major]"
  exit 1
fi

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

echo "📋 Running tests..."
npm test -- --run

echo "📦 Bumping to $NEW_VERSION..."
npm version $NEW_VERSION --no-git-tag-version >/dev/null

echo "🔨 Building..."
npm run build

echo "📝 Committing..."
git add package.json package-lock.json
git commit -m "chore: release v$NEW_VERSION"

echo "🏷️  Tagging v$NEW_VERSION..."
git tag -a "v$NEW_VERSION" -m "v$NEW_VERSION"

echo "🚀 Pushing to origin..."
git push origin master
git push origin "v$NEW_VERSION"

echo "📤 Publishing to npm..."
npm publish --ignore-scripts  # skip prepublishOnly since we already tested

echo "✅ Released v$NEW_VERSION"
