# AR0436 - Review 1

- Job: 2026-10-27-review-004edf6a
- Branch: arthur/2026-10-27-worker-00956170
- Commit reviewed: 436ba068754ca261c0d34e955a7dc0880670614e
- Verdict: FAIL

## Final message

I'm failing this branch on two gaps in the tests. The extension does what AR0436 asks, `npm run check` passes, and 27 of 27 targeted tests pass. But two mutations of key behaviours survive the tests, and both would let a call get a false `clean` line.

## Findings

1. **`packages/delivery/test/checks.test.ts:160-171` (the overlap test): tests pass even when results are not matched by call id.** I changed `began.get(event.toolCallId)` in `checks-extension.ts:29` to `began.values().next().value`, which takes whichever reading started first. `checks.test.ts` still passed in full (`fail 0`). The test ends its two calls in the order they began (`toolu_a`, then `toolu_b`), so a first-in-first-out queue gives the same answer as keying by id.
   - When two parallel bash calls finish out of order, the readings swap. A call that began on a dirty tree then gets the other call's clean reading and a `clean` line.
   - This contradicts the worker's claim that breaking "keying by call id (on read …)" fails a test.
   - I checked the fix with a throwaway edit: ending `toolu_b` before `toolu_a` passes on the branch's code and fails under this mutation (`actual: 'check pass <commit> dirty\ntest pass 3/3 <commit> dirty\n'`).

2. **`packages/delivery/src/checks-extension.ts:52`: no test catches dropping `ctimeNs` from the file-stat compare.** The comment at `:40-41` rests the guarantee on ctime: "any write changes its ctime, so a file rewritten and put back, by Git or not". Yet removing `${stat.ctimeNs}` leaves `checks.test.ts` passing (`fail 0`).
   - The "put back without Git" test only survives because its write also changes mtime. A restore that copies the old mtime back gets past an mtime-only compare.
   - Throwaway probe: during the call, `touch -r package.json ref`, rewrite `package.json` with other content of the same size, write it back, then `touch -r ref package.json`.
     - With the branch's code: `dirty`.
     - With ctime removed: `actual: 'test pass 3/3 <commit> clean'`.
   - This is exactly the "tested on another file and put back" bypass the ticket is about.

## Notes (not blocking)
- `clean` does not check the start reading's own `clean`. I found no case where that matters. If the files and HEAD are unchanged and the end tree is clean, the checks ran on HEAD's content.
- `core.hooksPath=/dev/null` has no test, as the worker says. None of these read-only git calls runs a hook.
- Dropping `${stat.ino}` from the compare also goes uncaught, but it is redundant with ctime and isn't a key behaviour on its own.
- The behaviour change for `npm test && git commit -am` (now `<old commit> dirty`) follows the ticket's rule, as the owner already noted.
- The doc update and delivery's budget raise to 1533 have their reasons recorded. The extension's diff is +52 −19 = 33 lines, which matches the raise.

## Checks run
- `npm run check`: `tsc`, no errors.
- `node --import @arthur/core/testing --test packages/delivery/test/checks.test.ts test/structure.test.ts`: 27 tests, 27 pass, 0 fail.
- I did not run `npm ci` (dependencies were already installed) or the full suite, as you asked. The host reports 1184 pass, 0 fail, 6 skipped.
- Mutations, each run against `checks.test.ts`, with the number of failing tests:

| Mutation | Tests failing | Caught? |
|---|---|---|
| Commit compare → `true` | 1 | yes |
| File-stat compare → `true` | 2 | yes |
| `&& after.clean` removed | 4 | yes |
| Tag check (`H `) → `true` | 1 | yes |
| `(before ?? after).head` → `after.head` | 1 | yes |
| `core.fsmonitor=false` removed | 1 | yes |
| `--no-replace-objects` removed | 1 | yes |
| A result with no matching start treated as clean | 1 | yes |
| try/catch around `lstat` removed | 1 | yes |
| `tool_call` reading disabled | 8 | yes |
| mtime and ctime both removed | 1 | yes |
| Lookup by call id → first started (finding 1) | 0 | **no** |
| ctime removed (finding 2) | 0 | **no** |
| ino removed | 0 | no (redundant) |

- I restored every throwaway edit with `git checkout --`, and `git status --short` was empty at the end.

FAIL