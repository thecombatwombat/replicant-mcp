# Automated npm Release from GitHub

## Overview

Automate npm publishing via GitHub Actions, triggered by git tags. Removes manual `npm publish` steps and ensures consistent releases.

## Decisions

| Decision | Choice |
|----------|--------|
| Trigger | Git tags (`v*`) |
| Version source | Tag (extracts version from `v1.2.3`) |
| GitHub Release | Yes, with auto-generated release notes |
| Prerelease support | No (can add later if needed) |
| Required secret | `NPM_TOKEN` |

## Workflow

**File: `.github/workflows/release.yml`**

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write  # For creating GitHub releases

    steps:
      - name: Validate tag format
        run: |
          TAG=${GITHUB_REF#refs/tags/v}
          if [[ ! "$TAG" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
            echo "Invalid tag format: $TAG (expected: X.Y.Z)"
            exit 1
          fi
          echo "VERSION=$TAG" >> $GITHUB_ENV

      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20.x'
          cache: 'npm'
          registry-url: 'https://registry.npmjs.org'

      - run: npm ci
      - run: npm run lint --if-present
      - run: npm run build
      - run: npm test -- --run

      - name: Update package.json version
        run: npm version ${{ env.VERSION }} --no-git-tag-version

      - name: Publish to npm
        run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          generate_release_notes: true
```

### Flow

1. Push tag `v1.2.3`
2. Workflow validates tag format (must be `X.Y.Z`)
3. Runs full test suite (lint, build, tests)
4. Updates `package.json` to match tag version
5. Publishes to npm
6. Creates GitHub Release with auto-generated notes from commits

### Failure Handling

- Invalid tag format → fails immediately
- Tests fail → nothing published
- npm publish fails → no GitHub Release (can retry by re-pushing tag after fixing)

## Usage

**Release a new version:**
```bash
git tag v1.2.0
git push origin v1.2.0
```

**Check current version:**
```bash
git describe --tags --abbrev=0
```

## One-Time Setup

### Create npm Token

1. Go to [npmjs.com](https://www.npmjs.com) → Access Tokens
2. Generate New Token → **Classic Token** → **Automation** type
3. Copy the token

### Add GitHub Secret

1. GitHub Repository → Settings → Secrets and variables → Actions
2. New repository secret
3. Name: `NPM_TOKEN`
4. Value: paste the npm token

## Future Enhancements (if needed)

- **Prerelease support**: Tags like `v1.2.3-beta.1` publish to npm's `beta` tag
- **Changelog generation**: Use conventional commits to auto-generate detailed changelogs
- **Slack/Discord notifications**: Alert on successful/failed releases
