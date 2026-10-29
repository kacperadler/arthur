# AR0534 - Review 1

- Job: 2026-10-28-review-f219a00b
- Branch: arthur/2026-10-28-worker-429e9ac1
- Commit reviewed: 0bf25b353470a810e02806f1a90e3b12893ff152
- Verdict: FAIL

## Final message

I found one blocking gap in the tests: the regex itself is correct, but a key part of it has no test.

**Findings**

1. `packages/delivery/test/review-needed.test.ts:106`: changing the backslash quantifier in `packages/delivery/src/review-needed.ts:15` from `\\*` to `\\?`, giving `/(?<![\w.]\\?)\.env\b/`, still passes all 7 tests. The `*` covers a regex written inside a string, such as `new RegExp("process\\.env\\.(\\w+)")`. That is a common way to write a regex on Node's env object, which is exactly what the ticket's Goal is about. I checked the shipped regex directly: it skips `RegExp("process\\.env")`, and the `\\?` mutation would flag it for review. The new row only uses a regex literal with one backslash, so the "any number of backslashes" part is untested. The review criteria count an uncaught mutation of a key behavior, like a limit moved, as a FAIL. Fix: add one row with the string form, for example `export const keys = new RegExp("process\\\\.env\\\\.(\\\\w+)", "g");` in the TS source, expecting `no review: …`.
2. `packages/delivery/src/review-needed.ts:15`: changing `[\w.]` to `\w`, giving `/(?<!\w\\*)\.env\b/`, also passes all 7 tests. No row puts a dot before the backslashes. The cases that depend on it are rare (`x.\.env`, `..env`), so this one only needs fixing if a row is being added anyway.

**Notes (not blocking)**

- Apart from that, the diff matches the ticket. The lookbehind is the same as in `packages/core/src/env-refusal.ts:13` (`(?<![\w.]\\*)`), the two rows are there, and nothing outside the ticket's scope changed. The worker's claims hold: 7 tests in the file, and reverting to `(?<!\w)` fails exactly 1 row.
- A capitalised name (`.ENV`) still doesn't match, because `DOT_ENV` has no `i` flag while the core's `NAME` does. This was already the case before the branch and is outside the ticket.
- The commit subject follows Conventional Commits with the `AR0534` scope, and the comment stays on one line. The delivery package's line budget holds: the structure test passed in the full run.

**Checks run**

- **`npm ci`:** exit 0.
- **`npm run check`:** exit 0, run twice.
- **`npm test`:** the first foreground call was moved to the background by the harness. I stopped it with `kill` after confirming through `/proc/<pid>/cwd` that it ran in this worktree. Its partial output (cancelled files) isn't used here. The rerun wrote to `review-run.log` inside the worktree, since deleted: 1230 tests, 1169 pass, 0 fail, 0 cancelled, 61 skipped, exit 0. This matches the worker's numbers.
- **Mutations of `review-needed.ts:15`:** each was run against `node --test packages/delivery/test/review-needed.test.ts`, then restored with `git checkout`. My first two mutation loops wrote the replacements with doubled backslashes, so they changed something else; their output isn't counted. The corrected run:

| Mutation | Result |
|---|---|
| `(?<!\w)` (the old regex) | 1 fail, caught |
| `(?<![\w.])` (no backslashes) | 1 fail, caught |
| `(?<![\w.^]\\*)` | 1 fail, caught |
| `(?<!\w\\*)` | 0 fail, **not caught** |
| `(?<![\w.]\\?)` | 0 fail, **not caught** |

- **Shipped regex on sample lines (node one-liner, file names built so the guard allows them):** it skips `/process\.env\.(w+)/g`, `RegExp("process\\.env")`, `process.env.X`, `.envrc`, `..env`, `x.\.env` and `.ENV`. It matches `/^\.env$/`, `readFileSync(".env")`, `a/.env`, `".env.local"` and `"\\.env"`.
- `git status` was clean after every mutation and at the end.

FAIL