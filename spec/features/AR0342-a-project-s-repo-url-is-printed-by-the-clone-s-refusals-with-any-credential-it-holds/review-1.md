# AR0342 - Review 1

- Job: 2026-10-25-review-80f82f57
- Branch: arthur/2026-10-25-worker-3de620ca
- Commit reviewed: 9da95dddf7687e6ae3b22c7f8d3e41689fb3679d
- Verdict: PASS

## Final message

I found nothing that blocks the merge. The branch does what AR0342 asks: neither clone refusal shows a credential held in a `repo` URL any more, and both are tested.

## Findings
None.

## Notes
- **Shown URL:** `packages/projects/src/clone.ts:27` builds the shown URL with `new URL` and empties its user and password, which is how Done means describes it, and both refusals use it (lines 34 and 43). A plain path or a `git@host:path` form is printed as it is.
- **Accepted deviation:** at `clone.ts:43` the worker replaces every word holding an `@` in git's line (`/\S*@\S+/g`), where the ticket said `\S+://\S+`. The reason holds: I ran the same failing clone and git printed `fatal: unable to look up arthur:s3cret@127.0.0.1:1 (port 9418) …`, which has no `://`, so the ticket's pattern would let the credential through. My mutation to the ticket's pattern made the new test fail. Any URL with a user or password contains an `@`, so the new pattern covers every case the old one would.
- **Bypasses I found** (not blocking; the ticket chose "when it parses"):
  - A URL that `new URL` cannot parse, such as `https://u:s3cret@host:99999/x.git` (port out of range) or `https://u:s3cret@exa mple.com/x.git` (space in the host), goes into the `git clone … failed` line with its credential. Running the same `@` replacement on such a URL would close this.
  - A token in the query string (`?token=…`) is kept. The ticket only covers credentials in the user and password part.
- **Test is offline:** the new test's clone makes no network call. I traced it with `strace -f -e trace=connect,sendto` and it made no connect or sendto call.
- **`cloned` signature:** `cloned` now takes `repo` as a parameter, which the worker did to keep the line count at its budget. It behaves the same.
- **Findings file:** F1 in the new `findings.md` points at `packages/github/src/github-git.ts`, which this branch does not change. It is left open for the coordinator.

## Checks
- **`npm ci`:** succeeded.
- **`npm run check`:** `tsc` reported no errors.
- **`npm test`:** 1107 tests, 1049 pass, 0 fail, 0 cancelled, 58 skipped.
- **`node --test test/structure.test.ts`:** 15 pass, 0 fail.
- **Line budget:** `cat packages/projects/src/*.ts | wc -l` gives 486, as the worker said; `clone.ts` is 54 lines.
- **Mutations:** each was run against the new test (`--test-name-pattern=credential`) and each made it fail (pass 0, fail 1):
  - `password: ""` removed
  - `username: ""` removed
  - the `@` pattern swapped for the ticket's `\S+://\S+`
  - `shown` disabled (`URL.canParse` replaced with `false`)
- **Restore:** the unchanged code passes (pass 1); I restored `clone.ts` with `git checkout --` and `git status` is clean.
- **Edge-case probe:** I fed nine URL forms to `shown` with `node -e`. It strips the credential from `ssh://` URLs and from a password containing an `@`, and leaves `git@`, paths and `file://` as they are. The two URLs that fail to parse kept their credential, as listed above.

PASS