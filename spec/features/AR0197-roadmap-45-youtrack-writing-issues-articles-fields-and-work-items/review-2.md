# AR0197 - Review 2

- Job: 2026-10-19-review-ar0197-youtrack-42ad16b6
- Branch: h/2026-10-19-ar0197-youtrack-e4f38f0b
- Commit reviewed: 8e03ef49004a3e7c3d70814f2a8b6c8446ee9c8f
- Verdict: PASS

## Final message

Tree is clean, no stray changes.

**Findings:** None blocking.

**Notes (non-blocking):**
- `spec/build.json` still lists AR0195 as `"status": "planned"` after the commit that builds it; not flagged as a Done-means item by either ticket or instruction, and board-status edits in this repo's history run through separate `docs(board)`/`chore(board)` commits (likely the coordinator's job on actual merge).
- `--all` is parsed as a global flag anywhere in `args` (via `.filter`), not positionally after `list`; a literal text argument equal to `--all` (e.g. a work-item comment) would be silently stripped or trigger the usage refusal. Edge case outside ticket scope, not reachable through any documented path.

**Checks run (in this worktree, range `562931f..8e03ef4`):**
- `git diff`/`git show` of the merge commit `5d61807`: both sides' comment lines and `BUDGETS` entries (`youtrack: 361`, `commit-rules: 168`) kept; `test/structure.test.ts` conflict resolved correctly.
- `wc -l packages/youtrack/src/*.ts` → 363 total (matches claimed budget after AR0195's +2); `packages/commit-rules/src/*.ts` → 168 (matches main's budget).
- README mermaid block vs `arthur.mmd`: byte-identical (`diff` empty).
- `npm ci` → ok. `npm run check` → clean (tsc, no errors). `npm test` → 652/652 pass, 0 fail.
- Mutation 1: removed the `#Unresolved` filter from the query → exactly 1 test fails (`issue list shows the unresolved issues by default...`), matching the worker's claim.
- Mutation 2: removed the `all && kind/verb !== "issue list"` refusal clause → exactly 1 test fails (same test, the `--all` on other verbs assertions), matching the worker's claim.
- Reverted both mutations (`git checkout --`); tree clean.
- Docs: `packages/youtrack/docs/commands/youtrack.md` usage line, `issue list [--all]` description, and `tokenEnv` row ("reads and writes as") all updated consistently with the code.
- Confirmed `youtrackCommand` has a single caller (`youtrack.ts`), passing `args` through unchanged — no other integration point affected by the new flag.

PASS
