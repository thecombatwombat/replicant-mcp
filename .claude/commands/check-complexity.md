---
allowed-tools: Bash
description: Run code complexity checks on the codebase
---

Run the complexity checker script and present the results.

```bash
chmod +x scripts/check-complexity.sh && ./scripts/check-complexity.sh
```

If violations are found, list them clearly and suggest specific fixes for each.
If no violations, confirm the codebase is clean.
