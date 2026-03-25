# Phase 2: Form Submissions - Research

**Researched:** 2026-03-25
**Domain:** Marketplace form submissions (Anthropic Connectors + Claude Code Plugin Directory)
**Confidence:** MEDIUM

## Summary

Phase 2 prepares form submission content for two Anthropic-run marketplaces: the Connectors Directory (for Claude.ai/Desktop users) and the Claude Code Plugin Directory (for Claude Code users). Both require manual user submission -- Claude prepares the answers, user fills the forms.

Critical finding: the Anthropic Connectors Directory now **requires tool safety annotations** (`readOnlyHint`/`destructiveHint`) on every tool, and replicant-mcp currently has NONE. This is the #1 rejection cause (30% of rejections per FAQ). The original plan doc did not account for this as a blocker. The form content can still be prepared, but the user should be aware that submission may be rejected until annotations are added.

The Claude Code Plugin Directory submission is more straightforward -- it accepts GitHub repos that function as plugins. replicant-mcp already works as a Claude Code plugin via direct install, though it lacks a `.claude-plugin/plugin.json` manifest file that the official directory may expect.

**Primary recommendation:** Prepare both form answer documents as planned, but flag the missing tool annotations as a prerequisite concern for Anthropic Connectors acceptance. The form can be submitted now (review takes weeks), giving time to add annotations before review completes.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FORM-01 | Anthropic Connectors Google Form answers prepared with description, prompts, and safety notes | Form URL verified, required fields documented, safety annotation gap identified, privacy policy requirement documented |
| FORM-02 | Claude Code Plugin Directory form answers prepared with description, features, and example prompts | Submission URLs verified (multiple options), plugin structure requirements documented, existing plugin compatibility confirmed |
</phase_requirements>

## Standard Stack

Not applicable -- this phase involves no code changes. The deliverables are prepared text documents and manual form submissions.

### Tools/Services Referenced
| Service | URL | Purpose |
|---------|-----|---------|
| Anthropic Connectors Form | `https://forms.gle/tyiAZvch1kDADKoP9` | Submission form for local MCP servers |
| Anthropic Connectors Form (alt) | `https://docs.google.com/forms/d/e/1FAIpQLSeafJF2NDI7oYx1r8o0ycivCSVLNq92Mpc1FPxMKSw1CzDkqA/viewform` | Same form, long URL (from original plan doc) |
| Claude Code Plugin Directory | `https://clau.de/plugin-directory-submission` | Plugin directory submission form |
| Claude Code Plugin Directory (alt) | `https://claude.ai/settings/plugins/submit` | Alternative submission path (from official docs) |
| Claude Code Plugin Directory (alt) | `https://platform.claude.com/plugins/submit` | Another alternative submission path |

## Architecture Patterns

### Form 1: Anthropic Connectors Directory (FORM-01)

This is a Google Form submission for listing replicant-mcp in Claude.ai's Connectors panel (visible to all Claude Pro/Team/Enterprise users).

**Submission track:** Local MCP Server (not Remote) -- replicant-mcp requires local Android SDK.

**Required information (per official submission guide):**
1. Server name and description
2. GitHub URL and npm package name
3. Transport type (stdio)
4. Setup instructions
5. Minimum 3 working example prompts
6. Test credentials or testing notes (explain that reviewer needs Android SDK)
7. Tool count and categories
8. Privacy/data collection statement
9. Contact information
10. License

**Hard requirements from MCP Directory Policy:**
- Tool safety annotations (`readOnlyHint`, `destructiveHint`, `title`) on ALL tools -- **currently missing**
- Privacy policy in README.md (section exists referencing artifacts) -- **needs dedicated privacy section**
- Minimum 3 working examples with expected behavior documented
- Graceful error handling (already done via ReplicantError)
- Token-frugal responses (already done via progressive disclosure/cache IDs)
- Tool names under 64 characters (all compliant -- longest is `gradle-get-details` at 18 chars)

### Form 2: Claude Code Plugin Directory (FORM-02)

This is a form submission for listing replicant-mcp in the official Claude Code plugin directory (discoverable via `/plugin search`).

**Current state:** replicant-mcp already works as a Claude Code plugin via direct install (`/plugin install thecombatwombat/replicant-mcp`). It has `.claude/commands/` and an MCP server.

**Plugin structure status:**
- Has `.claude/commands/` with 6 skills -- YES
- Has MCP server entry point (`dist/index.js` via npx) -- YES
- Has README with installation docs -- YES
- Has MIT license -- YES
- Has `.claude-plugin/plugin.json` manifest -- **NO** (not created yet)

**Submission content needed:**
1. Plugin name
2. Repository URL
3. Description
4. Category
5. Key features list
6. Example prompts (minimum 3)
7. Prerequisites for users

### Anti-Patterns to Avoid
- **Submitting without annotations:** Will cause rejection/revision request for Connectors. Submit anyway (lead time is weeks), but plan to add annotations.
- **Over-promising example prompts:** Each prompt listed should actually work end-to-end. Don't list prompts for features that require specific project setup.
- **Ignoring privacy section:** The Connectors Directory explicitly checks for privacy policy. replicant-mcp doesn't send data externally, but this must be stated clearly.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tool annotations | Manual JSON in each tool file | MCP SDK `annotations` field on tool definitions | Standard MCP spec feature, supported since SDK 1.x |
| Privacy policy | Inline text in form only | Dedicated README section + link | Directory policy requires privacy info in README |
| Form content | Ad-hoc answers during submission | Pre-written document reviewed before submitting | Consistency, ability to iterate, reviewable artifact |

## Common Pitfalls

### Pitfall 1: Missing Tool Annotations (CRITICAL)
**What goes wrong:** Form submission accepted but review fails. Anthropic requests revisions. 30% of rejections are due to missing annotations.
**Why it happens:** Annotations were not in the original MCP spec when many servers were built. The requirement was added to the Directory Policy later.
**How to avoid:** Add `annotations` object to each of the 14 tool definitions before or shortly after form submission. The MCP SDK (^1.25.3 in use) supports the `annotations` field.
**Warning signs:** No `readOnlyHint` or `destructiveHint` in any tool definition file.

**Tool annotation mapping for replicant-mcp's 14 tools:**

| Tool | readOnlyHint | destructiveHint | Rationale |
|------|-------------|-----------------|-----------|
| cache (get-stats, get-config) | true | false | Read operations |
| cache (clear, set-config) | false | true | Modifies cache state |
| rtfm | true | false | Returns documentation only |
| adb-device (list, properties) | true | false | Read operations |
| adb-device (select, wait, health-check) | false | false | State change but not destructive |
| adb-app (list) | true | false | Read operation |
| adb-app (install, launch) | false | false | Additive, not destructive |
| adb-app (uninstall, stop, clear-data) | false | true | Destructive operations |
| adb-logcat | true | false | Read-only log access |
| adb-shell | false | true | Arbitrary command execution |
| emulator-device (list, snapshot list) | true | false | Read operations |
| emulator-device (create, start, stop) | false | false | State change, not destructive |
| emulator-device (wipe, delete) | false | true | Destructive operations |
| gradle-build | false | false | Creates artifacts, non-destructive |
| gradle-test | false | false | Runs tests, non-destructive |
| gradle-list | true | false | Read-only project introspection |
| gradle-get-details | true | false | Read cached build output |
| ui-query | true | false | Read UI tree |
| ui-action (tap, input, scroll) | false | false | UI interaction, not destructive |
| ui-capture | true | false | Screenshot capture, read-only |

**Note:** Since these tools use operation-based dispatch (single tool, multiple operations), the annotation must reflect the MOST permissive operation. For example, `adb-app` has both read-only (`list`) and destructive (`uninstall`) operations, so it should be annotated as `destructiveHint: true` at the tool level.

### Pitfall 2: Form URL Confusion
**What goes wrong:** Using outdated or wrong form URL.
**Why it happens:** Multiple URLs exist for both forms. The Connectors form has a Google Forms long URL and a short URL. The Plugin Directory has three different paths.
**How to avoid:** Use the canonical URLs from the official submission guides:
- Connectors: `https://forms.gle/tyiAZvch1kDADKoP9`
- Plugin Directory: `https://clau.de/plugin-directory-submission`

### Pitfall 3: Reviewers Can't Test
**What goes wrong:** Anthropic reviewer doesn't have Android SDK installed, can't verify the server works.
**Why it happens:** Most MCP servers connect to cloud APIs. replicant-mcp uniquely requires local Android development tools.
**How to avoid:** In the "testing account/sample data" field, explicitly state: "Reviewer needs Android SDK with adb and emulator in PATH. No cloud accounts needed. Consider using Android Studio's built-in emulator."

### Pitfall 4: Privacy Policy Gap
**What goes wrong:** Rejection because README lacks a Privacy Policy section.
**Why it happens:** replicant-mcp doesn't collect or transmit data, so a privacy section was never added.
**How to avoid:** Add a "Privacy" section to README stating: no data collection, no external network calls, all operations are local to the user's machine.
**Note:** Since replicant-mcp does NOT connect to remote services, the manifest.json `privacy_policies` URL is NOT required per the MCPB spec ("required when the extension connects to external services").

## Code Examples

### Tool Annotation Format (MCP SDK)
```typescript
// Source: https://modelcontextprotocol.io/legacy/concepts/tools + MCP SDK docs
export const adbLogcatToolDefinition = {
  name: "adb-logcat",
  description: "Read device logs. Returns summary with logId.",
  annotations: {
    title: "Read Device Logs",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  inputSchema: {
    // ... existing schema
  },
};
```

### Tool with Mixed Operations (most restrictive annotation)
```typescript
// Source: MCP spec guidance -- use most permissive hint for multi-op tools
export const adbAppToolDefinition = {
  name: "adb-app",
  description: "Manage applications.",
  annotations: {
    title: "Manage Applications",
    readOnlyHint: false,      // has write operations (install, uninstall)
    destructiveHint: true,     // uninstall, clear-data are destructive
    idempotentHint: false,     // operations have different effects
    openWorldHint: false,      // local device only
  },
  inputSchema: {
    // ... existing schema
  },
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No tool annotations | `readOnlyHint`/`destructiveHint` required | MCP spec 2025, enforced by Anthropic Directory 2026 | Must add annotations to all 14 tools |
| Any form URL | Specific submission guides per track | 2026 | Use Local MCP Server guide, not Remote |
| Plugin = just a repo | Plugin marketplace with `.claude-plugin/plugin.json` | Claude Code 1.0.33+ (2026) | May need manifest for official listing |
| Single submission path | Multiple submission forms (Connectors vs Plugin Directory) | 2026 | Two separate submissions for different audiences |
| `clau.de/plugin-directory-submission` only | Also `claude.ai/settings/plugins/submit` and `platform.claude.com/plugins/submit` | 2026 | Multiple valid submission paths |

## Key Facts About replicant-mcp (for form content)

These facts should be used when preparing form answers:

| Property | Value |
|----------|-------|
| Name | replicant-mcp |
| Version | 1.6.0 |
| npm package | `replicant-mcp` |
| GitHub | `thecombatwombat/replicant-mcp` |
| Author | Archit Joshi (thecombatwombat) |
| License | MIT |
| Transport | stdio |
| Runtime | Node.js 18+ |
| Tool count | 14 tools |
| Categories | ADB (4), Emulator (1), Gradle (4), UI (3), Cache (1), Docs (1) |
| Description | Android MCP server for AI-assisted Android development |
| Prerequisites | Node.js 18+, Android SDK with adb and emulator in PATH |
| Install command | `npx -y replicant-mcp` |

**14 Tools:**
1. `cache` - Manage response cache
2. `rtfm` - Get documentation
3. `adb-device` - Manage device connections
4. `adb-app` - Manage applications
5. `adb-logcat` - Read device logs
6. `adb-shell` - Execute shell commands
7. `emulator-device` - Manage Android emulators
8. `gradle-build` - Build APKs/bundles
9. `gradle-test` - Run tests
10. `gradle-list` - Introspect project structure
11. `gradle-get-details` - Fetch build/test output details
12. `ui-query` - Query app UI (accessibility-first)
13. `ui-action` - Interact with app UI (tap, input, scroll)
14. `ui-capture` - Capture screenshots

## Open Questions

1. **Does the Connectors Directory hard-require annotations at submission time, or at review time?**
   - What we know: Annotations are a "hard requirement" per the policy. 30% of rejections are due to missing annotations.
   - What's unclear: Whether the form itself rejects without annotations, or whether review catches it later.
   - Recommendation: Submit the form now (review takes weeks), add annotations in parallel. If review fails, resubmit after annotations are added. LOW risk since review cycle is long.

2. **Does the Claude Code Plugin Directory require `.claude-plugin/plugin.json`?**
   - What we know: The plugin works via direct install. The official docs show plugin.json as standard for distributable plugins. The directory at claude.com/plugins lists plugins that presumably have manifests.
   - What's unclear: Whether the submission form requires it or just the GitHub repo URL.
   - Recommendation: The form likely just needs the repo URL. The directory may auto-detect plugin structure. Submit without manifest first -- the review process will flag if it's needed.

3. **Are the two Connectors form URLs the same form?**
   - What we know: Plan doc uses the long Google Forms URL. Submission guide uses `https://forms.gle/tyiAZvch1kDADKoP9`.
   - What's unclear: Whether they resolve to the exact same form.
   - Recommendation: Use the short URL from the official guide (`forms.gle`) as the canonical source.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual verification (no automated tests for form submissions) |
| Config file | N/A |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FORM-01 | Anthropic Connectors form answers prepared and form submitted | manual-only | N/A -- human submits Google Form | N/A |
| FORM-02 | Claude Code Plugin Directory form answers prepared and form submitted | manual-only | N/A -- human submits web form | N/A |

**Manual-only justification:** Both requirements involve preparing text content and submitting web forms. There is no code to test. Validation is: (1) form content document exists and is complete, (2) user confirms form was submitted.

### Sampling Rate
- **Per task commit:** Visual review of prepared content document
- **Per wave merge:** N/A (no code changes)
- **Phase gate:** User confirmation that both forms were submitted

### Wave 0 Gaps
None -- no test infrastructure needed for manual form submissions.

## Sources

### Primary (HIGH confidence)
- [Local MCP Server Submission Guide](https://support.claude.com/en/articles/12922832-local-mcp-server-submission-guide) - Form URL, requirements, testing phases, annotation requirements
- [Anthropic Connectors Directory FAQ](https://support.claude.com/en/articles/11596036-anthropic-connectors-directory-faq) - Review process, annotation rejection stats, tool requirements
- [Anthropic Software Directory Policy](https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy) - Tool annotation mandate, privacy policy rules, error handling standards
- [Claude Code Plugins docs](https://code.claude.com/docs/en/plugins) - Plugin structure, submission URLs, manifest schema
- [Claude Plugins Directory](https://claude.com/plugins) - Plugin directory, submission CTA URL
- [MCPB Manifest Spec](https://github.com/anthropics/mcpb/blob/main/MANIFEST.md) - manifest.json schema, privacy_policies field requirements

### Secondary (MEDIUM confidence)
- [MCP Tool Annotations blog](https://blog.modelcontextprotocol.io/posts/2026-03-16-tool-annotations/) - How annotations are used by clients, best practices
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) - annotations field in tool definitions

### Tertiary (LOW confidence)
- Plan doc form URLs from `docs/plans/2026-03-13-marketplace-anthropic-connectors.md` - Need verification that Google Forms URLs still resolve
- `clau.de/plugin-directory-submission` redirect target - May change over time

## Metadata

**Confidence breakdown:**
- Form URLs: MEDIUM - Verified via official guides but URLs can change
- Anthropic Connectors requirements: HIGH - Directly from official submission guide and policy
- Claude Code Plugin Directory requirements: MEDIUM - Official docs describe structure but submission form specifics aren't fully documented
- Tool annotation mapping: HIGH - Based on actual tool source code analysis
- Privacy policy requirements: HIGH - Explicit in Directory Policy

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (form URLs and requirements may change; check before submission)
