# MCPB Desktop Extensions Submission Form — Answers for replicant-mcp

## Advisory Notes

- **Form URL:** https://forms.gle/tyiAZvch1kDADKoP9
- **Form title:** "MCPB Desktop Extensions Submission Form" (for local MCP servers only)
- **Requirements:** Publicly available on GitHub, MIT licensed, built with Node.js, valid `manifest.json` with author field
- **Known concern — Tool safety annotations:** `readOnlyHint`/`destructiveHint` annotations are not yet added. This is a common rejection cause. Review takes weeks, so annotations can be added before review completes.
- **`.mcpb` bundle location:** `/Users/architjoshi/code/claude/replicant-mcp/.worktrees/mcpb/replicant-mcp-1.6.0.mcpb` (2.9MB)
- **To rebuild:** `cd .worktrees/mcpb && mcpb pack . replicant-mcp.mcpb`

---

## Form Fields

### 1. Is this an update to an existing extension?

```
No
```

### 2. Primary Contact Name (required, pre-filled)

```
Archit Joshi
```

### 3. Primary Contact Email (required, pre-filled)

```
archit.joshi@gmail.com
```

### 4. MCP Server Description (required, 50 words max)

```
Android MCP server for AI-assisted development. 14 tools for building APKs via Gradle, managing emulators, installing apps, automating UI through accessibility services, and analyzing device logs. All operations run locally against the user's Android SDK — no cloud accounts or API keys needed.
```

> 42 words — under the 50-word limit.

### 5. Desktop Extension GitHub Link (required, pre-filled)

```
https://github.com/thecombatwombat/replicant-mcp
```

### 6. Primary Party Confirmation (required)

```
No
```

> replicant-mcp is an independent open-source tool, not built by Google/Android. Select "No" — this is a third-party MCP server that interfaces with the Android SDK.

### 7. Please attach your .mcpb file (required)

Upload: `replicant-mcp-1.6.0.mcpb`

**File location:** `/Users/architjoshi/code/claude/replicant-mcp/.worktrees/mcpb/replicant-mcp-1.6.0.mcpb`

### 8. Do you agree to our MCP Directory Terms & Conditions? (required)

```
[x] I have read, and agree to, the MCP Directory Terms & Conditions
```

> Terms: https://support.anthropic.com/en/articles/11697081-anthropic-mcp-directory-terms-and-conditions

### 9. Feedback (optional)

```
replicant-mcp is the first Android-focused MCP server. Would love to see more mobile development tooling in the Desktop Extensions directory. Happy to help with any questions during review.
```
