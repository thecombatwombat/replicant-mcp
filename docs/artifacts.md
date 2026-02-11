# Artifacts and Local Storage

replicant-mcp stores working files in a `.replicant/` directory within your current working directory. This document explains what's stored, privacy considerations, and how to clean up.

## Directory Structure

```
.replicant/
  screenshots/    # Screenshots captured by ui screenshot, ui dump, etc.
  cache/          # Cached tool responses (used by the cache tool)
  baselines/      # Test baselines for visual comparisons
```

## Privacy Considerations

**Screenshots may contain sensitive data.** When replicant-mcp captures a screenshot of your device or emulator, it records whatever is currently displayed on screen. This can include:

- Personally identifiable information (PII) such as names, emails, phone numbers
- Credentials, tokens, or passwords visible in the UI
- Private app content (messages, photos, financial data)

Be mindful of this when sharing `.replicant/` contents, committing to version control, or using replicant-mcp in CI pipelines with shared artifact storage.

## .gitignore

The `.replicant/` directory is included in the project's `.gitignore` by default, so it will not be committed to version control. If you're using replicant-mcp in your own project, add the following to your `.gitignore`:

```gitignore
.replicant/
```

## Cleanup

There is no automatic retention policy. Files in `.replicant/` persist until you manually remove them. To clean up:

```bash
rm -rf .replicant/
```

This is safe to run at any time. The directory and its subdirectories are recreated automatically on the next operation that needs them.

## Retention

replicant-mcp does not automatically delete old screenshots, cache entries, or baselines. If disk usage is a concern (e.g., in CI environments), add a cleanup step to your pipeline or periodically run the removal command above.
