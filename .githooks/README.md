# Git Hooks

Custom git hooks for enforcing workflow standards.

## Setup

Run once per clone:

```bash
git config core.hooksPath .githooks
```

To verify it's configured:

```bash
git config --get core.hooksPath
# Should output: .githooks
```

## Hooks

### pre-push

Blocks direct pushes to master/main branches and warns about non-standard branch names.

**Blocked:**
- Pushing to master/main (except release commits matching `chore: release v*`)

**Warnings (not blocked):**
- Branch names not matching standard prefixes: `feature/`, `fix/`, `docs/`, `refactor/`, `chore/`, `trivial/`

**Release exception:**
Commits with message `chore: release v1.2.3` (or similar version) are allowed to push to master. This supports the automated release workflow.

## Testing

```bash
# Test master block
git checkout master
echo "test" >> README.md
git commit -m "test: trigger hook"
git push origin master
# Expected: Blocked with error message

# Test release exception
git commit --amend -m "chore: release v1.0.0"
git push origin master
# Expected: Allowed with success message

# Test branch naming warning
git checkout -b my-random-branch
git push origin my-random-branch
# Expected: Warning but allows push
```
