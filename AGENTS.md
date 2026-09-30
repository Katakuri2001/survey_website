# Repository rules

## Git / commits

- **Never stage, commit, or push `package.json` or `package-lock.json`** — neither the root files nor any `apps/*/package.json` / `apps/*/package-lock.json`. Leave their changes local to this machine. (Owner instruction, recorded 2026-09-30.)
- When committing, stage files **explicitly by path** — never `git add -A` or `git add .`, so these files can't slip in.
- If a change genuinely *requires* updating them (adding a dependency, changing a script), **ask the owner first** — do not decide independently.
- **Fetch and pull before every commit/push.** Run `git fetch origin`, then fast-forward with `git pull origin main` *before* staging — the owner merges PR branches into `main` frequently, so pulling first avoids conflicts and stale pushes. (Owner instruction, recorded 2026-10-01.)
