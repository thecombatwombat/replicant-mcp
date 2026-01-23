#!/bin/bash
set -e

# Usage: ./scripts/release.sh [patch|minor|major]
# Default: patch

VERSION_TYPE=${1:-patch}

if [[ ! "$VERSION_TYPE" =~ ^(patch|minor|major)$ ]]; then
  echo "Usage: $0 [patch|minor|major]"
  exit 1
fi

echo "📋 Running tests..."
npm test -- --run

echo "📦 Bumping $VERSION_TYPE version..."
NEW_VERSION=$(npm version $VERSION_TYPE --no-git-tag-version | tr -d 'v')
echo "   New version: $NEW_VERSION"

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
