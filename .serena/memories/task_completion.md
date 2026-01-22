# Task Completion Checklist

## Before Committing

1. **Build passes**
   ```bash
   npm run build
   ```

2. **All tests pass**
   ```bash
   npm run validate   # Build + 216 tests
   ```

3. **No TypeScript errors** (covered by build)

## Pull Request Requirements

- All changes via PR (no direct pushes to master)
- Use conventional commit messages
- Branch naming: `<prefix>/<short-description>`

## Documentation Updates

When completing features, update:

### README.md
- **Current Features** table - add completed features
- **Future Roadmap** table - update status or move to Current Features
- Status values: `Planned`, `In Progress`, `Future`

### .github/roadmap-mapping.yml
Add entries for new roadmap items so PR workflow detects completion.

### CLAUDE.md
Update if workflow patterns or key info changes.

## Feature Lifecycle

1. **Planning**: Add to Future Roadmap with status "Planned"
2. **In Progress**: Update status to "In Progress"
3. **Complete**: Move to Current Features table, remove from Future Roadmap

## Design Documents

Store design docs in `docs/plans/` with format:
```
YYYY-MM-DD-<topic>-design.md
```
