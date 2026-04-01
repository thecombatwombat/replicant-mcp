# Phase 4: Verification - Research

**Researched:** 2026-03-26
**Domain:** Marketplace listing verification across 7 distribution channels
**Confidence:** HIGH

## Summary

Phase 4 verifies that every marketplace listing from Phases 1-3 is live and correct (or confirmed submitted for those with external review queues). This phase is primarily about verification commands and web checks -- no code changes are needed.

There are three categories of verification: (1) programmatically verifiable listings (MCP Registry, Glama) where API/HTTP checks confirm live status and metadata accuracy, (2) web-verifiable listings (Smithery, awesome-mcp-servers/mcpservers.org) where browser-based checks confirm presence and content, and (3) submission-confirmed listings (Anthropic MCPB Desktop Extensions, Cursor) where the requirement is simply "confirmed submitted" since review timelines are external and unknown.

A critical finding: VER-06 (Claude Code Plugin Directory) references a form submission (FORM-02) that was deferred to v2 during Phase 2 execution. FORM-02 requires building an actual Claude Code plugin, not just a form. The planner must mark VER-06 as N/A (deferred) or verify only that the deferral is documented.

**Primary recommendation:** Execute all verification checks in a single plan. Group by verification type: automated CLI/API checks first (MCP Registry, Glama), then user-assisted browser checks (Smithery, awesome-mcp-servers/mcpservers.org), then submission confirmations (Anthropic MCPB, Cursor). Mark VER-06 as deferred to match FORM-02 deferral.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VER-01 | MCP Registry listing returns correct metadata via API query | Registry API confirmed working: `GET https://registry.modelcontextprotocol.io/v0.1/servers?search=replicant-mcp` returns active listing with name, version 1.6.1, npm transport. Already verified during Phase 3 -- re-verify for freshness. |
| VER-02 | Smithery listing appears in search with accurate description | Smithery listing expected at `https://smithery.ai/server/@replicant-co/replicant-mcp`. Smithery API at `https://api.smithery.ai/servers?q=replicant-mcp` requires API key (Bearer token). Browser check is the fallback if API returns 429. Phase 3 verification hit 429 rate limit. |
| VER-03 | Glama listing shows at expected URL with correct tool list | Glama listing confirmed live at `https://glama.ai/mcp/servers/thecombatwombat/replicant-mcp` (HTTP 200). Shows 12 tools, MIT license, correct description. Already verified during Phase 3. |
| VER-04 | awesome-mcp-servers entry visible on GitHub and mcpservers.org | PR #3919 was opened against punkpeye/awesome-mcp-servers. Need to check merge status. mcpservers.org is the web frontend synced from the GitHub repo -- entry appears there only after PR merge. GitHub API access to punkpeye/awesome-mcp-servers returns 404 (possibly restricted); browser verification required. |
| VER-05 | Anthropic Connectors form submitted (review timing is external) | MCPB Desktop Extensions form submitted during Phase 2 with .mcpb bundle. No status tracking mechanism exists -- Anthropic says "we'll reach out if your MCP would be a good fit." Verification = confirm form was submitted (Phase 2 summary documents this). |
| VER-06 | Claude Code Plugin Directory form submitted (review timing is external) | DEFERRED -- FORM-02 was deferred to v2 during Phase 2 because it requires building an actual Claude Code plugin (not just a form). VER-06 should be marked N/A or "deferred per FORM-02 deferral." |
| VER-07 | Cursor plugin submitted for review (review timing is external) | Submitted during Phase 3 via cursor.com/marketplace/publish. Not yet visible in marketplace (manual review pending). No public API or dashboard for status. Verification = confirm submission was made (Phase 3 summary documents this). Contact hello@cursor.com for status if needed. |
</phase_requirements>

## Standard Stack

### Core
| Tool | Purpose | Why Standard |
|------|---------|--------------|
| `curl` + `jq` | MCP Registry and Glama API/HTTP verification | Standard CLI tools for HTTP checks, already used in Phase 3 verification |
| Web browser | Smithery, awesome-mcp-servers, mcpservers.org visual checks | Required for listings that rate-limit API access or lack public APIs |
| `gh` CLI | Check awesome-mcp-servers PR merge status (if accessible) | Already authenticated as thecombatwombat |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| `npm view` | Verify npm package metadata matches registry listings | Cross-check version, mcpName field |
| Phase 2/3 SUMMARY.md files | Evidence for submission-based verifications (VER-05, VER-07) | When confirming that forms were submitted |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Browser check for Smithery | Smithery API with Bearer token | Requires creating API key at smithery.ai/account/api-keys; overkill for one-time verification |
| Manual mcpservers.org check | Scraping mcpservers.org | Fragile, unnecessary for a one-time check |

## Architecture Patterns

### Verification Execution Order
```
1. Automated CLI checks (can run without user)
   |-- VER-01: MCP Registry API query
   |-- VER-03: Glama HTTP check + content verification
   |-- npm view cross-check
   |
2. User-assisted browser checks (need user to open URLs)
   |-- VER-02: Smithery listing at smithery.ai
   |-- VER-04: awesome-mcp-servers PR status + mcpservers.org
   |
3. Submission confirmations (document-based, no live check possible)
   |-- VER-05: MCPB form submitted (reference Phase 2 summary)
   |-- VER-06: DEFERRED (FORM-02 deferred to v2)
   |-- VER-07: Cursor submitted (reference Phase 3 summary)
```

### Pattern 1: API-Based Verification (VER-01)
**What:** Query MCP Registry API and validate response fields match expected values.
**When to use:** VER-01 (MCP Registry).
**Example:**
```bash
# Query the registry
curl -s "https://registry.modelcontextprotocol.io/v0.1/servers?search=replicant-mcp" | jq '.'

# Verify specific fields
curl -s "https://registry.modelcontextprotocol.io/v0.1/servers?search=replicant-mcp" | jq '{
  name: .servers[0].server.name,
  version: .servers[0].server.version,
  description: .servers[0].server.description,
  npm_package: .servers[0].server.packages[0].identifier,
  transport: .servers[0].server.packages[0].transport.type,
  status: .servers[0]._meta["io.modelcontextprotocol.registry/official"].status
}'
# Expected:
# name: "io.github.thecombatwombat/replicant-mcp"
# version: "1.6.1"
# description: "Android MCP server for AI-assisted development. Build, test, emulate, and automate."
# npm_package: "replicant-mcp"
# transport: "stdio"
# status: "active"
```
Source: [MCP Registry API docs](https://registry.modelcontextprotocol.io/docs), verified 2026-03-26

### Pattern 2: HTTP Status + Content Verification (VER-03)
**What:** Confirm URL returns HTTP 200 and page content matches expected tool list.
**When to use:** VER-03 (Glama).
**Example:**
```bash
# HTTP status check
curl -sL "https://glama.ai/mcp/servers/thecombatwombat/replicant-mcp" -o /dev/null -w "%{http_code}"
# Expected: 200

# Content verification (tools listed on page)
# Expected 12 tools: adb-app, adb-device, adb-logcat, adb-shell, cache,
#   emulator-device, gradle-build, gradle-get-details, gradle-list,
#   gradle-test, rtfm, ui
```
Source: Direct verification during this research session

### Pattern 3: Browser-Based Verification (VER-02, VER-04)
**What:** User opens URLs in browser and confirms listing content.
**When to use:** VER-02 (Smithery), VER-04 (awesome-mcp-servers/mcpservers.org).
**Verification URLs:**
- Smithery: `https://smithery.ai/server/@replicant-co/replicant-mcp`
- awesome-mcp-servers GitHub: Check PR #3919 merge status at the upstream repo
- mcpservers.org: `https://mcpservers.org` then search for "replicant-mcp"

### Pattern 4: Document-Based Confirmation (VER-05, VER-07)
**What:** Reference Phase 2/3 SUMMARY.md files as evidence that submissions were made.
**When to use:** VER-05 (Anthropic MCPB), VER-07 (Cursor).
**Evidence paths:**
- VER-05: `.planning/phases/02-form-submissions/02-01-SUMMARY.md` confirms MCPB form submitted
- VER-07: `.planning/phases/03-registry-publishing/03-02-SUMMARY.md` confirms Cursor submission

### Anti-Patterns to Avoid
- **Treating "not listed yet" as failure for externally reviewed marketplaces:** VER-05, VER-06, VER-07 explicitly accept "submitted, pending review." Do not fail verification because a listing is not yet live.
- **Retrying Smithery API when rate-limited:** Smithery returns 429 aggressively. Fall back to browser verification immediately rather than retrying.
- **Assuming GitHub API access to punkpeye/awesome-mcp-servers:** The repo returns 404 via API (likely access restrictions). Use browser-based verification or check the fork's upstream status.
- **Attempting to verify VER-06:** FORM-02 was deferred. Do not try to check the Claude Code Plugin Directory for a submission that was never made.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| MCP Registry verification | Custom scraper | `curl` + `jq` against official API | API is stable, documented, returns structured JSON |
| Glama verification | Web scraper | `curl -w "%{http_code}"` for status + browser for content | HTTP status confirms liveness; visual inspection confirms content |
| Submission status tracking | Polling scripts | Phase SUMMARY.md files as evidence | No APIs exist for Anthropic MCPB or Cursor submission status |

**Key insight:** This phase involves zero code changes. The work is executing verification commands, having the user check browser URLs, and documenting results. The planner should structure tasks as a verification checklist, not a build sequence.

## Common Pitfalls

### Pitfall 1: awesome-mcp-servers PR Not Yet Merged
**What goes wrong:** PR #3919 may still be open (community repo, external maintainer). VER-04 requires the entry to be visible on GitHub README and mcpservers.org.
**Why it happens:** punkpeye/awesome-mcp-servers receives many PRs; merge timing is unpredictable.
**How to avoid:** Check PR status first. If still open, VER-04 should be marked "submitted, pending merge" (analogous to VER-05/VER-07 for externally reviewed items). mcpservers.org syncs from the repo, so it will only show the entry after merge.
**Warning signs:** PR #3919 still shows "Open" state; mcpservers.org search returns no results for replicant-mcp.

### Pitfall 2: Smithery 429 Rate Limiting
**What goes wrong:** Programmatic check of Smithery returns 429, unable to verify listing.
**Why it happens:** Smithery aggressively rate-limits API/web requests. Phase 3 verification encountered this same issue.
**How to avoid:** Have the user open `https://smithery.ai/server/@replicant-co/replicant-mcp` directly in a browser. Browser access with session cookies is not rate-limited the same way.
**Warning signs:** curl/WebFetch returns HTTP 429.

### Pitfall 3: VER-06 Confusion (Deferred Requirement)
**What goes wrong:** Attempting to verify Claude Code Plugin Directory submission when FORM-02 was deferred.
**Why it happens:** VER-06 still appears in REQUIREMENTS.md as pending, but its prerequisite (FORM-02) was deferred to v2.
**How to avoid:** Mark VER-06 as "N/A - deferred per FORM-02 deferral to v2." Update REQUIREMENTS.md accordingly.
**Warning signs:** Trying to find a Plugin Directory listing that was never submitted.

### Pitfall 4: Stale Registry Data
**What goes wrong:** MCP Registry or Glama data does not match latest npm version.
**Why it happens:** MCP Registry is in preview with no data durability guarantees. Glama auto-indexes periodically.
**How to avoid:** Cross-check `npm view replicant-mcp version` against registry listings. If versions mismatch, note it but don't fail verification (the listing exists, just may lag behind npm).
**Warning signs:** Registry shows version different from `npm view` output.

### Pitfall 5: GitHub API Access Restrictions
**What goes wrong:** `gh api repos/punkpeye/awesome-mcp-servers/pulls/3919` returns 404.
**Why it happens:** The repo may have access restrictions or the authenticated token lacks permissions. During this research, both authenticated and unauthenticated API calls returned 404, even though the fork identifies it as parent.
**How to avoid:** Use browser-based verification. Direct the user to check the PR URL or search mcpservers.org.
**Warning signs:** All GitHub API calls to punkpeye/awesome-mcp-servers return 404.

## Code Examples

### Complete VER-01 Verification Script
```bash
# MCP Registry verification
echo "=== VER-01: MCP Registry ==="
RESULT=$(curl -s "https://registry.modelcontextprotocol.io/v0.1/servers?search=replicant-mcp")
echo "$RESULT" | jq '{
  name: .servers[0].server.name,
  version: .servers[0].server.version,
  description: .servers[0].server.description,
  npm_package: .servers[0].server.packages[0].identifier,
  transport: .servers[0].server.packages[0].transport.type,
  status: .servers[0]._meta["io.modelcontextprotocol.registry/official"].status,
  published_at: .servers[0]._meta["io.modelcontextprotocol.registry/official"].publishedAt,
  count: .metadata.count
}'

# Cross-check with npm
echo ""
echo "=== npm cross-check ==="
echo "npm version: $(npm view replicant-mcp version)"
echo "npm mcpName: $(npm view replicant-mcp mcpName)"
```

### Complete VER-03 Verification Script
```bash
# Glama verification
echo "=== VER-03: Glama ==="
HTTP_STATUS=$(curl -sL "https://glama.ai/mcp/servers/thecombatwombat/replicant-mcp" -o /dev/null -w "%{http_code}")
echo "HTTP Status: $HTTP_STATUS"
if [ "$HTTP_STATUS" = "200" ]; then
  echo "PASS: Glama listing is live"
else
  echo "FAIL: Expected 200, got $HTTP_STATUS"
fi
```

### VER-04 PR Status Check (Browser Fallback)
```bash
# Try GitHub API first (may return 404 due to access restrictions)
echo "=== VER-04: awesome-mcp-servers PR ==="
gh api repos/punkpeye/awesome-mcp-servers/pulls/3919 --jq '{state: .state, merged: .merged}' 2>/dev/null || \
  echo "API inaccessible -- check PR status in browser"
echo ""
echo "Browser URLs to check:"
echo "  - PR: https://github.com/punkpeye/awesome-mcp-servers/pull/3919"
echo "  - mcpservers.org: https://mcpservers.org (search for replicant-mcp)"
```

### Verification Summary Template
```markdown
| VER ID | Marketplace | Status | Evidence |
|--------|-------------|--------|----------|
| VER-01 | MCP Registry | PASS/FAIL | API returns {name}, version {X}, status {Y} |
| VER-02 | Smithery | PASS/PENDING | Listing at smithery.ai shows {description} |
| VER-03 | Glama | PASS/FAIL | HTTP {code}, {N} tools listed |
| VER-04 | awesome-mcp-servers | PASS/PENDING | PR #{N} {merged/open}, mcpservers.org {found/not found} |
| VER-05 | Anthropic MCPB | CONFIRMED SUBMITTED | Phase 2 summary documents submission |
| VER-06 | Claude Code Plugin Dir | N/A (DEFERRED) | FORM-02 deferred to v2 |
| VER-07 | Cursor Marketplace | CONFIRMED SUBMITTED | Phase 3 summary documents submission |
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| MCP Registry had no API | MCP Registry has REST API at v0.1 | Sept 2025 (preview launch) | Enables programmatic verification of listings |
| Smithery had open API | Smithery requires API key + aggressively rate-limits | 2025-2026 | Browser-based verification is more reliable for one-time checks |
| awesome-mcp-servers at wong2/ | awesome-mcp-servers at punkpeye/ with mcpservers.org web frontend | 2025 | mcpservers.org is the canonical web view of the repo |
| Anthropic Connectors form | MCPB Desktop Extensions form with .mcpb bundle | Late 2025 | Submission process changed during Phase 2 execution |

**Deprecated/outdated:**
- VER-06 as written in REQUIREMENTS.md is outdated -- its prerequisite FORM-02 was deferred to v2. Verification cannot be completed for an unsubmitted form.

## Open Questions

1. **awesome-mcp-servers PR #3919 merge status**
   - What we know: PR was opened during Phase 1 (2026-03-25). GitHub API returns 404 for punkpeye/awesome-mcp-servers.
   - What's unclear: Whether the PR has been merged, is still open, or was closed. The repo API is inaccessible programmatically.
   - Recommendation: Have user check in browser. If not merged, mark VER-04 as "submitted, pending merge" -- same treatment as externally reviewed listings.

2. **Smithery listing verification method**
   - What we know: Phase 3 verification got 429 from Smithery. This research also got 429. The CLI publish succeeded.
   - What's unclear: Whether the listing is actually live and findable by users.
   - Recommendation: User opens `https://smithery.ai/server/@replicant-co/replicant-mcp` in browser. If 404, try searching "replicant-mcp" on smithery.ai. Alternative: create Smithery API key and query `https://api.smithery.ai/servers?q=replicant-mcp`.

3. **VER-06 disposition**
   - What we know: FORM-02 was deferred to v2. VER-06 still listed as pending in REQUIREMENTS.md.
   - What's unclear: Should VER-06 be marked N/A, deferred, or removed?
   - Recommendation: Mark as "N/A - deferred per FORM-02 deferral." Update REQUIREMENTS.md to match.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (project test suite) |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test -- --run` |
| Full suite command | `npm run test:coverage` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VER-01 | MCP Registry returns correct metadata | smoke | `curl -s "https://registry.modelcontextprotocol.io/v0.1/servers?search=replicant-mcp" \| jq '.servers[0].server.name'` | N/A (external service) |
| VER-02 | Smithery listing visible | manual-only | Browser: `https://smithery.ai/server/@replicant-co/replicant-mcp` | N/A (web UI) |
| VER-03 | Glama listing at correct URL with tools | smoke | `curl -sL "https://glama.ai/mcp/servers/thecombatwombat/replicant-mcp" -o /dev/null -w "%{http_code}"` | N/A (external service) |
| VER-04 | awesome-mcp-servers entry visible | manual-only | Browser: PR status + mcpservers.org search | N/A (external repo) |
| VER-05 | MCPB form submitted | manual-only | Reference Phase 2 SUMMARY.md | N/A (document evidence) |
| VER-06 | Claude Code Plugin Dir submitted | N/A | DEFERRED -- FORM-02 deferred to v2 | N/A |
| VER-07 | Cursor plugin submitted | manual-only | Reference Phase 3 SUMMARY.md | N/A (document evidence) |

### Sampling Rate
- **Per task:** Run all automated smoke checks (VER-01, VER-03) after each browser verification
- **Phase gate:** All VER-0X items resolved (PASS, CONFIRMED SUBMITTED, PENDING EXTERNAL, or N/A)

### Wave 0 Gaps
None -- this phase involves no code changes and no test infrastructure. Verification is done via external API calls, browser checks, and document references.

## Sources

### Primary (HIGH confidence)
- [MCP Registry API](https://registry.modelcontextprotocol.io/docs) - Full API reference, verified during research with live query returning replicant-mcp listing
- [MCP Registry API Reference (GitHub)](https://github.com/modelcontextprotocol/registry/blob/main/docs/reference/api/official-registry-api.md) - Endpoint documentation, query parameters, response format
- Glama listing - Direct HTTP 200 verification at `https://glama.ai/mcp/servers/thecombatwombat/replicant-mcp` confirmed live with 12 tools
- Phase 2 SUMMARY (`02-01-SUMMARY.md`) - Documents MCPB form submission completion
- Phase 3 SUMMARY (`03-02-SUMMARY.md`) - Documents Smithery publish and Cursor submission completion
- Phase 3 VERIFICATION (`03-VERIFICATION.md`) - Documents MCP Registry and Glama as verified, Smithery and Cursor as needing human confirmation

### Secondary (MEDIUM confidence)
- [Smithery Search API docs](https://smithery.ai/docs/concepts/registry_search_servers) - API endpoint `GET https://api.smithery.ai/servers?q=...` with Bearer token auth
- [Anthropic Connectors FAQ](https://support.claude.com/en/articles/11596036-anthropic-connectors-directory-faq) - Confirms no status tracking, no review SLA
- [MCPB Submission Guide](https://support.claude.com/en/articles/12922832-local-mcp-server-submission-guide) - Confirms no post-submission tracking
- [Cursor forum: plugin review](https://forum.cursor.com/t/pending-review-azure-cosmos-db-plugin-submission/153515) - Confirms no review dashboard, contact hello@cursor.com for status

### Tertiary (LOW confidence)
- awesome-mcp-servers PR #3919 status - Cannot be verified via GitHub API (repo returns 404). Needs browser check. LOW confidence on whether merged.
- mcpservers.org replicant-mcp entry - Web search found no indexed entry. May not exist yet (dependent on PR merge). LOW confidence.
- Smithery listing live status - CLI publish reported success but HTTP checks return 429. LOW confidence on live status until browser verification.

## Metadata

**Confidence breakdown:**
- VER-01 (MCP Registry): HIGH - API query works, returns correct data, verified during this research
- VER-02 (Smithery): MEDIUM - CLI publish succeeded per Phase 3, but 429 rate limiting blocks automated verification
- VER-03 (Glama): HIGH - HTTP 200 confirmed, 12 tools visible, content matches expectations
- VER-04 (awesome-mcp-servers): LOW - GitHub API inaccessible, PR merge status unknown
- VER-05 (Anthropic MCPB): HIGH - Form submission documented in Phase 2 summary
- VER-06 (Claude Code Plugin Dir): HIGH (on deferral) - FORM-02 explicitly deferred to v2
- VER-07 (Cursor): HIGH (on submission) - Submission documented in Phase 3 summary

**Research date:** 2026-03-26
**Valid until:** 2026-04-02 (verification is point-in-time; listings could change, but verification methodology is stable)
