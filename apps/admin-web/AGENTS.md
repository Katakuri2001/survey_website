<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

## Repository rule: never commit package files

- **Never stage, commit, or push `package.json` or `package-lock.json`** — neither the root files nor any `apps/*/package.json` / `apps/*/package-lock.json`. Leave their changes local to this machine. (Owner instruction, recorded 2026-09-30.)
- When committing, stage files **explicitly by path** — never `git add -A` or `git add .`, so these files can't slip in.
- If a change genuinely *requires* updating them (adding a dependency, changing a script), **ask the owner first** — do not decide independently.
