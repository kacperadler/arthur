# AR0531 - Findings

Notes from the review of AR0531, settled at the merge.

## F1. `doctor.md` overstates the escaped `.gitignore` line

- Kind: docs
- Found by: 2026-10-28-review-1061df4f (reviewer), 2026-10-28
- Where: `packages/core/docs/commands/doctor.md:32`
- What: the doc says the escaped line "names the file and nothing else", but `*` and `?` are not escaped, so a name like `e?v` also ignores `eXv`. The file itself is still ignored.
- Status: deferred (client summary)

## F2. The line budget was met by packing the quoting helper into a one-line getter

- Kind: refactor
- Found by: 2026-10-28-review-1061df4f (reviewer), 2026-10-28
- Where: `packages/core/src/requirements.ts:101,111`
- What: the `fix` getter line is about 450 characters; a recorded budget raise would have read better.
- Status: dropped (within the budget and the file's own one-line getter style)

## F3. `git rm --cached` takes the name as a pathspec

- Kind: fix
- Found by: 2026-10-28-review-1061df4f (reviewer), 2026-10-28
- Where: `packages/core/src/requirements.ts`
- What: checked with real Git on `e[nv]` beside `en` and `e*v` beside `eXv`: only the literal file was untracked each time.
- Status: dropped (checked: no other file is untracked)

## F4. The leading newline of the `.gitignore` fix is pinned only by the exact printed text

- Kind: test
- Found by: 2026-10-28-review-1061df4f (reviewer), 2026-10-28
- Where: `packages/core/test/doctor.test.ts`
- What: no test runs the fix on a `.gitignore` without a final newline; the reviewer checked it by hand.
- Status: dropped (the exact-text row catches its removal)
