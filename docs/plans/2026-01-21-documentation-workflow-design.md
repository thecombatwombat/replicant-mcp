# Documentation Workflow for Roadmap Items

**Status:** Design complete
**Created:** 2026-01-21

## Problem Statement

Roadmap items get implemented but documentation doesn't get updated. The OCR fallback feature was completed and merged, but the README still lists it as "Planned" under Future Roadmap.

CLAUDE.md already has a rule about keeping the README in sync, but it wasn't followed. This is a process enforcement problem.

## Solution

Two-pronged approach:

1. **PR template checklist** - Human-facing reminder for all PRs
2. **Smart detection in `/pr-with-review`** - Automated check that prompts when roadmap-related files change

## Implementation

### 1. PR Template

**File:** `.github/PULL_REQUEST_TEMPLATE.md`

```markdown
## Summary
<!-- Brief description of changes -->

## Test Plan
<!-- How was this tested? -->

## Checklist
- [ ] Tests pass (`npm run validate`)
- [ ] If this completes a roadmap item: README.md "Future Roadmap" → "Current Features"
- [ ] If this adds new planned work: Added to README.md "Future Roadmap"
- [ ] Design doc status updated (if applicable)
```

### 2. Roadmap Mapping Config

**File:** `.github/roadmap-mapping.yml`

```yaml
# Maps file patterns to README roadmap items
# Update this when adding new roadmap items

mappings:
  - patterns:
      - src/services/ocr*
      - src/tools/ui*ocr*
    roadmapItem: OCR fallback for text search
    category: Visual Fallback

  - patterns:
      - src/services/video*
      - src/tools/video*
    roadmapItem: Start/stop recording
    category: Video Capture

  - patterns:
      - src/tools/gradle*
      - src/adapters/gradle*
    roadmapItem: Skill override for project-specific builds
    category: Custom Build Commands
```

**Maintenance rule:** When adding a new item to README's "Future Roadmap", also add a mapping entry here.

### 3. Skill Enhancement

**Where:** `/pr-with-review` skill

**Flow:**

1. Skill runs `git diff --name-only origin/master`
2. Load `.github/roadmap-mapping.yml`
3. For each mapping, glob-match changed files against patterns
4. If any match:
   - Check if README.md is in the diff with roadmap table changes
   - If README changed appropriately → continue silently
   - If README NOT changed → prompt user

**Prompt when roadmap item detected but README unchanged:**

```
This PR touches files related to: "OCR fallback for text search" (Visual Fallback)

If this completes the feature:
  → Move it from "Future Roadmap" to "Current Features" in README.md

Does this PR complete this roadmap item?
  1. Yes - I'll update README now
  2. No - this is partial work, roadmap status unchanged
  3. Already updated (I missed it in the diff)
```

**If user picks "Yes":**
- Skill offers to make the README edit automatically, or
- Pauses to let user make the edit, then continues

**Multiple matches:** Show all matched items in one prompt.

### Edge Cases

| Scenario | Behavior |
|----------|----------|
| Missing mapping file | Log warning, continue (non-blocking) |
| No pattern matches | Silent pass |
| Pattern matches but it's a bug fix | User selects "No - partial work" |
| README already updated | Skip prompt entirely |
| Design doc exists | Remind to update status to "Implemented" |

## Files to Create/Modify

| File | Action |
|------|--------|
| `.github/PULL_REQUEST_TEMPLATE.md` | Create |
| `.github/roadmap-mapping.yml` | Create |
| `/pr-with-review` skill | Enhance with mapping check |
| `CLAUDE.md` | Add reference to mapping file in Documentation Rules |

## Testing

- Manual testing during PR creation
- Verify prompt appears when touching mapped files without README changes
- Verify prompt is skipped when README is properly updated
