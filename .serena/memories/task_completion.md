# Task Completion Checklist

## Before Committing Code

1. **Build passes**
   ```bash
   npm run build
   ```

2. **Tests pass**
   ```bash
   npm run validate   # Combines build + all tests
   ```

3. **No TypeScript errors** (covered by build)

## Pull Request Requirements

- **No direct pushes to master** - all changes via PR
- **Branch naming**: Use appropriate prefix (`feature/`, `fix/`, `docs/`, `refactor/`, `chore/`)
- **Conventional commits**: Use prefixes (`feat:`, `fix:`, etc.)

## Documentation Updates

When completing features, check if these need updating:
- `README.md` - Current Features table and Future Roadmap
- `CLAUDE.md` - If workflow or patterns change
- `.github/roadmap-mapping.yml` - For new roadmap items

## Feature Completion

When moving a feature from "Planned" to "Complete":
1. Move from Future Roadmap table to Current Features table in README.md
2. Update status in roadmap-mapping.yml if applicable
