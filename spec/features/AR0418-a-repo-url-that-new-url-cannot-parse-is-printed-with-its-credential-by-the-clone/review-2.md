# AR0418 - Review 2

- Job: 2026-10-25-review-5d3679c5
- Branch: arthur/2026-10-25-worker-12f4ff21
- Commit reviewed: e97d6efc9a2f0fdc8109606788c6b9a065ccfc91
- Verdict: PASS

## Final message

I found nothing that blocks the merge. `shown` in `packages/projects/src/clone.ts:27` now drops the userinfo after `//` from a repo URL that `new URL` cannot parse, which covers both of the ticket's examples and the space-in-password case from review 1. `git@host:path` is printed whole, and every Done means point has a test that fails without the change.

## Findings

None.

## Notes

- **A password with a `/` in it, or a URL with one slash.** `https://u:a/b@host:99999/x` and `https:/u:s3cret@host:99999/x` are printed as given. Git reads neither part as userinfo: on the first it prints the URL with `u:a/b@` itself, and the second goes to ssh as host `https`. Review 1 already accepted this.
- **A password with a raw `@` in it.** `https://u:a@b@host:99999/x` is masked up to the last `@` before the first `/`, giving `https://host:99999/x`. Git strips only up to the first `@` (it prints `https://b@host:99999/x/`), so the mask hides more than Git does, not less. Because of that, swapping the greedy `[^/]*@` for a lazy `[^/]*?@` is not caught by the tests, and it leaks nothing Git itself would not print.
- **`.*@` instead of `[^/]*@` is not caught.** That change would also cut a path that holds an `@`: `https://host:99999/a@b` would print as `https://b`. It leaks nothing, but no row has an `@` in the path of a URL that does not parse.
- **The worker's claims match.** The source change is 2 lines (`4 ++--`) and the test file gets 17 more lines. The two new rows check the start of the message exactly and that `s3cret` and `my pass` are absent. `clone.ts` is well under 200 lines; the 200-line limit counts source files only, not the 240-line test file.

## Checks

- `npm ci`: added 22 packages.
- `npm run check` (`tsc`): no errors.
- `timeout 900 npm test`: 1108 tests, 1050 pass, 0 fail, 58 skipped.
- `shown` run directly with `node -e` on 12 inputs: the ticket's two examples and the spaced password are masked, `git@example.com:acme/shop.git` is unchanged, and the rest behave as the notes say.
- Git's own reading, checked with `git ls-remote` on `https:/u:s3cret@…`, `https://u:a/b@…` and `https://u:a@b@…`: as the notes say.
- Mutations, each run with `--test-name-pattern="credential"` on `projects.test.ts`:
  - `[^/]*@` → `[^/\s]*@`: caught (the spaced row fails and shows the old leak).
  - The unparsable branch set back to `: url`: caught.
  - `/[^/]*@/` replaced with `""` (no `//` anchor): caught.
  - `\/\/.*@`: not caught (see notes).
  - Lazy `[^/]*?@`: not caught (see notes).
- `clone.ts` was restored with `git checkout --` after each mutation, and `git status --short` is empty.

PASS