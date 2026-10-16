# AR0040 - Review 1

- Job: 2026-10-16-review-ar0040-board-tran-c09342a5
- Branch: h/2026-10-16-ar0040-board-transient-f-e608af74
- Commit reviewed: 798fcdaedbb599260d7b22da56248180f2666c9a
- Verdict: PASS

## Final message

## Review

**Ticket compliance**: AR0040's Decisions explicitly record coordinator approval of `spec/.board/` with self-ignoring `.gitignore`, which is exactly what this diff implements. Done-means checks:
- Lock/temp files moved to `spec/.board/{build.json.lock,build.json.tmp,ticket.md.tmp}`, same filesystem as the board (`join(where.path, TRANSIENT)`), rename stays atomic.
- `transientFolder` repairs `.gitignore` to `*\n` whenever missing or ≠ `*\n` — covers crash-emptied and hand-edited cases.
- `board-file.ts:writeBoard` takes `temporary` from the caller instead of deriving a pid-suffixed name; sole caller (`board.ts`) passes the new fixed path.
- `ticket.md.tmp` for new tickets also moved into `spec/.board/`, closing the second leak path named in the ticket's evidence.
- Docs (`packages/core/docs/commands/ticket.md`) updated to match the new lock/temp/gitignore behavior, as styleguide requires for a changed command doc.

**Verification performed in this worktree** (not the main checkout):
- `npm ci` — clean.
- `npm run check` (tsc) — no errors.
- `npm test` — 135/135 pass, including the two new tests (`the board's own folder gets its .gitignore back...`, `a writer killed mid-write leaves nothing Git shows, and the next write takes its lock over`) and the retained/updated `broken by hand` test.
- Mutation 1: changed `.gitignore` repair to `if (!existsSync(ignore)) writeFileSync(...)` (only-when-missing). Result: dedicated repair test fails (`✖ ... .gitignore back ...`), matching the worker's own claimed break #3. Crash test still passed (expected: file pre-exists there, so this particular mutation doesn't hit that path) — repair test alone catches it, which is sufficient.
- Mutation 2: reverted `ticket.md`'s temp path back to `join(where.path, `${path}.tmp`)` (old bug: temp beside the ticket in `spec/features/`). Result: crash test fails (`✖ a writer killed mid-write ...`), confirming the test would catch regression of exactly the second leak path the ticket names.
- Restored `board.ts` after each mutation via `git checkout -- packages/core/src/board.ts`; re-ran board tests (15/15 pass), confirmed `git status --porcelain` clean.
- Confirmed via `grep` that no other core module (`events.ts`, `run.ts`) writes transient files inside the project tree — only under `<home>`, out of ticket scope; `lock.ts`'s stray `<lock>.<pid>` guard file (worker's noted non-finding) now lands inside the ignored `spec/.board/` too, consistent with the claim.
- File sizes: `board.ts` 159 lines, `board-file.ts` 64 lines — within the 200-line budget; structure/boundary tests in the suite (no plugin-boundary violation, no runtime dep, no class/enum) all passed.
- Diff stat matches the worker's claimed `4 files, +95 −23`; worktree is clean, nothing outside the ticket's scope (`board.ts`, `board-file.ts`, their tests, and the one doc page) is touched.

**Notes (non-blocking)**
- Removing `{ flag: "wx" }` from `writeWhole` is deliberate and necessary now that temp names are fixed (a dead holder's leftover must be overwritten, not conflict); this is correctly exercised by the crash test's "takes the dead lock over" assertion.

No findings that block merge.

PASS
